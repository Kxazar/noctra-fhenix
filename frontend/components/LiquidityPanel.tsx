'use client'

import { useMemo, useState } from 'react'
import { useAccount, useChainId, useWriteContract } from 'wagmi'

import { brand } from '@/lib/brand'
import { areAssetsConfigured, arePoolsConfigured, erc20Abi, liquidityPools, marketAssets, poolAbi } from '@/lib/contracts'
import { appChain } from '@/lib/wagmiConfig'
import { demoAssets, demoPools } from '@/lib/demo-data'

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Pool transaction failed'
}

export function LiquidityPanel() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { writeContractAsync, isPending } = useWriteContract()

  const [selectedPoolId, setSelectedPoolId] = useState(0)
  const [liquidityAmount0, setLiquidityAmount0] = useState(50)
  const [liquidityAmount1, setLiquidityAmount1] = useState(50)
  const [status, setStatus] = useState<string | null>(null)

  const selectedPool = useMemo(() => demoPools.find((pool) => pool.id === selectedPoolId) ?? demoPools[0], [selectedPoolId])
  const token0 = useMemo(() => demoAssets.find((asset) => asset.id === selectedPool.tokenIn) ?? demoAssets[0], [selectedPool])
  const token1 = useMemo(() => demoAssets.find((asset) => asset.id === selectedPool.tokenOut) ?? demoAssets[1], [selectedPool])

  const livePool = liquidityPools.find((pool) => pool.id === selectedPoolId)
  const liveToken0 = marketAssets.find((asset) => asset.id === selectedPool.tokenIn)
  const liveToken1 = marketAssets.find((asset) => asset.id === selectedPool.tokenOut)
  const wrongNetwork = Boolean(address) && chainId !== appChain.id

  const handleAddLiquidity = async () => {
    if (wrongNetwork) {
      setStatus(`Switch your wallet to ${appChain.name} before adding liquidity.`)
      return
    }

    if (!address || !livePool || !liveToken0 || !liveToken1 || !arePoolsConfigured || !areAssetsConfigured) {
      setStatus('Pool addresses are not live yet, so the LP tab stays in preview mode.')
      return
    }

    try {
      setStatus(`Approving ${token0.name} for the pool...`)
      await writeContractAsync({
        address: liveToken0.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [livePool.address, BigInt(liquidityAmount0)],
      })

      setStatus(`Approving ${token1.name} for the pool...`)
      await writeContractAsync({
        address: liveToken1.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [livePool.address, BigInt(liquidityAmount1)],
      })

      setStatus('Submitting add liquidity transaction...')
      await writeContractAsync({
        address: livePool.address,
        abi: poolAbi,
        functionName: 'addLiquidity',
        args: [BigInt(liquidityAmount0), BigInt(liquidityAmount1)],
      })

      setStatus('Liquidity added. The resulting LP share now competes for weekly emissions in the selected lane.')
    } catch (error) {
      setStatus(describeError(error as { shortMessage?: string; message?: string }))
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">LP rail</p>
          <h3>Mint pool inventory in the markets that fight for emissions</h3>
        </div>
      </div>

      <div className="gauge-list">
        {demoPools.map((pool) => (
          <label className={`gauge-card ${selectedPoolId === pool.id ? 'gauge-card-active' : ''}`} key={pool.id}>
            <input checked={selectedPoolId === pool.id} name="lp-pool" onChange={() => setSelectedPoolId(pool.id)} type="radio" />
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

      <div className="toolbar toolbar-double">
        <label className="field field-inline">
          <span>{token0.name} for LP</span>
          <input
            className="input input-compact"
            min={1}
            onChange={(event) => setLiquidityAmount0(Number(event.target.value))}
            type="number"
            value={liquidityAmount0}
          />
        </label>
        <label className="field field-inline">
          <span>{token1.name} for LP</span>
          <input
            className="input input-compact"
            min={1}
            onChange={(event) => setLiquidityAmount1(Number(event.target.value))}
            type="number"
            value={liquidityAmount1}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="button" disabled={wrongNetwork || isPending} onClick={() => void handleAddLiquidity()}>
          {isPending ? 'Pending...' : 'Add liquidity'}
        </button>
      </div>

      <div className="metric-band">
        <div>
          <span className="muted">Pair</span>
          <strong>{selectedPool.name}</strong>
        </div>
        <div>
          <span className="muted">Your LP inventory</span>
          <strong>{selectedPool.userLpBalance} LP</strong>
        </div>
        <div>
          <span className="muted">Weekly reward lane</span>
          <strong>{selectedPool.rewardInventory} {brand.governanceTokenSymbol}</strong>
        </div>
      </div>

      <p className="supporting-copy">
        LP shares are minted on-chain and later compete for emissions through shadow gauge voting. This keeps swap
        execution and incentive routing tied to the same market objects.
      </p>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
