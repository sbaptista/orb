'use client'

import SettingsCrudList from './SettingsCrudList'

type Platform = { id: string; name: string; sort_order: number }
type PlatformForm = { name: string }

const EMPTY_FORM: PlatformForm = { name: '' }

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
          { label: 'Todos', width: '20%' },
          { label: 'Actions', width: '30%' },
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

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving }) => (
          <>
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
          </>
        ),

        renderRow: ({ item, onEdit, onDelete, extra }) => (
          <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <td className="audit-td" style={{ fontWeight: 500 }}>
              {item.name}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {extra.todoCounts?.[item.id] ?? 0} todos
            </td>
            <td className="audit-td" onClick={e => e.stopPropagation()} style={{ overflow: 'visible' }}>
              <div className="action-cell">
                <button className="action-link" onClick={() => onEdit()}>Edit</button>
                <button className="action-link" onClick={onDelete} style={{ color: 'var(--error)' }}>Delete</button>
              </div>
            </td>
          </tr>
        ),
      }}
    />
  )
}
