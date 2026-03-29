'use client'

import { useMemo, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi'

import { brand } from '@/lib/brand'
import { areAssetsConfigured, arePoolsConfigured, erc20Abi, liquidityPools, marketAssets, poolAbi } from '@/lib/contracts'
import { appChain } from '@/lib/wagmiConfig'
import { demoAssets, demoPools } from '@/lib/demo-data'

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Swap transaction failed'
}

export function SwapPanel() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()

  const [selectedPoolId, setSelectedPoolId] = useState(0)
  const [swapAmount, setSwapAmount] = useState(10)
  const [quotedAmountOut, setQuotedAmountOut] = useState<string | null>('11')
  const [status, setStatus] = useState<string | null>(null)

  const selectedPool = useMemo(() => demoPools.find((pool) => pool.id === selectedPoolId) ?? demoPools[0], [selectedPoolId])
  const tokenIn = useMemo(() => demoAssets.find((asset) => asset.id === selectedPool.tokenIn) ?? demoAssets[0], [selectedPool])
  const tokenOut = useMemo(() => demoAssets.find((asset) => asset.id === selectedPool.tokenOut) ?? demoAssets[1], [selectedPool])

  const livePool = liquidityPools.find((pool) => pool.id === selectedPoolId)
  const liveTokenIn = marketAssets.find((asset) => asset.id === selectedPool.tokenIn)
  const wrongNetwork = Boolean(address) && chainId !== appChain.id

  const handleQuote = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before loading a live quote.`)
      return
    }

    if (!publicClient || !livePool || !liveTokenIn || !arePoolsConfigured) {
      setQuotedAmountOut(String(Math.max(1, swapAmount - 1)))
      setStatus('Showing a demo quote. Live routing activates once pool addresses are configured.')
      return
    }

    try {
      const amountOut = await publicClient.readContract({
        address: livePool.address,
        abi: poolAbi,
        functionName: 'getAmountOut',
        args: [liveTokenIn.address, BigInt(swapAmount)],
      })
      setQuotedAmountOut(amountOut.toString())
      setStatus('Live quote loaded from the selected pool.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  const handleSwap = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before sending a swap.`)
      return
    }

    if (!address || !livePool || !liveTokenIn || !arePoolsConfigured || !areAssetsConfigured) {
      setStatus('Swap routing is ready in the UI, but live pool addresses are not configured yet.')
      return
    }

    try {
      setStatus(`Approving ${tokenIn.name} for the swap...`)
      await writeContractAsync({
        address: liveTokenIn.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [livePool.address, BigInt(swapAmount)],
      })

      setStatus('Submitting swap transaction...')
      await writeContractAsync({
        address: livePool.address,
        abi: poolAbi,
        functionName: 'swap',
        args: [liveTokenIn.address, BigInt(swapAmount), BigInt(quotedAmountOut ?? '1')],
      })

      setStatus('Swap submitted successfully.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Swap rail</p>
          <h3>Route through active markets without leaving the control surface</h3>
        </div>
      </div>

      <div className="gauge-list">
        {demoPools.map((pool) => (
          <label className={`gauge-card ${selectedPoolId === pool.id ? 'gauge-card-active' : ''}`} key={pool.id}>
            <input checked={selectedPoolId === pool.id} name="swap-pool" onChange={() => setSelectedPoolId(pool.id)} type="radio" />
            <div>
              <strong>{pool.name}</strong>
              <p>{pool.symbol}</p>
              <span>
                reserves {pool.reserve0} / {pool.reserve1}
              </span>
            </div>
            <div className="gauge-metrics">
              <span>{pool.userLpBalance} LP held</span>
              <span>{pool.rewardInventory} {brand.governanceTokenSymbol} / week</span>
            </div>
          </label>
        ))}
      </div>

      <div className="toolbar">
        <label className="field field-inline">
          <span>{tokenIn.name} to swap</span>
          <input
            className="input input-compact"
            min={1}
            onChange={(event) => setSwapAmount(Number(event.target.value))}
            type="number"
            value={swapAmount}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="button button-secondary" disabled={wrongNetwork} onClick={() => void handleQuote()}>
          Quote swap
        </button>
        <button className="button" disabled={wrongNetwork || isPending} onClick={() => void handleSwap()}>
          {isPending ? 'Pending...' : 'Swap assets'}
        </button>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Route</span>
          <strong>
            {tokenIn.name} -&gt; {tokenOut.name}
          </strong>
        </div>
        <div>
          <span className="muted">Quote</span>
          <strong>{quotedAmountOut ?? 'hidden'} out</strong>
        </div>
        <div>
          <span className="muted">Incentive lane</span>
          <strong>{selectedPool.rewardInventory} {brand.governanceTokenSymbol} / week</strong>
        </div>
      </div>

      <p className="supporting-copy">
        Quotes come straight from the selected pool when live addresses are configured. In demo mode the same panel
        still previews the route and the reward lane attached to that market.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
