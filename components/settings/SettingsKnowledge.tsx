'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'

type KnowledgeEntry = {
  id: string
  product_id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  projects: { name: string; code: string } | null
}

export default function SettingsKnowledge() {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadKnowledge = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const { data } = await supabase
      .from('knowledge_repo')
      .select('*, projects(name, code)')
      .order('created_at', { ascending: false })
    setEntries((data as KnowledgeEntry[]) ?? [])
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(() => loadKnowledge(false))
  
  useEffect(() => { 
    loadKnowledge(true) 
  }, [loadKnowledge])

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  }

  return (
    <div style={{ padding: 'var(--sp-2xl)', maxWidth: '960px' }}>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: '0 0 var(--sp-2xl)' }}>
        Knowledge Repository
      </h2>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--sp-3xl)', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
          No knowledge entries found. Distill some from your closed tasks!
        </div>
      ) : (
        <div style={cardStyle}>
          {entries.map((entry, i) => {
            const isExpanded = expandedId === entry.id
            return (
              <div 
                key={entry.id} 
                className="knowledge-row"
                style={{ 
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  transition: 'background var(--transition)',
                }}
              >
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  style={{
                    padding: 'var(--sp-md) var(--sp-lg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isExpanded ? 'var(--bg3)' : 'transparent',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ 
                      fontSize: 'var(--fs-base)', 
                      color: 'var(--text)', 
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {entry.title}
                    </p>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: '2px 0 0' }}>
                      {entry.projects?.code || 'TODOS'} · {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    color: 'var(--muted)',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition)'
                  }}>
                    ▶
                  </span>
                </div>
                
                {isExpanded && (
                  <div style={{ 
                    padding: '0 var(--sp-lg) var(--sp-lg)',
                    background: 'var(--bg3)',
                  }}>
                    <div style={{ 
                      paddingTop: 'var(--sp-sm)',
                      borderTop: '1px solid var(--border)',
                      fontSize: 'var(--fs-sm)', 
                      color: 'var(--text2)', 
                      whiteSpace: 'pre-wrap', 
                      lineHeight: 1.5 
                    }}>
                      {entry.content}
                    </div>
                    {entry.tags && entry.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginTop: 'var(--sp-md)' }}>
                        {entry.tags.map(tag => (
                          <span key={tag} style={{
                            fontSize: '10px',
                            background: 'var(--bg2)',
                            color: 'var(--text3)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .knowledge-row {
          transition: background 0.2s ease;
        }
        .knowledge-row:hover {
          background: var(--bg3);
        }
      `}</style>
    </div>
  )
}
