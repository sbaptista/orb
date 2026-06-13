'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import SkeletonRows from '@/components/ui/SkeletonRows'
import { useToast } from '@/components/ui/Toast'
import { getFrictionLogs, deleteFrictionLog } from '@/app/actions/friction-actions'

type OrbFriction = {
  id: string
  created_at: string
  product_id: string | null
  category: string
  summary: string
  detail: any
  conversation_snippet: string | null
}

export default function SettingsFriction() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  
  const [logs, setLogs] = useState<OrbFriction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getFrictionLogs()
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  async function handleGenerateTodo(log: OrbFriction) {
    setSaving(true)
    
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        let projId = log.product_id
        let projName = ''
        if (!projId) {
            const { data: myProj } = await supabase.from('projects').select('*').or(`created_by.eq.${user.id},created_by.is.null`).order('sort_order').limit(1).single()
            if (myProj) { projId = myProj.id; projName = myProj.name }
            else {
               const anyProj = await supabase.from('projects').select('id, name').limit(1).single()
               if (anyProj.data) { projId = anyProj.data.id; projName = anyProj.data.name }
            }
        } else {
            const p = await supabase.from('projects').select('name').eq('id', projId).single()
            if (p.data) projName = p.data.name
        }
        
        if (!projId) throw new Error("No project available to attach the todo to.")

        const { data: urgentPri, error: priErr } = await supabase
            .from('priorities')
            .select('value')
            .eq('is_urgent', true)
            .maybeSingle()

        const detailsStr = log.detail ? `\n\nDetails:\n${JSON.stringify(log.detail, null, 2)}` : ''
        const snippetStr = log.conversation_snippet ? `\n\nContext:\n${log.conversation_snippet}` : ''

        const { data: openStatus } = await supabase
            .from('statuses').select('name').eq('is_open', true).limit(1).single()

        const { error: insertErr } = await supabase.from('todos').insert({
            title: `[${log.category}] ${log.summary}`,
            description: `Auto-generated from Orb Issue log (${log.category}).${snippetStr}${detailsStr}`,
            status: openStatus?.name ?? 'open',
            priority_value: urgentPri?.value ?? null,
            product_id: projId
        })
        
        if (insertErr) throw insertErr

        const { error: deleteErr } = await deleteFrictionLog(log.id)
        if (deleteErr) throw new Error(deleteErr)

        toast.success(`Todo created in '${projName || 'Unknown'}' and issue cleared.`)
        setLogs(prev => prev.filter(l => l.id !== log.id))
    } catch (err: any) {
        toast.error(`Failed to create todo: ${err.message}`)
    } finally {
        setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this issue log?')) return
    setSaving(true)
    const res = await deleteFrictionLog(id)
    setSaving(false)
    if (res.error) {
        toast.error(`Failed to delete issue: ${res.error}`)
        return
    }
    toast.success('Issue deleted.')
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  if (loading) return <div className="s-loading"><SkeletonRows rows={3} /></div>

  return (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
            <h2 className="s-title" style={{ marginBottom: '4px' }}>Orb Issues</h2>
            <p className="text-sm text-muted">{logs.length} logged issues</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="s-card s-empty">No issues have been logged!</div>
      ) : (
        <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="audit-th" style={{ width: '15%' }}>Date</th>
                  <th className="audit-th" style={{ width: '15%' }}>Category</th>
                  <th className="audit-th" style={{ width: '35%' }}>Summary</th>
                  <th className="audit-th" style={{ width: '20%' }}>Context Snippet</th>
                  <th className="audit-th" style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="audit-td" style={{ color: 'var(--muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="audit-td">
                        <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '10px', 
                            fontSize: 'var(--fs-version)', 
                            textTransform: 'uppercase',
                            background: 'var(--bg3)',
                            color: 'var(--text2)'
                        }}>
                            {log.category}
                        </span>
                    </td>
                    <td className="audit-td" title={log.summary} style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>
                        {log.summary}
                        {log.detail && (
                            <div style={{ marginTop: '4px', fontSize: 'var(--fs-version)', color: 'var(--muted)', whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto', background: 'var(--bg)', padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                {JSON.stringify(log.detail)}
                            </div>
                        )}
                    </td>
                    <td className="audit-td" style={{ color: 'var(--text2)' }}>
                        {log.conversation_snippet ? (
                           <div style={{ fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                               &ldquo;{log.conversation_snippet}&rdquo;
                           </div>
                        ) : '—'}
                    </td>
                    <td className="audit-td" style={{ overflow: 'visible' }}>
                        <div className="action-cell">
                            <button
                                className="action-link"
                                onClick={() => handleGenerateTodo(log)}
                                disabled={saving}
                                title="Convert to an urgent Todo and clear log"
                            >
                              Create Todo
                            </button>
                            <button
                                className="action-link"
                                onClick={() => handleDelete(log.id)}
                                disabled={saving}
                                style={{ color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
