'use client'

import { create } from 'zustand'

type CofhePhase = 'idle' | 'initializing' | 'ready' | 'error'

type EncryptionPreview = {
  kind: 'vote' | 'mint'
  label: string
  ctHash: string
  securityZone: number
  utype: number
  signaturePreview: string
}

type CofheStore = {
  mode: 'demo' | 'live'
  liveReady: boolean
  phase: CofhePhase
  account: string | null
  permitHash: string | null
  permitExport: string | null
  lastError: string | null
  encryptionPreview: EncryptionPreview | null
  setBootstrap: (mode: 'demo' | 'live', liveReady: boolean, account: string | null) => void
  setPhase: (phase: CofhePhase) => void
  setPermit: (permitHash: string | null, permitExport: string | null) => void
  setPreview: (preview: EncryptionPreview | null) => void
  setError: (message: string | null) => void
}

export const useCofheStore = create<CofheStore>((set) => ({
  mode: 'demo',
  liveReady: false,
  phase: 'idle',
  account: null,
  permitHash: null,
  permitExport: null,
  lastError: null,
  encryptionPreview: null,
  setBootstrap: (mode, liveReady, account) => set({ mode, liveReady, account }),
  setPhase: (phase) => set({ phase }),
  setPermit: (permitHash, permitExport) => set({ permitHash, permitExport }),
  setPreview: (encryptionPreview) => set({ encryptionPreview }),
  setError: (lastError) => set({ lastError, phase: lastError ? 'error' : 'idle' }),
}))
