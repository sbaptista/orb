'use client'

import SettingsCrudList from './SettingsCrudList'

type Status = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }
type StatusForm = { name: string }

const EMPTY_FORM: StatusForm = { name: '' }

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
          { label: 'Type', width: '15%' },
          { label: 'Todos', width: '15%' },
          { label: 'Order', width: '15%', align: 'center' },
          { label: 'Actions', width: '25%', align: 'right' },
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

        onMove: async (supabase, item, items, direction) => {
          const idx = items.findIndex(s => s.id === item.id)
          if (direction === 'up' && idx === 0) return
          if (direction === 'down' && idx === items.length - 1) return
          const other = items[direction === 'up' ? idx - 1 : idx + 1]
          const tempOrder = -999
          const { error: err1 } = await supabase.from('statuses').update({ sort_order: tempOrder }).eq('id', item.id)
          if (err1) throw err1
          const { error: err2 } = await supabase.from('statuses').update({ sort_order: item.sort_order }).eq('id', other.id)
          if (err2) {
            await supabase.from('statuses').update({ sort_order: item.sort_order }).eq('id', item.id)
            throw err2
          }
          const { error: err3 } = await supabase.from('statuses').update({ sort_order: other.sort_order }).eq('id', item.id)
          if (err3) throw err3
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

        renderRow: ({ item, index, items, onEdit, onDelete, onMove, saving, extra }) => {
          const pinned = item.is_open || item.is_closed
          const isFirst = index === 0
          const isSecond = index === 1
          const isSecondLast = index === items.length - 2
          const isLast = index === items.length - 1
          return (
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
              <td className="audit-td" style={{ textAlign: 'center' }}>
                {!pinned && (
                  <div className="flex-center" style={{ gap: '2px', justifyContent: 'center' }}>
                    {!isSecond && (
                      <button className="btn-move" onClick={() => onMove?.('up')} disabled={saving} title="Move Up">
                        <ArrowUp />
                      </button>
                    )}
                    {!isSecondLast && (
                      <button className="btn-move" onClick={() => onMove?.('down')} disabled={saving} title="Move Down">
                        <ArrowDown />
                      </button>
                    )}
                  </div>
                )}
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
