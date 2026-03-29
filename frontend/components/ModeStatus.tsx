'use client'

import { useCofhe } from '@/hooks/useCofhe'

export function ModeStatus() {
  const { mode, liveReady, phase, permitHash, encryptionPreview, lastError } = useCofhe()

  return (
    <section className="panel panel-tight">
      <div className="panel-header">
        <div>
          <p className="eyebrow">CoFHE status</p>
          <h3>Execution rail</h3>
        </div>
        <span className={`status-pill ${mode === 'live' && liveReady ? 'status-live' : 'status-demo'}`}>
          {mode === 'live' && liveReady ? 'Live mode armed' : 'Demo mode'}
        </span>
      </div>

      <div className="status-grid">
        <div>
          <span className="muted">SDK phase</span>
          <strong>{phase}</strong>
        </div>
        <div>
          <span className="muted">Permit</span>
          <strong>{permitHash ? `${permitHash.slice(0, 8)}...${permitHash.slice(-6)}` : 'Not minted yet'}</strong>
        </div>
        <div>
          <span className="muted">Latest payload</span>
          <strong>{encryptionPreview ? encryptionPreview.label : 'Nothing encrypted yet'}</strong>
        </div>
      </div>

      {encryptionPreview ? (
        <div className="preview-box">
          <div>
            <span className="muted">ctHash</span>
            <strong>{encryptionPreview.ctHash}</strong>
          </div>
          <div>
            <span className="muted">signature</span>
            <strong>{encryptionPreview.signaturePreview}</strong>
          </div>
        </div>
      ) : null}

      {lastError ? <p className="inline-error">{lastError}</p> : null}
    </section>
  )
}
