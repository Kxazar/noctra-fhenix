'use client'

import { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'

import { useCofhe } from '@/hooks/useCofhe'
import { collateralTokens, confidentialStableControllerAbi, contracts, erc20Abi, isLiveConfigured, stableTokenAbi } from '@/lib/contracts'
import { demoCollateralTypes, demoStablePosition } from '@/lib/demo-data'

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Stablecoin flow failed'
}

export function StableMintPanel() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()
  const { decryptHandle, encryptMintAmount, sdkModule } = useCofhe()

  const [selectedCollateralId, setSelectedCollateralId] = useState(0)
  const [depositAmount, setDepositAmount] = useState(100)
  const [mintAmount, setMintAmount] = useState(1_937)
  const [decryptedDebt, setDecryptedDebt] = useState<string | null>(null)
  const [decryptedStable, setDecryptedStable] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const selectedCollateral = useMemo(
    () => demoCollateralTypes.find((item) => item.id === selectedCollateralId) ?? demoCollateralTypes[0],
    [selectedCollateralId],
  )

  const liveCollateralToken = collateralTokens.find((item) => item.id === selectedCollateralId)

  const handleDeposit = async () => {
    if (!liveCollateralToken || !isLiveConfigured) {
      setStatus('Collateral deposit is waiting for live LP token addresses. Demo values are shown meanwhile.')
      return
    }

    try {
      setStatus('Approving LP collateral...')

      await writeContractAsync({
        address: liveCollateralToken.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contracts.stableController, BigInt(depositAmount)],
      })

      setStatus('Depositing collateral into the controller...')

      await writeContractAsync({
        address: contracts.stableController,
        abi: confidentialStableControllerAbi,
        functionName: 'depositCollateral',
        args: [BigInt(selectedCollateralId), BigInt(depositAmount)],
      })

      setStatus('Collateral deposit submitted.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  const handleMint = async () => {
    const encrypted = await encryptMintAmount(BigInt(mintAmount))
    if (!encrypted.ok) {
      setStatus(encrypted.error)
      return
    }

    if (!isLiveConfigured) {
      setStatus('Encrypted mint payload prepared. Live minting will activate once controller addresses are provided.')
      return
    }

    try {
      setStatus('Submitting encrypted vhUSD mint request...')

      await writeContractAsync({
        address: contracts.stableController,
        abi: confidentialStableControllerAbi,
        functionName: 'mintStable',
        args: [
          {
            ctHash: encrypted.data.ctHash,
            securityZone: encrypted.data.securityZone,
            utype: encrypted.data.utype,
            signature: encrypted.data.signature,
          },
        ],
      })

      setStatus('Encrypted mint request submitted.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  const handleDecryptPosition = async () => {
    if (!publicClient || !address || !isLiveConfigured) {
      setDecryptedDebt(String(demoStablePosition.encryptedDebt))
      setDecryptedStable(String(demoStablePosition.encryptedStableBalance))
      setStatus('Showing the demo stable position because this deployment is not wired to a live controller.')
      return
    }

    try {
      setStatus('Reading encrypted debt and vhUSD balance...')

      const debtHandle = await publicClient.readContract({
        address: contracts.stableController,
        abi: confidentialStableControllerAbi,
        functionName: 'getEncryptedDebt',
        args: [address],
      })

      const stableHandle = await publicClient.readContract({
        address: contracts.stableToken,
        abi: stableTokenAbi,
        functionName: 'encBalances',
        args: [address],
      })

      const debtResult = await decryptHandle(debtHandle, sdkModule?.FheTypes.Uint128 ?? 6, address)
      const stableResult = await decryptHandle(stableHandle, sdkModule?.FheTypes.Uint128 ?? 6, address)

      if (!debtResult.ok) {
        setStatus(debtResult.error)
        return
      }

      if (!stableResult.ok) {
        setStatus(stableResult.error)
        return
      }

      setDecryptedDebt(debtResult.data.toString())
      setDecryptedStable(stableResult.data.toString())
      setStatus('Encrypted debt and stable balance decrypted with the active permit.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shielded stablecoin</p>
          <h3>Mint vhUSD against selected LP pairs at 160% collateral</h3>
        </div>
      </div>

      <div className="gauge-list">
        {demoCollateralTypes.map((collateral) => (
          <label
            className={`gauge-card ${selectedCollateralId === collateral.id ? 'gauge-card-active' : ''}`}
            key={collateral.id}
          >
            <input
              checked={selectedCollateralId === collateral.id}
              name="collateral"
              onChange={() => setSelectedCollateralId(collateral.id)}
              type="radio"
            />
            <div>
              <strong>{collateral.name}</strong>
              <p>{collateral.pair}</p>
              <span>Price oracle {collateral.priceE4 / 10_000}x</span>
            </div>
            <div className="gauge-metrics">
              <span>{collateral.deposited} LP</span>
              <span>{collateral.collateralValue} value</span>
            </div>
          </label>
        ))}
      </div>

      <div className="toolbar toolbar-double">
        <label className="field field-inline">
          <span>Deposit amount</span>
          <input
            className="input input-compact"
            min={1}
            onChange={(event) => setDepositAmount(Number(event.target.value))}
            type="number"
            value={depositAmount}
          />
        </label>

        <label className="field field-inline">
          <span>Mint request</span>
          <input
            className="input input-compact"
            min={1}
            onChange={(event) => setMintAmount(Number(event.target.value))}
            type="number"
            value={mintAmount}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="button button-secondary" disabled={isPending} onClick={() => void handleDeposit()}>
          Deposit LP
        </button>
        <button className="button" disabled={isPending} onClick={() => void handleMint()}>
          {isPending ? 'Pending...' : 'Encrypt and mint vhUSD'}
        </button>
        <button className="button button-secondary" onClick={() => void handleDecryptPosition()}>
          Reveal my debt
        </button>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Selected collateral</span>
          <strong>{selectedCollateral.collateralValue} value</strong>
        </div>
        <div>
          <span className="muted">160% max mint</span>
          <strong>{demoStablePosition.maxMintableAt160} vhUSD</strong>
        </div>
        <div>
          <span className="muted">Decrypted position</span>
          <strong>{decryptedDebt ? `${decryptedDebt} debt / ${decryptedStable ?? '0'} vhUSD` : 'hidden'}</strong>
        </div>
      </div>

      <p className="supporting-copy">
        The controller clips every encrypted mint request to the remaining headroom, so a user can ask for more than
        they are allowed and still only receive the safe amount.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
