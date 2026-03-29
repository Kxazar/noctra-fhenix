'use client'

import { useState } from 'react'

import { ArchitecturePanel } from '@/components/ArchitecturePanel'
import { LogoMark } from '@/components/LogoMark'
import { ProtocolTabs } from '@/components/ProtocolTabs'
import { brand } from '@/lib/brand'
import { demoEpoch, demoPools } from '@/lib/demo-data'

const workspaceTabs = [
  { id: 'protocol', label: 'Protocol' },
  { id: 'about', label: 'About' },
] as const

type WorkspaceTabId = (typeof workspaceTabs)[number]['id']

const heroStats = [
  {
    label: 'Encrypted votes this epoch',
    value: String(demoEpoch.hiddenVotes),
  },
  {
    label: `Weekly ${brand.governanceTokenSymbol} emissions`,
    value: `${demoEpoch.weeklyEmission}`,
  },
  {
    label: 'Active liquidity lanes',
    value: String(demoPools.length),
  },
]

const heroTags = [
  'Confidential gauge routing',
  'On-chain swap execution',
  'LP-powered weekly emissions',
]

export function LandingShell() {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('protocol')

  return (
    <main className="page-shell">
      <section className="panel top-surface-nav" id="protocol-workspace">
        <div className="tab-row workspace-tab-row" role="tablist" aria-label="Workspace sections">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              aria-selected={activeTab === tab.id}
              className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="brand-bar">
        <div className="brand-lockup">
          <LogoMark className="brand-logo" />
          <div className="brand-meta">
            <p className="eyebrow">{brand.descriptor}</p>
            <h2 className="brand-title">{brand.protocol}</h2>
          </div>
        </div>
        <div className="brand-links">
          <span className="brand-pill">ve-style emissions</span>
          <span className="brand-pill">shadow gauges</span>
          <span className="brand-pill">swap + LP rails</span>
        </div>
      </section>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-frame">
            <p className="eyebrow">{brand.short}</p>
            <h1>Shadow liquidity, loud market presence.</h1>
            <p className="hero-text">
              {brand.protocol} is a Fhenix-native coordination surface for encrypted gauge voting, live swaps, and LP
              formation. It brings Curve and Aerodrome style emissions into a sharper interface built around hidden
              intent and visible market action.
            </p>

            <div className="hero-actions">
              <a className="hero-action" href="#protocol-workspace">
                Enter control surface
              </a>
              <p className="hero-note">
                {brand.governanceTokenSymbol} governs emissions, {brand.veGovernanceTokenSymbol} decays over time, and
                gauge intent stays hidden until epoch reveal.
              </p>
            </div>

            <div className="hero-tags">
              {heroTags.map((tag) => (
                <span className="hero-tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <article className="spotlight-card">
            <div className="spotlight-header">
              <span className="eyebrow">Market signal</span>
              <span className="brand-badge">Built on Fhenix CoFHE</span>
            </div>
            <div className="spotlight-values">
              <strong>{brand.protocol}</strong>
              <p>
                A confidential liquidity stack with live pool mechanics, ve-style routing, and epoch settlement in a
                single surface.
              </p>
            </div>
          </article>

          {heroStats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div className="stack">
          {activeTab === 'protocol' ? <ProtocolTabs /> : <ArchitecturePanel />}
        </div>
      </section>
    </main>
  )
}
