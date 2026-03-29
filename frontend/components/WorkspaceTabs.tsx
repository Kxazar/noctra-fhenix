'use client'

import { useState } from 'react'

import { ArchitecturePanel } from '@/components/ArchitecturePanel'
import { ProtocolTabs } from '@/components/ProtocolTabs'
import { brand } from '@/lib/brand'

const tabs = [
  { id: 'protocol', label: 'Protocol' },
  { id: 'about', label: 'About' },
] as const

type WorkspaceTabId = (typeof tabs)[number]['id']

export function WorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('protocol')

  return (
    <section className="workspace-switcher" id="protocol-workspace">
      <div className="panel workspace-nav">
        <div className="panel-header workspace-nav-header">
          <div>
            <p className="eyebrow">{brand.protocol}</p>
            <h3>Protocol for interaction, About for mechanics</h3>
          </div>
          <p className="protocol-header-copy">
            Keep the execution surface clean when you want to use the product, and switch to About when you want the
            protocol architecture and flow explained in one place.
          </p>
        </div>

        <div className="tab-row workspace-tab-row" role="tablist" aria-label="Workspace sections">
          {tabs.map((tab) => (
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
      </div>

      {activeTab === 'protocol' ? <ProtocolTabs /> : <ArchitecturePanel />}
    </section>
  )
}
