'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { appMode, fheEndpoints, isLiveConfigured, liveEnvironment } from '@/lib/contracts'
import { useCofheStore } from '@/services/store/cofheStore'

type CofheModule = typeof import('cofhejs/web')
type EncryptedInput = {
  ctHash: bigint
  securityZone: number
  utype: number
  signature: `0x${string}`
}

type HookFailure = {
  ok: false
  error: string
}

type HookSuccess<T> = {
  ok: true
  data: T
}

function describeError(error: { shortMessage?: string; message?: string } | null | undefined) {
  return error?.shortMessage ?? error?.message ?? 'Unknown CoFHE error'
}

export function useCofhe() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [sdkModule, setSdkModule] = useState<CofheModule | null>(null)

  const phase = useCofheStore((state) => state.phase)
  const liveReady = useCofheStore((state) => state.liveReady)
  const permitHash = useCofheStore((state) => state.permitHash)
  const permitExport = useCofheStore((state) => state.permitExport)
  const encryptionPreview = useCofheStore((state) => state.encryptionPreview)
  const lastError = useCofheStore((state) => state.lastError)
  const setBootstrap = useCofheStore((state) => state.setBootstrap)
  const setPhase = useCofheStore((state) => state.setPhase)
  const setPermit = useCofheStore((state) => state.setPermit)
  const setPreview = useCofheStore((state) => state.setPreview)
  const setError = useCofheStore((state) => state.setError)

  useEffect(() => {
    let active = true

    import('cofhejs/web')
      .then((module) => {
        if (active) {
          setSdkModule(module)
        }
      })
      .catch((error) => {
        setError(describeError(error))
      })

    return () => {
      active = false
    }
  }, [setError])

  useEffect(() => {
    setBootstrap(appMode, isLiveConfigured, address ?? null)
  }, [address, setBootstrap])

  useEffect(() => {
    if (!sdkModule || !isLiveConfigured || !isConnected || !publicClient || !walletClient) {
      if (!isLiveConfigured) {
        setPhase('idle')
      }
      return
    }

    let cancelled = false

    const initialize = async () => {
      setError(null)
      setPhase('initializing')

      const result = await sdkModule.cofhejs.initializeWithViem({
        viemClient: publicClient,
        viemWalletClient: walletClient,
        environment: liveEnvironment,
        coFheUrl: fheEndpoints.coFheUrl,
        verifierUrl: fheEndpoints.verifierUrl,
        thresholdNetworkUrl: fheEndpoints.thresholdNetworkUrl,
        securityZones: [0],
      })

      if (cancelled) {
        return
      }

      if (!result.success) {
        setError(describeError(result.error))
        return
      }

      const permit = result.data ?? sdkModule.cofhejs.getPermit().data
      setPermit(permit?.getHash() ?? null, permit?.export() ?? null)
      setPhase('ready')
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [isConnected, publicClient, sdkModule, setError, setPermit, setPhase, walletClient])

  const ready = useMemo(
    () => phase === 'ready' || (appMode === 'demo' && sdkModule !== null),
    [phase, sdkModule],
  )

  const createPermit = async (): Promise<HookSuccess<unknown> | HookFailure> => {
    if (!sdkModule) {
      const message = 'CoFHE SDK is still loading.'
      setError(message)
      return { ok: false as const, error: message }
    }

    const result = await sdkModule.cofhejs.createPermit()
    if (!result.success) {
      const message = describeError(result.error)
      setError(message)
      return { ok: false as const, error: message }
    }

    setPermit(result.data.getHash(), result.data.export())
    setPhase('ready')
    return { ok: true as const, data: result.data }
  }

  const encryptVote = async (gaugeIndex: number): Promise<HookSuccess<EncryptedInput> | HookFailure> => {
    if (!sdkModule) {
      const message = 'CoFHE SDK is still loading.'
      setError(message)
      return { ok: false as const, error: message }
    }

    const result = await sdkModule.cofhejs.encrypt([
      sdkModule.Encryptable.uint8(BigInt(gaugeIndex)),
    ] as const)

    if (!result.success) {
      const message = describeError(result.error)
      setError(message)
      return { ok: false as const, error: message }
    }

    const payload = result.data[0] as EncryptedInput
    setPreview({
      kind: 'vote',
      label: `Gauge #${gaugeIndex}`,
      ctHash: payload.ctHash.toString(),
      securityZone: payload.securityZone,
      utype: payload.utype,
      signaturePreview: `${payload.signature.slice(0, 12)}...${payload.signature.slice(-8)}`,
    })

    return { ok: true as const, data: payload }
  }

  const encryptMintAmount = async (amount: bigint): Promise<HookSuccess<EncryptedInput> | HookFailure> => {
    if (!sdkModule) {
      const message = 'CoFHE SDK is still loading.'
      setError(message)
      return { ok: false as const, error: message }
    }

    const result = await sdkModule.cofhejs.encrypt([
      sdkModule.Encryptable.uint128(amount),
    ] as const)

    if (!result.success) {
      const message = describeError(result.error)
      setError(message)
      return { ok: false as const, error: message }
    }

    const payload = result.data[0] as EncryptedInput
    setPreview({
      kind: 'mint',
      label: `${amount.toString()} vhUSD`,
      ctHash: payload.ctHash.toString(),
      securityZone: payload.securityZone,
      utype: payload.utype,
      signaturePreview: `${payload.signature.slice(0, 12)}...${payload.signature.slice(-8)}`,
    })

    return { ok: true as const, data: payload }
  }

  const decryptHandle = async (
    ctHash: bigint,
    utype: number,
    accountOverride?: string,
  ): Promise<HookSuccess<bigint> | HookFailure> => {
    if (!sdkModule) {
      const message = 'CoFHE SDK is still loading.'
      setError(message)
      return { ok: false as const, error: message }
    }

    const permit = sdkModule.cofhejs.getPermit()
    if (!permit.success) {
      const message = 'Create a permit before decrypting contract outputs.'
      setError(message)
      return { ok: false as const, error: message }
    }

    const result = await sdkModule.cofhejs.decrypt(
      ctHash,
      utype as never,
      accountOverride ?? address,
      permit.data.getHash(),
    )

    if (!result.success) {
      const message = describeError(result.error)
      setError(message)
      return { ok: false as const, error: message }
    }

    return { ok: true as const, data: result.data as bigint }
  }

  return {
    sdkModule,
    ready,
    liveReady,
    mode: appMode,
    permitHash,
    permitExport,
    encryptionPreview,
    lastError,
    phase,
    address,
    createPermit,
    encryptVote,
    encryptMintAmount,
    decryptHandle,
  }
}
