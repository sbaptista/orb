'use client'

import { useId, useState } from 'react'

type Section = 'status' | 'history' | 'providers' | 'controls'
type HistoryScope = 'all' | 'product' | 'evals'
type HistoryRange = '30d' | '90d' | 'year'

const sections: Array<{ id: Section; label: string }> = [
  { id: 'status', label: 'Current Status' },
  { id: 'history', label: 'History' },
  { id: 'providers', label: 'Providers' },
  { id: 'controls', label: 'Controls' },
]

const runwayProviders = [
  {
    name: 'Anthropic API',
    status: 'Comfortable',
    tone: 'good',
    headline: '11 days',
    detail: '$22.40 estimated balance',
    burn: '$2.04 / day',
    comparison: '$1.72 / day over 30 days',
    note: 'Product use rose after the latest release.',
  },
  {
    name: 'OpenAI API',
    status: 'Add funds soon',
    tone: 'warning',
    headline: '4 days',
    detail: '$8.20 estimated balance',
    burn: '$2.15 / day',
    comparison: '$1.78 / day over 30 days',
    note: 'Voice use accounts for most of the increase.',
  },
  {
    name: 'Mistral API',
    status: 'Comfortable',
    tone: 'good',
    headline: '48 days',
    detail: '$9.70 estimated balance',
    burn: '$0.20 / day',
    comparison: '$0.18 / day over 30 days',
    note: 'Usage is steady.',
  },
  {
    name: 'ElevenLabs',
    status: 'On track',
    tone: 'neutral',
    headline: '18 days',
    detail: '91,000 characters remaining',
    burn: '5,100 chars / day',
    comparison: 'Renews August 18',
    note: 'Projected to finish with about 8% remaining.',
  },
]

const chartSeries = {
  all: [12, 18, 15, 26, 21, 32, 30, 38, 44, 40, 55, 50],
  product: [8, 11, 10, 17, 14, 20, 21, 24, 28, 27, 34, 32],
  evals: [4, 7, 5, 9, 7, 12, 9, 14, 16, 13, 21, 18],
}

function RunwayCard({ provider }: { provider: typeof runwayProviders[number] }) {
  return (
    <article className={`metrics-runway-card metrics-runway-card--${provider.tone}`}>
      <div className="metrics-runway-topline">
        <h3>{provider.name}</h3>
        <span className={`metrics-state-pill metrics-state-pill--${provider.tone}`}>{provider.status}</span>
      </div>
      <p className="metrics-runway-value">{provider.headline}</p>
      <p className="metrics-runway-caption">estimated runway</p>
      <div className="metrics-runway-facts">
        <span>{provider.detail}</span>
        <span>{provider.burn}</span>
        <span>{provider.comparison}</span>
      </div>
      <p className="metrics-runway-note">{provider.note}</p>
    </article>
  )
}

