'use client'

import SettingsCrudList from './SettingsCrudList'

type Status = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }
type StatusForm = { name: string }

const EMPTY_FORM: StatusForm = { name: '' }

export default function SettingsStatuses() {
  return (
    <SettingsCrudList<Status, StatusForm>
      config={{
        title: 'Statuses',
        table: 'statuses',
        itemLabel: 'Status',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} statuses`,
        tableColumns: [
          { label: 'Name', width: '30%' },
          { label: 'Type', width: '20%' },
          { label: 'Todos', width: '20%' },
          { label: 'Actions', width: '30%' },
        ],

        load: async (supabase) => {
          const [statusRes, todoRes] = await Promise.all([
            supabase.from('statuses').select('*').order('sort_order'),
            supabase.from('todos').select('status'),
          ])
          const nameCounts: Record<string, number> = {}
          todoRes.data?.forEach((t: any) => {
            if (t.status) nameCounts[t.status] = (nameCounts[t.status] || 0) + 1
          })
          const idCounts: Record<string, number> = {}
          statusRes.data?.forEach((s: any) => {
            idCounts[s.id] = nameCounts[s.name] || 0
          })
          return { items: statusRes.data ?? [], extra: { todoCounts: idCounts } }
        },

        validate: (form, items, editingId) => {
          const name = form.name.trim().toLowerCase()
          if (!name) return 'Name is required'
          if (items.some(s => s.id !== editingId && s.name.toLowerCase() === name))
            return 'A status with this name already exists'
          return null
        },
        toRecord: (form) => ({
          name: form.name.trim().toLowerCase(),
          sort_order: 0,
        }),
        toForm: item => ({ name: item.name }),
        getId: item => item.id,

        onAdd: async (supabase, record, items) => {
          const closed = items.find(s => s.is_closed)!
          await supabase.from('statuses').update({ sort_order: closed.sort_order + 1 }).eq('id', closed.id)
          await supabase.from('statuses').insert({ ...record, sort_order: closed.sort_order })
        },

        onDelete: async (supabase, item, items) => {
          await supabase.from('statuses').delete().eq('id', item.id)
          const remaining = items.filter(s => s.id !== item.id).sort((a, b) => a.sort_order - b.sort_order)
          await Promise.all(remaining.map((s, i) =>
            supabase.from('statuses').update({ sort_order: i + 1 }).eq('id', s.id)
          ))
        },
        deleteWarning: (item, extra) => {
          if (item.is_open || item.is_closed) {
            return (
              <>
                Cannot delete <strong>{item.name}</strong> — it is the
                {item.is_open ? ' entry-point' : ' closing'} status.
              </>
            )
          }
          const count = extra.todoCounts?.[item.id] ?? 0
          return (
            <>
              Delete <strong>{item.name}</strong>?
              {count > 0 && (
                <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                  Cannot delete — {count} todo{count !== 1 ? 's' : ''} use this status.
                </span>
              )}
            </>
          )
        },
        canDelete: (item, extra) => {
          if (item.is_open || item.is_closed) return false
          return (extra.todoCounts?.[item.id] ?? 0) === 0
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving }) => (
          <>
            <div className="mb-md">
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => onChange({ ...form, name: e.target.value })}
                autoFocus
                placeholder="Status name (e.g. in_progress, on_hold)"
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
            <td className="audit-td">
              {(item.is_open || item.is_closed) ? (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  background: 'var(--bg3)',
                  color: 'var(--text2)',
                }}>
                  {item.is_open ? 'Open' : 'Closed'}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>
              )}
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
