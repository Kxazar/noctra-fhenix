'use client'

import { useMemo, useState } from 'react'
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi'

import { useCofhe } from '@/hooks/useCofhe'
import { usePermit } from '@/hooks/usePermit'

export function WalletPanel() {
  const { address, chain, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  })

  const { createPermit, mode, liveReady } = useCofhe()
  const { permitExport, permitHash, hasPermit } = usePermit()
  const [status, setStatus] = useState<string | null>(null)

  const primaryConnector = useMemo(() => connectors[0], [connectors])

  const handleCreatePermit = async () => {
    setStatus('Requesting CoFHE permit...')
    const result = await createPermit()

    if (!result.ok) {
      setStatus(result.error)
      return
    }

    setStatus('Permit created. You can now decrypt revealed handles and submit encrypted inputs.')
  }

  return (
    <section className="panel wallet-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Wallet rail</p>
          <h3>Permit-aware operator console</h3>
        </div>
        <span className="status-pill">{isConnected ? 'Wallet connected' : 'Wallet optional'}</span>
      </div>

      <div className="wallet-meta">
        <div>
          <span className="muted">Account</span>
          <strong>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</strong>
        </div>
        <div>
          <span className="muted">Chain</span>
          <strong>{chain?.name ?? 'Demo mode'}</strong>
        </div>
        <div>
          <span className="muted">Native balance</span>
          <strong>{balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : 'n/a'}</strong>
        </div>
      </div>

      <div className="button-row">
        {isConnected ? (
          <button className="button button-secondary" onClick={() => disconnect()}>
            Disconnect
          </button>
        ) : (
          <button
            className="button"
            disabled={!primaryConnector || isPending}
            onClick={() => primaryConnector && connect({ connector: primaryConnector })}
          >
            {isPending ? 'Connecting...' : 'Connect wallet'}
          </button>
        )}

        <button
          className="button button-secondary"
          disabled={!isConnected || (mode === 'live' && !liveReady)}
          onClick={() => void handleCreatePermit()}
        >
          Create permit
        </button>
      </div>

      <p className="supporting-copy">
        {mode === 'live' && liveReady
          ? 'This deployment is wired for live encrypted writes. Connect a wallet, mint a permit, and submit FHE payloads.'
          : 'This deployment is in demo-first mode. The wallet rail is still useful for previewing the live Fhenix flow once contract addresses and endpoints are injected via env.'}
      </p>

      <div className="permit-box">
        <div>
          <span className="muted">Permit hash</span>
          <strong>{hasPermit && permitHash ? permitHash : 'No active permit'}</strong>
        </div>

        <label className="permit-label" htmlFor="permit-export">
          Shareable permit payload
        </label>
        <textarea
          id="permit-export"
          className="permit-export"
          readOnly
          value={permitExport ?? 'Permit export will appear here once the SDK signs one.'}
        />
      </div>

      {status ? <p className="supporting-copy">{status}</p> : null}
    </section>
  )
}