function CurrentStatus({ onGoHistory }: { onGoHistory: () => void }) {
  return (
    <div className="metrics-observability-stack">
      <section aria-labelledby="runway-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="runway-heading">Runway</h2>
            <p>How long each funded service can keep running at its recent pace.</p>
          </div>
          <div className="metrics-freshness">
            <span className="metrics-freshness-dot" aria-hidden="true" />
            Updated today at 8:14 PM
          </div>
        </div>
        <div className="metrics-runway-grid">
          {runwayProviders.map(provider => <RunwayCard key={provider.name} provider={provider} />)}
        </div>
      </section>

      <section aria-labelledby="change-heading">
        <h2 id="change-heading" className="s-section-title">What changed</h2>
        <div className="s-card metrics-change-card">
          <div className="metrics-change-marker" aria-hidden="true">↑</div>
          <div>
            <h3 className="s-card-title">Daily AI consumption is up 18%</h3>
            <p className="s-card-desc">Most of the change came from OpenAI voice and Anthropic product traffic. Evals remained within their usual range.</p>
          </div>
          <button type="button" className="pill" onClick={onGoHistory}>See history</button>
        </div>
      </section>

      <section aria-labelledby="subscriptions-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="subscriptions-heading">Subscriptions</h2>
            <p>Recurring AI services are operating costs, not consumable balances.</p>
          </div>
          <p className="metrics-subscription-total">$80 / month</p>
        </div>
        <div className="s-card metrics-subscription-list">
          {[
            ['Claude.ai', '$20 / month', 'Renews Aug 12'],
            ['ChatGPT', '$20 / month', 'Renews Aug 15'],
            ['Perplexity', '$20 / month', 'Renews Aug 21'],
            ['GitHub Copilot', '$20 / month', 'Renews Aug 28'],
          ].map(([name, cost, renewal]) => (
            <div className="metrics-details-row" key={name}>
              <span className="metrics-details-label">{name}</span>
              <span className="metrics-details-value">{cost}</span>
              <span className="metrics-subscription-renewal">{renewal}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SpendChart({ scope, range }: { scope: HistoryScope; range: HistoryRange }) {
  const titleId = useId()
  const descriptionId = useId()
  const points = chartSeries[scope]
  const max = 60
  const line = points.map((value, index) => {
    const x = 28 + (index * 544) / (points.length - 1)
    const y = 178 - (value / max) * 142
    return `${x},${y}`
  }).join(' ')
  const rangeText = range === '30d' ? '30 days' : range === '90d' ? '90 days' : '12 months'

  return (
    <div className="metrics-chart-shell">
      <div className="metrics-chart-heading">
        <div>
          <p className="metrics-chart-kicker">Total consumption</p>
          <p className="metrics-chart-total">${scope === 'all' ? '86.42' : scope === 'product' ? '54.18' : '32.24'}</p>
        </div>
        <p>Past {rangeText}</p>
      </div>
      <svg className="metrics-chart" viewBox="0 0 600 210" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>AI consumption trend</title>
        <desc id={descriptionId}>{scope} AI consumption over the past {rangeText}, rising gradually with a peak near the end.</desc>
        {[36, 83, 130, 178].map((y, index) => (
          <g key={y}>
            <line x1="28" y1={y} x2="572" y2={y} className="metrics-chart-gridline" />
            <text x="0" y={y + 4} className="metrics-chart-axis">${[60, 40, 20, 0][index]}</text>
          </g>
        ))}
        <path d={`M ${line.replaceAll(' ', ' L ')}`} className="metrics-chart-area" />
        <polyline points={line} className="metrics-chart-line" />
        {points.map((value, index) => {
          const x = 28 + (index * 544) / (points.length - 1)
          const y = 178 - (value / max) * 142
          return <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" className="metrics-chart-point" />
        })}
        <text x="28" y="204" className="metrics-chart-axis">Jul 1</text>
        <text x="282" y="204" className="metrics-chart-axis">Jul 15</text>
        <text x="530" y="204" className="metrics-chart-axis">Jul 30</text>
      </svg>
      <table className="metrics-chart-data">
        <caption>AI consumption chart values</caption>
        <thead><tr><th>Period</th>{points.map((_, index) => <th key={index}>{index + 1}</th>)}</tr></thead>
        <tbody><tr><th>Dollars</th>{points.map((value, index) => <td key={index}>{value}</td>)}</tr></tbody>
      </table>
    </div>
  )
}

function History() {
  const [scope, setScope] = useState<HistoryScope>('all')
  const [range, setRange] = useState<HistoryRange>('30d')

  return (
    <div className="metrics-observability-stack">
      <div className="metrics-history-toolbar" aria-label="History filters">
        <div className="metrics-pill-group">
          {([
            ['all', 'All consumption'],
            ['product', 'Product'],
            ['evals', 'Evals'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={`pill ${scope === value ? 'pill-active' : ''}`} onClick={() => setScope(value)} aria-pressed={scope === value}>{label}</button>
          ))}
        </div>
        <div className="metrics-pill-group">
          {([
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['year', '1 year'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={`pill ${range === value ? 'pill-active' : ''}`} onClick={() => setRange(value)} aria-pressed={range === value}>{label}</button>
          ))}
        </div>
      </div>

      <section aria-labelledby="consumption-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="consumption-heading">Consumption over time</h2>
            <p>Actual API and voice use, separated from recurring subscriptions.</p>
          </div>
        </div>
        <div className="s-card"><SpendChart scope={scope} range={range} /></div>
      </section>

      <section aria-labelledby="provider-history-heading">
        <h2 id="provider-history-heading" className="s-section-title">By provider</h2>
        <div className="s-card metrics-provider-bars">
          {[
            ['Anthropic API', '$38.64', 74],
            ['OpenAI API', '$29.18', 56],
            ['ElevenLabs', '$14.82', 29],
            ['Mistral API', '$3.78', 8],
          ].map(([name, amount, width]) => (
            <div className="metrics-provider-bar-row" key={name}>
              <div><span>{name}</span><strong>{amount}</strong></div>
              <div className="metrics-provider-bar-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Providers() {
  const [showImport, setShowImport] = useState(false)

  return (
    <div className="metrics-observability-stack">
      <section aria-labelledby="provider-sources-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="provider-sources-heading">Three views of the same system</h2>
            <p>Runtime use, available funding, and operating spend answer different questions.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowImport(value => !value)}>
            {showImport ? 'Close import preview' : 'Import statement'}
          </button>
        </div>
        <div className="metrics-provider-lanes">
          {[
            ['Runtime consumption', 'Orb request ledger', 'Automatic', 'Tokens, characters, roles, product and eval sources'],
            ['Funding', 'Provider balances + statements', 'Mixed', 'Prepaid credits and subscription quotas'],
            ['Operating spend', 'Card statements', 'Imported', 'Subscriptions and one-off AI purchases'],
          ].map(([title, source, mode, description]) => (
            <article className="s-card metrics-provider-lane" key={title}>
              <span className="metrics-provider-lane-mode">{mode}</span>
              <h3 className="s-card-title">{title}</h3>
              <p className="metrics-provider-lane-source">{source}</p>
              <p className="s-card-desc">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {showImport && (
        <section aria-labelledby="import-heading" className="metrics-import-preview">
          <div className="metrics-section-intro">
            <div>
              <h2 id="import-heading">Review statement import</h2>
              <p>Known charges are ready. Three unfamiliar descriptions need a home before anything is saved.</p>
            </div>
            <span className="metrics-state-pill metrics-state-pill--warning">3 to review</span>
          </div>
          <div className="s-card metrics-import-card">
            {[
              ['OPENAI *CHATGPT SUBSCR', '$20.00', 'ChatGPT', 'Subscription'],
              ['ANTHROPIC PBC', '$25.00', 'Anthropic', 'One-off credit'],
              ['ELEVENLABS.IO', '$22.00', 'ElevenLabs', 'Subscription'],
            ].map(([descriptor, amount, provider, kind]) => (
              <div className="metrics-import-row" key={descriptor}>
                <div className="metrics-import-charge">
                  <strong>{descriptor}</strong>
                  <span>{amount}</span>
                </div>
                <label>
                  <span className="label">Provider</span>
                  <select className="select" defaultValue={provider}>
                    <option>Anthropic</option><option>ChatGPT</option><option>ElevenLabs</option><option>OpenAI</option>
                  </select>
                </label>
                <label>
                  <span className="label">Kind</span>
                  <select className="select" defaultValue={kind}>
                    <option>Subscription</option><option>One-off credit</option><option>Prepaid funding</option><option>Exclude</option>
                  </select>
                </label>
              </div>
            ))}
            <div className="metrics-import-actions">
              <p>Prototype only — no statement rows will be saved.</p>
              <button type="button" className="btn-primary" disabled>Import 3 charges</button>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="reconciliation-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="reconciliation-heading">Reconciliation</h2>
            <p>Where Orb&apos;s estimate and the provider&apos;s reported consumption diverge.</p>
          </div>
        </div>
        <div className="s-card metrics-reconciliation-prototype">
          {[
            ['Anthropic API', 'Orb $38.64', 'Provider $39.02', '+$0.38', 'Matched'],
            ['OpenAI API', 'Orb $29.18', 'Provider $31.44', '+$2.26', 'Review'],
            ['Mistral API', 'Orb $3.78', 'Provider $3.78', '$0.00', 'Matched'],
          ].map(([provider, orb, reported, variance, state]) => (
            <div className="metrics-reconciliation-row" key={provider}>
              <div className="metrics-reconciliation-main"><strong>{provider}</strong><span className="s-card-desc">{orb} · {reported}</span></div>
              <span className="metrics-reconciliation-amount">{variance}</span>
              <span className={`metrics-state-pill metrics-state-pill--${state === 'Review' ? 'warning' : 'good'}`}>{state}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Controls() {
  return (
    <div className="metrics-observability-stack">
      <section aria-labelledby="warnings-heading">
        <h2 id="warnings-heading" className="s-section-title">Warnings</h2>
        <div className="s-card metrics-controls-card">
          <div className="metrics-control-row">
            <div><h3 className="s-card-title">Runway warning</h3><p className="s-card-desc">Warn when prepaid funding is projected to run out soon.</p></div>
            <label><span className="label">Days remaining</span><input className="input" type="number" defaultValue="7" /></label>
          </div>
          <div className="metrics-control-row">
            <div><h3 className="s-card-title">Subscription quota warning</h3><p className="s-card-desc">Warn when less than this share of the period remains.</p></div>
            <label><span className="label">Remaining</span><select className="select" defaultValue="15"><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option></select></label>
          </div>
          <div className="metrics-control-row">
            <div><h3 className="s-card-title">Notify through</h3><p className="s-card-desc">Warnings remain visible in Current Status as well as the selected channels.</p></div>
            <div className="metrics-checkboxes">
              <label><input type="checkbox" className="checkbox" defaultChecked /> Push</label>
              <label><input type="checkbox" className="checkbox" defaultChecked /> Email</label>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="models-heading">
        <h2 id="models-heading" className="s-section-title">Model roles</h2>
        <div className="s-card metrics-controls-card">
          <div className="metrics-control-row">
            <div><h3 className="s-card-title">Operational</h3><p className="s-card-desc">Task management, queries, and everyday Orb work.</p></div>
            <select className="select" defaultValue="haiku"><option value="haiku">Claude Haiku 4.5</option><option value="mistral">Mistral Medium</option></select>
          </div>
          <div className="metrics-control-row">
            <div><h3 className="s-card-title">Strategic</h3><p className="s-card-desc">Prioritization, synthesis, and guidance.</p></div>
            <select className="select" defaultValue="gemini"><option value="gemini">Gemini 3.1 Pro</option><option value="claude">Claude Sonnet</option></select>
          </div>
          <label className="metrics-check-row"><input type="checkbox" className="checkbox" defaultChecked /><span><strong>Enable role-based routing</strong><small>Route requests to the model assigned to each role.</small></span></label>
        </div>
      </section>

      <section aria-labelledby="rate-heading">
        <div className="metrics-section-intro">
          <div>
            <h2 id="rate-heading">Cost assumptions</h2>
            <p>Rates used to estimate runtime consumption. Provider statements remain the source of truth for reconciliation.</p>
          </div>
          <button type="button" className="pill">Edit rates</button>
        </div>
        <div className="s-card metrics-rate-list">
          {[
            ['Claude Haiku 4.5', 'Anthropic', '$1.00 input · $5.00 output / 1M'],
            ['Gemini 3.1 Pro', 'Google', '$2.00 input · $12.00 output / 1M'],
            ['Mistral Medium', 'Mistral', '$0.40 input · $2.00 output / 1M'],
          ].map(([model, provider, rate]) => (
            <div className="metrics-details-row" key={model}>
              <span className="metrics-details-label">{provider}</span>
              <span className="metrics-details-value"><strong>{model}</strong><small>{rate}</small></span>
            </div>
          ))}
        </div>
      </section>

      <div className="metrics-prototype-note">
        <strong>Spend caps are intentionally absent.</strong>
        <span>The existing cap fields stay in code during the transition, but the rebuilt interface does not present them as provider truth.</span>
      </div>
    </div>
  )
}

export default function AiCostObservabilityPrototype() {
  const [section, setSection] = useState<Section>('status')

  return (
    <main className="metrics-observability-page">
      <div className="metrics-observability-frame">
        <header className="metrics-observability-header">
          <div>
            <div className="metrics-prototype-eyebrow"><span>Prototype</span> ORB-373</div>
            <h1>AI</h1>
            <p>Funding, consumption, and runway in one place.</p>
          </div>
          <div className="metrics-header-summary">
            <span>Estimated monthly AI cost</span>
            <strong>$166.42</strong>
            <small>$86.42 usage + $80 subscriptions</small>
          </div>
        </header>

        <nav className="metrics-observability-nav" aria-label="AI observability sections">
          {sections.map(item => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="metrics-prototype-data-note">
          Sample data for design review. Nothing here changes live settings or accounting.
        </div>

        {section === 'status' && <CurrentStatus onGoHistory={() => setSection('history')} />}
        {section === 'history' && <History />}
        {section === 'providers' && <Providers />}
        {section === 'controls' && <Controls />}
      </div>
    </main>
  )
}
