'use client'

import { CHANGELOG } from '@/lib/changelog'

export default function SettingsWhatsNew() {
  return (
    <div className="settings-page">
      <div className="s-header mb-xl">
        <h2 className="s-title">What's New</h2>
      </div>

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Vertical timeline line */}
        <div
          style={{
            position: 'absolute',
            left: '6px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            background: 'var(--border)',
            borderRadius: '1px',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {CHANGELOG.map((release, index) => (
            <div key={release.version} style={{ position: 'relative' }}>
              {/* Timeline circle point */}
              <div
                style={{
                  position: 'absolute',
                  left: '-24px',
                  top: '6px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: index === 0 ? 'var(--success)' : 'var(--bg3)',
                  border: index === 0 ? '4px solid var(--bg)' : '3px solid var(--bg)',
                  boxShadow: index === 0 ? '0 0 0 2px var(--border)' : 'none',
                  zIndex: 2,
                  transition: 'background 0.3s ease',
                }}
              />

              {/* Release Card */}
              <div className="s-card" style={{ padding: 'var(--sp-xl)', position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--sp-sm)',
                    marginBottom: 'var(--sp-md)',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 'var(--sp-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: index === 0 ? 'rgba(45, 90, 45, 0.08)' : 'var(--bg3)',
                        color: index === 0 ? 'var(--success)' : 'var(--text2)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {release.version}
                    </span>
                    {index === 0 && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--success)',
                          background: 'rgba(45, 90, 45, 0.05)',
                          border: '1px solid rgba(45, 90, 45, 0.15)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                        }}
                      >
                        Latest
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--muted)',
                      fontWeight: 500,
                    }}
                  >
                    {new Date(release.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 'var(--sp-lg)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text2)',
                    lineHeight: '1.7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    listStyleType: 'square',
                  }}
                >
                  {release.changes.map((change, cIdx) => (
                    <li key={cIdx} style={{ paddingLeft: '4px' }}>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
