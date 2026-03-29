import { ArchitecturePanel } from '@/components/ArchitecturePanel'
import { GaugeBoard } from '@/components/GaugeBoard'
import { LockPlanner } from '@/components/LockPlanner'
import { ModeStatus } from '@/components/ModeStatus'
import { StableMintPanel } from '@/components/StableMintPanel'
import { WalletPanel } from '@/components/WalletPanel'
import { demoEpoch, demoStablePosition } from '@/lib/demo-data'

const heroStats = [
  {
    label: 'Encrypted votes this epoch',
    value: String(demoEpoch.hiddenVotes),
  },
  {
    label: 'Weekly VEIL emissions',
    value: `${demoEpoch.weeklyEmission}`,
  },
  {
    label: 'vhUSD mint ceiling',
    value: `${demoStablePosition.maxMintableAt160}`,
  },
]

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">VeilFlow</p>
          <h1>Private liquidity governance with a shielded LP-backed stablecoin.</h1>
          <p className="hero-text">
            A Fhenix-native demo protocol that combines ve-style emissions, confidential gauge voting, wrapped
            encrypted token balances, and vhUSD minting against approved LP collateral at a 160% ratio.
          </p>
        </div>

        <div className="hero-stats">
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
          <ModeStatus />
          <LockPlanner />
          <GaugeBoard />
          <StableMintPanel />
        </div>

        <div className="stack stack-side">
          <WalletPanel />
          <ArchitecturePanel />
        </div>
      </section>
    </main>
  )
}
