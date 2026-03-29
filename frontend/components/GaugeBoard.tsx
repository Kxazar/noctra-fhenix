'use client'

import { useMemo, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi'

import { useCofhe } from '@/hooks/useCofhe'
import { brand } from '@/lib/brand'
import { demoEpoch, demoGauges } from '@/lib/demo-data'
import { contracts, gaugeControllerAbi, isLiveConfigured } from '@/lib/contracts'
import { appChain } from '@/lib/wagmiConfig'

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Encrypted vote flow failed'
}

export function GaugeBoard() {
  const publicClient = usePublicClient()
  const { address } = useAccount()
  const chainId = useChainId()
  const { writeContractAsync, isPending } = useWriteContract()
  const { decryptHandle, encryptVote, sdkModule } = useCofhe()

  const [selectedGauge, setSelectedGauge] = useState(0)
  const [epochToInspect, setEpochToInspect] = useState(demoEpoch.id)
  const [revealedWeight, setRevealedWeight] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const selectedGaugeData = useMemo(
    () => demoGauges.find((gauge) => gauge.id === selectedGauge) ?? demoGauges[0],
    [selectedGauge],
  )
  const wrongNetwork = Boolean(address) && chainId !== appChain.id

  const handlePreviewVote = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before preparing a live vote.`)
      return
    }

    setStatus('Encrypting gauge vote locally...')
    const result = await encryptVote(selectedGauge)

    if (!result.ok) {
      setStatus(result.error)
      return
    }

    setStatus('Encrypted payload prepared. Intent remains hidden until epoch reveal.')
  }

  const handleSubmitVote = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before sending a gauge vote.`)
      return
    }

    if (!publicClient || !address || !isLiveConfigured) {
      setStatus('Live voting is disabled on this deployment. Preview mode still works.')
      return
    }

    const encrypted = await encryptVote(selectedGauge)
    if (!encrypted.ok) {
      setStatus(encrypted.error)
      return
    }

    try {
      setStatus('Fetching the active epoch...')
      const currentEpoch = await publicClient.readContract({
        address: contracts.gaugeController,
        abi: gaugeControllerAbi,
        functionName: 'currentEpoch',
      })

      setStatus('Submitting encrypted gauge vote...')
      await writeContractAsync({
        address: contracts.gaugeController,
        abi: gaugeControllerAbi,
        functionName: 'vote',
        args: [
          currentEpoch,
          {
            ctHash: encrypted.data.ctHash,
            securityZone: encrypted.data.securityZone,
            utype: encrypted.data.utype,
            signature: encrypted.data.signature,
          },
        ],
      })

      setStatus('Encrypted vote submitted. Only the aggregate can be revealed later.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  const handleDecryptWeight = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before requesting a reveal.`)
      return
    }

    if (!publicClient || !address || !isLiveConfigured) {
      setRevealedWeight(String(selectedGaugeData.revealedWeight))
      setStatus('Showing demo reveal because live contract addresses are not injected here.')
      return
    }

    try {
      setStatus('Reading encrypted gauge weight handle...')
      const handle = await publicClient.readContract({
        address: contracts.gaugeController,
        abi: gaugeControllerAbi,
        functionName: 'getEncryptedGaugeWeight',
        args: [BigInt(epochToInspect), BigInt(selectedGauge)],
      })

      const decrypted = await decryptHandle(handle, sdkModule?.FheTypes.Uint128 ?? 6, address)
      if (!decrypted.ok) {
        setStatus(decrypted.error)
        return
      }

      setRevealedWeight(decrypted.data.toString())
      setStatus('Reveal succeeded through the active permit.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shadow gauges</p>
          <h3>Route emissions without leaking the trade before epoch close</h3>
        </div>
      </div>

      <div className="gauge-list">
        {demoGauges.map((gauge) => (
          <label className={`gauge-card ${selectedGauge === gauge.id ? 'gauge-card-active' : ''}`} key={gauge.id}>
            <input
              checked={selectedGauge === gauge.id}
              name="gauge"
              onChange={() => setSelectedGauge(gauge.id)}
              type="radio"
            />
            <div>
              <strong>{gauge.name}</strong>
              <p>{gauge.pairLabel}</p>
              <span>{gauge.angle}</span>
            </div>
            <div className="gauge-metrics">
              <span>{gauge.revealedWeight} weight</span>
              <span>{gauge.emissionShare} {brand.governanceTokenSymbol} / week</span>
            </div>
          </label>
        ))}
      </div>

      <div className="toolbar">
        <label className="field field-inline">
          <span>Epoch</span>
          <input
            className="input input-compact"
            min={0}
            onChange={(event) => setEpochToInspect(Number(event.target.value))}
            type="number"
            value={epochToInspect}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="button button-secondary" disabled={wrongNetwork} onClick={() => void handlePreviewVote()}>
          Encrypt vote only
        </button>
        <button className="button" disabled={wrongNetwork || isPending} onClick={() => void handleSubmitVote()}>
          {isPending ? 'Pending...' : 'Submit live vote'}
        </button>
        <button className="button button-secondary" disabled={wrongNetwork} onClick={() => void handleDecryptWeight()}>
          Reveal selected weight
        </button>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Active gauge</span>
          <strong>{selectedGaugeData.name}</strong>
        </div>
        <div>
          <span className="muted">Epoch reveal</span>
          <strong>{revealedWeight ?? 'hidden'}</strong>
        </div>
        <div>
          <span className="muted">Weekly budget</span>
          <strong>{demoEpoch.weeklyEmission} {brand.governanceTokenSymbol}</strong>
        </div>
      </div>

      <p className="supporting-copy">
        The contract updates all gauge tallies on every vote using encrypted comparisons. Until the owner reveals an
        epoch, outside observers cannot tell which pool accumulated weight.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
