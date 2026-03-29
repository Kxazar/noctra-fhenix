'use client'

import { useMemo, useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'

import { brand } from '@/lib/brand'
import { contracts, isLiveConfigured, gaugeControllerAbi, veilTokenAbi } from '@/lib/contracts'

const MAX_LOCK_DAYS = 4 * 365

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Transaction failed'
}

export function LockPlanner() {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()

  const [lockAmount, setLockAmount] = useState(1000)
  const [durationDays, setDurationDays] = useState(1460)
  const [wrapAmount, setWrapAmount] = useState(120)
  const [status, setStatus] = useState<string | null>(null)

  const votingPower = useMemo(
    () => Math.floor((lockAmount * durationDays) / MAX_LOCK_DAYS),
    [durationDays, lockAmount],
  )

  const veShare = useMemo(
    () => ((durationDays / MAX_LOCK_DAYS) * 100).toFixed(1),
    [durationDays],
  )

  const handleLock = async () => {
    if (!address || !isLiveConfigured) {
      setStatus('Live mode is not configured yet, so this panel stays in planner mode.')
      return
    }

    try {
      setStatus(`Approving ${brand.governanceTokenSymbol} for the gauge controller...`)
      await writeContractAsync({
        address: contracts.voteToken,
        abi: veilTokenAbi,
        functionName: 'approve',
        args: [contracts.gaugeController, BigInt(lockAmount)],
      })

      setStatus('Submitting lock transaction...')

      await writeContractAsync({
        address: contracts.gaugeController,
        abi: gaugeControllerAbi,
        functionName: 'lock',
        args: [BigInt(lockAmount), BigInt(durationDays * 24 * 60 * 60)],
      })

      setStatus('Lock submitted. Your ve position will decay linearly until unlock.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  const handleWrap = async () => {
    if (!address || !isLiveConfigured) {
      setStatus(`Wrap is available once a live ${brand.governanceTokenSymbol} token address is configured.`)
      return
    }

    try {
      setStatus(`Wrapping ${brand.governanceTokenSymbol} into encrypted balance...`)

      await writeContractAsync({
        address: contracts.voteToken,
        abi: veilTokenAbi,
        functionName: 'wrap',
        args: [address, BigInt(wrapAmount)],
      })

      setStatus(`Wrapped balance submitted. Your public ${brand.governanceTokenSymbol} moved into encrypted storage.`)
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{brand.veGovernanceTokenSymbol}</p>
          <h3>Lock planner and encrypted {brand.governanceTokenSymbol} rail</h3>
        </div>
      </div>

      <div className="slider-stack">
        <label className="field">
          <span>Lock amount</span>
          <input
            className="input"
            max={5000}
            min={10}
            onChange={(event) => setLockAmount(Number(event.target.value))}
            type="range"
            value={lockAmount}
          />
          <strong>{lockAmount} {brand.governanceTokenSymbol}</strong>
        </label>

        <label className="field">
          <span>Lock duration</span>
          <input
            className="input"
            max={1460}
            min={30}
            onChange={(event) => setDurationDays(Number(event.target.value))}
            type="range"
            value={durationDays}
          />
          <strong>{durationDays} days</strong>
        </label>

        <label className="field">
          <span>Wrap into encrypted {brand.governanceTokenSymbol}</span>
          <input
            className="input"
            max={1000}
            min={10}
            onChange={(event) => setWrapAmount(Number(event.target.value))}
            type="range"
            value={wrapAmount}
          />
          <strong>{wrapAmount} {brand.governanceTokenSymbol}</strong>
        </label>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Estimated voting power</span>
          <strong>{votingPower} {brand.veGovernanceTokenSymbol}</strong>
        </div>
        <div>
          <span className="muted">Time premium</span>
          <strong>{veShare}% of max boost</strong>
        </div>
        <div>
          <span className="muted">Wrapped side-pocket</span>
          <strong>{wrapAmount} shielded {brand.governanceTokenSymbol}</strong>
        </div>
      </div>

      <div className="button-row">
        <button className="button" disabled={isPending} onClick={() => void handleLock()}>
          {isPending ? 'Pending...' : 'Approve and lock'}
        </button>
        <button className="button button-secondary" disabled={isPending} onClick={() => void handleWrap()}>
          Encrypt {brand.governanceTokenSymbol} balance
        </button>
      </div>

      <p className="supporting-copy">
        The public lock sets your ve weight, while wrapped {brand.governanceTokenSymbol} showcases the separate
        FHERC20-style encrypted balance lane adapted from the Fhenix hook template.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
