'use client'

import { useMemo, useCallback } from 'react'
import SettingsCrudList from './SettingsCrudList'

type Platform = { id: string; name: string; sort_order: number }
type PlatformForm = { name: string }

const EMPTY_FORM: PlatformForm = { name: '' }

const ArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
)

const ArrowDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

export default function SettingsPlatforms() {
  return (
    <SettingsCrudList<Platform, PlatformForm>
      config={{
        title: 'Platforms',
        table: 'platforms',
        itemLabel: 'Platform',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} platforms`,
        tableColumns: [
          { label: 'Name', width: '50%' },
          { label: 'Todos', width: '15%' },
          { label: 'Order', width: '15%', align: 'center' },
          { label: 'Actions', width: '20%', align: 'right' },
        ],

        load: async (supabase) => {
          const [platformsRes, todoPlatsRes] = await Promise.all([
            supabase.from('platforms').select('*').order('sort_order'),
            supabase.from('todo_platforms').select('platform_id'),
          ])
          const counts: Record<string, number> = {}
          todoPlatsRes.data?.forEach((tp: any) => {
            if (tp.platform_id) counts[tp.platform_id] = (counts[tp.platform_id] || 0) + 1
          })
          return { items: platformsRes.data ?? [], extra: { todoCounts: counts } }
        },

        validate: (form, items, editingId) => {
          const name = form.name.trim().toLowerCase()
          if (!name) return 'Name is required'
          if (items.some(p => p.id !== editingId && p.name.toLowerCase() === name))
            return 'A platform with this name already exists'
          return null
        },
        toRecord: (form) => ({
          name: form.name.trim(),
          sort_order: 0,
        }),
        toForm: item => ({ name: item.name }),
        getId: item => item.id,

        onAdd: async (supabase, record, items) => {
          const maxOrder = items.reduce((max, item) => Math.max(max, item.sort_order), 0)
          await supabase.from('platforms').insert({ ...record, sort_order: maxOrder + 1 })
        },

        onDelete: async (supabase, item, items) => {
          await supabase.from('todo_platforms').delete().eq('platform_id', item.id)
          await supabase.from('platforms').delete().eq('id', item.id)
          const remaining = items.filter(p => p.id !== item.id).sort((a, b) => a.sort_order - b.sort_order)
          await Promise.all(remaining.map((p, i) =>
            supabase.from('platforms').update({ sort_order: i + 1 }).eq('id', p.id)
          ))
        },
        deleteWarning: (item, extra) => {
          const count = extra.todoCounts?.[item.id] ?? 0
          return (
            <>
              Delete <strong>{item.name}</strong>?
              {count > 0 && (
                <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                  This will also remove associations from {count} todo{count !== 1 ? 's' : ''}.
                </span>
              )}
            </>
          )
        },
        canDelete: () => true,

        onMove: async (supabase, item, items, direction) => {
          const idx = items.findIndex(p => p.id === item.id)
          if (direction === 'up' && idx === 0) return
          if (direction === 'down' && idx === items.length - 1) return
          const other = items[direction === 'up' ? idx - 1 : idx + 1]
          const tempOrder = -999
          const { error: err1 } = await supabase.from('platforms').update({ sort_order: tempOrder }).eq('id', item.id)
          if (err1) throw err1
          const { error: err2 } = await supabase.from('platforms').update({ sort_order: item.sort_order }).eq('id', other.id)
          if (err2) {
            await supabase.from('platforms').update({ sort_order: item.sort_order }).eq('id', item.id)
            throw err2
          }
          const { error: err3 } = await supabase.from('platforms').update({ sort_order: other.sort_order }).eq('id', item.id)
          if (err3) throw err3
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving }) => (
          <div className="s-form" style={{ padding: '12px 16px' }}>
            <div className="mb-md">
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => onChange({ ...form, name: e.target.value })}
                autoFocus
                placeholder="Platform name (e.g. Web, iOS, Android)"
              />
            </div>
            <div className="flex-row gap-sm">
              <button className="btn-primary" onClick={onSubmit} disabled={saving}>
                {saving ? 'Saving…' : submitLabel}
              </button>
              <button className="btn-cancel" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        ),

        renderRow: ({ item, index, items, onEdit, onDelete, onMove, saving, extra }) => {
          const isFirst = index === 0
          const isLast = index === items.length - 1
          return (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="audit-td" style={{ fontWeight: 500 }}>
                {item.name}
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {extra.todoCounts?.[item.id] ?? 0} todos
              </td>
              <td className="audit-td" style={{ textAlign: 'center' }}>
                <div className="flex-center" style={{ gap: '2px', justifyContent: 'center' }}>
                  {!isFirst && (
                    <button className="btn-move" onClick={() => onMove?.('up')} disabled={saving} title="Move Up">
                      <ArrowUp />
                    </button>
                  )}
                  {!isLast && (
                    <button className="btn-move" onClick={() => onMove?.('down')} disabled={saving} title="Move Down">
                      <ArrowDown />
                    </button>
                  )}
                </div>
              </td>
              <td className="audit-td" style={{ textAlign: 'right' }}>
                <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                  <button className="text-btn" onClick={onEdit} style={{ fontSize: '12px', padding: '4px' }}>Edit</button>
                  <button className="text-btn" onClick={onDelete} style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}>Delete</button>
                </div>
              </td>
            </tr>
          )
        },
      }}
    />
  )
}
