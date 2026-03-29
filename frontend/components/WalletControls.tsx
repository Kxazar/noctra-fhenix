'use client'

import { useMemo, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'

import { useCofhe } from '@/hooks/useCofhe'
import { appChain } from '@/lib/wagmiConfig'

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletControls() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const { createPermit, lastError, permitHash, phase } = useCofhe()

  const [status, setStatus] = useState<string | null>(null)

  const connector = useMemo(() => connectors[0], [connectors])
  const wrongNetwork = isConnected && chainId !== appChain.id
  const canCreatePermit = isConnected && !wrongNetwork && phase !== 'initializing'
  const phaseLabel = wrongNetwork
    ? `wrong network`
    : phase === 'ready'
      ? permitHash
        ? 'permit ready'
        : 'wallet ready'
      : phase === 'initializing'
        ? 'cofhe booting'
        : phase === 'error'
          ? 'cofhe error'
          : null

  const handleConnect = async () => {
    if (!connector) {
      setStatus('No injected wallet detected. Open the site in MetaMask or another browser wallet.')
      return
    }

    try {
      setStatus(`Connecting through ${connector.name}...`)
      await connectAsync({ connector })
      setStatus('Wallet connected. CoFHE bootstrap will start automatically.')
    } catch (error) {
      const message = (error as { shortMessage?: string; message?: string }).shortMessage ??
        (error as { shortMessage?: string; message?: string }).message ??
        'Wallet connection failed'
      setStatus(message)
    }
  }

  const handleSwitch = async () => {
    try {
      setStatus(`Switching to ${appChain.name}...`)
      await switchChainAsync({ chainId: appChain.id })
      setStatus(`${appChain.name} selected.`)
    } catch (error) {
      const message = (error as { shortMessage?: string; message?: string }).shortMessage ??
        (error as { shortMessage?: string; message?: string }).message ??
        'Network switch failed'
      setStatus(message)
    }
  }

  const handlePermit = async () => {
    setStatus('Creating Fhenix permit...')
    const result = await createPermit()
    setStatus(result.ok ? 'Permit ready. Decrypt flows are now available.' : result.error)
  }

  return (
    <div className="wallet-cluster">
      <div className="wallet-chip">
        <span className="muted">Wallet</span>
        <strong>{address ? shortenAddress(address) : 'not connected'}</strong>
      </div>

      {phaseLabel ? (
        <div className={`status-pill ${phase === 'ready' && !wrongNetwork ? 'status-live' : 'status-demo'}`}>{phaseLabel}</div>
      ) : null}

      {!isConnected ? (
        <button className="button button-compact" disabled={isConnecting} onClick={() => void handleConnect()} type="button">
          {isConnecting ? 'Connecting...' : connector ? 'Connect wallet' : 'Install wallet'}
        </button>
      ) : wrongNetwork ? (
        <button className="button button-compact" disabled={isSwitching} onClick={() => void handleSwitch()} type="button">
          {isSwitching ? 'Switching...' : `Switch to ${appChain.name}`}
        </button>
      ) : (
        <>
          <button className="button button-secondary button-compact" disabled={!canCreatePermit} onClick={() => void handlePermit()} type="button">
            {permitHash ? 'Refresh permit' : 'Create permit'}
          </button>
          <button className="button button-secondary button-compact" onClick={() => disconnect()} type="button">
            Disconnect
          </button>
        </>
      )}

      {status || lastError || connectError ? (
        <p className="wallet-feedback">{status ?? lastError ?? connectError?.message ?? null}</p>
      ) : null}
    </div>
  )
}
