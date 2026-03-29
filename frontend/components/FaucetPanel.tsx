'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useWriteContract } from 'wagmi'

import { brand } from '@/lib/brand'
import { contracts, faucetAbi, isFaucetConfigured } from '@/lib/contracts'
import { appChain } from '@/lib/wagmiConfig'

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Faucet transaction failed'
}

export function FaucetPanel() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { writeContractAsync, isPending } = useWriteContract()
  const [status, setStatus] = useState<string | null>(null)
  const faucetAmount = 100
  const wrongNetwork = Boolean(address) && chainId !== appChain.id

  useEffect(() => {
    if (!status && !isFaucetConfigured) {
      setStatus(`The ${brand.governanceTokenSymbol} faucet enters live mode once its deployed contract address is configured.`)
    }
  }, [status])

  const handleClaim = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before using the faucet.`)
      return
    }

    if (!isFaucetConfigured) {
      setStatus(`The ${brand.governanceTokenSymbol} faucet enters live mode once its deployed contract address is configured.`)
      return
    }

    try {
      setStatus(`Submitting ${brand.governanceTokenSymbol} faucet claim...`)
      await writeContractAsync({
        address: contracts.faucet,
        abi: faucetAbi,
        functionName: 'claim',
        args: [],
      })

      setStatus(`Claim sent. ${faucetAmount} ${brand.governanceTokenSymbol} can be claimed once every 24 hours per wallet.`)
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Bootstrap rail</p>
          <h3>Seed a new wallet with {brand.governanceTokenSymbol}</h3>
        </div>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Asset</span>
          <strong>{brand.governanceTokenSymbol}</strong>
        </div>
        <div>
          <span className="muted">Per request</span>
          <strong>{faucetAmount}</strong>
        </div>
        <div>
          <span className="muted">Wallet status</span>
          <strong>{!address ? 'connect wallet first' : wrongNetwork ? `switch to ${appChain.name}` : 'ready to claim'}</strong>
        </div>
      </div>

      <div className="button-row">
        <button className="button" disabled={!address || wrongNetwork || isPending} onClick={() => void handleClaim()}>
          {isPending ? 'Pending...' : `Claim ${brand.governanceTokenSymbol}`}
        </button>
      </div>

      <p className="supporting-copy">
        Only {brand.governanceTokenSymbol} is exposed through the public faucet. The cooldown lives inside the
        contract, so the site cannot bypass the one-wallet-per-24-hour rule even if the UI is replayed.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
