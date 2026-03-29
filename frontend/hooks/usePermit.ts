'use client'

import { useMemo } from 'react'

import { useCofheStore } from '@/services/store/cofheStore'

export function usePermit() {
  const permitHash = useCofheStore((state) => state.permitHash)
  const permitExport = useCofheStore((state) => state.permitExport)
  const phase = useCofheStore((state) => state.phase)

  return useMemo(
    () => ({
      permitHash,
      permitExport,
      hasPermit: Boolean(permitHash),
      isReady: phase === 'ready',
    }),
    [permitExport, permitHash, phase],
  )
}
