import { protocolHighlights } from '@/lib/demo-data'

const referenceRepos = [
  {
    label: 'marronjo/fhe-hook-template',
    href: 'https://github.com/marronjo/fhe-hook-template',
  },
  {
    label: 'FhenixProtocol/poc-shielded-stablecoin',
    href: 'https://github.com/FhenixProtocol/poc-shielded-stablecoin',
  },
  {
    label: 'FhenixProtocol/encrypted-secret-santa',
    href: 'https://github.com/FhenixProtocol/encrypted-secret-santa',
  },
]

export function ArchitecturePanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Protocol shape</p>
          <h3>Curve-style coordination, but with hidden intent</h3>
        </div>
      </div>

      <div className="architecture-grid">
        {protocolHighlights.map((item) => (
          <article className="architecture-card" key={item}>
            <p>{item}</p>
          </article>
        ))}
      </div>

      <div className="reference-strip">
        {referenceRepos.map((repo) => (
          <a className="reference-link" href={repo.href} key={repo.href} rel="noreferrer" target="_blank">
            {repo.label}
          </a>
        ))}
      </div>
    </section>
  )
}
