'use client'

import SettingsCrudList from './SettingsCrudList'

type Priority = { id: string; label: string; value: number }
type PrioForm = { label: string }

const EMPTY_FORM: PrioForm = { label: '' }

export default function SettingsPriorities() {
  return (
    <SettingsCrudList<Priority, PrioForm>
      config={{
        title: 'Priorities',
        table: 'priorities',
        itemLabel: 'Priority',
        emptyForm: EMPTY_FORM,
        idColumn: 'value',
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} priorities`,
        tableColumns: [
          { label: '#', width: '10%', align: 'center' },
          { label: 'Label', width: '40%' },
          { label: 'Tasks', width: '20%' },
          { label: 'Actions', width: '30%', align: 'right' },
        ],

        load: async (supabase) => {
          const [prioRes, todoRes] = await Promise.all([
            supabase.from('priorities').select('*').order('value'),
            supabase.from('todos').select('priority_value'),
          ])
          const counts: Record<number, number> = {}
          todoRes.data?.forEach((t: any) => {
            if (t.priority_value !== null) counts[t.priority_value] = (counts[t.priority_value] || 0) + 1
          })
          return { items: prioRes.data ?? [], extra: { todoCounts: counts } }
        },

        validate: (form, items, editingId) => {
          const label = form.label.trim()
          if (!label) return 'Label is required'
          if (items.some(p => String(p.value) !== editingId && p.label.toLowerCase() === label.toLowerCase()))
            return 'A priority with this label already exists'
          return null
        },
        toRecord: (form, items) => ({ label: form.label.trim(), value: items.length + 1 }),
        toForm: item => ({ label: item.label }),
        getId: item => String(item.value),

        onDelete: async (supabase, item, items) => {
          await supabase.from('priorities').delete().eq('value', item.value)
          const higher = items.filter(p => p.value > item.value)
          if (higher.length > 0) {
            await Promise.all(higher.map(p =>
              supabase.from('priorities').update({ value: p.value - 1 }).eq('value', p.value)
            ))
          }
        },
        deleteWarning: (item, extra) => {
          const count = extra.todoCounts?.[item.value] ?? 0
          return (
            <>
              Delete <strong>{item.label}</strong>?
              {count > 0 && (
                <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                  Cannot delete — {count} todo{count !== 1 ? 's' : ''} use this priority.
                </span>
              )}
            </>
          )
        },
        canDelete: (item, extra) => (extra.todoCounts?.[item.value] ?? 0) === 0,

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving }) => (
          <>
            <div className="mb-md">
              <label className="label">Label *</label>
              <input
                className="input"
                value={form.label}
                onChange={e => onChange({ ...form, label: e.target.value })}
                autoFocus
                placeholder="Priority label"
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
          <tr key={String(item.value)} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <td className="audit-td" style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>
              {item.value}
            </td>
            <td className="audit-td" style={{ fontWeight: 500 }}>
              {item.label}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {extra.todoCounts?.[item.value] ?? 0} tasks
            </td>
            <td className="audit-td" style={{ textAlign: 'right' }}>
              <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                <button className="text-btn" onClick={onEdit} style={{ fontSize: '12px', padding: '4px' }}>Edit</button>
                <button className="text-btn" onClick={onDelete} style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}>Delete</button>
              </div>
            </td>
          </tr>
        ),
      }}
    />
  )
}
