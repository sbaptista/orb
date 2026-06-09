'use client'

import SettingsCrudList from './SettingsCrudList'

type KnowledgeEntry = {
  id: string
  product_id: string
  origin_todo_id: string | null
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
  projects: { name: string; code: string } | null
}

type KnowledgeForm = {
  title: string
  content: string
  tags: string
  product_id: string
}

const EMPTY_FORM: KnowledgeForm = { title: '', content: '', tags: '', product_id: '' }

export default function SettingsKnowledge() {
  return (
    <SettingsCrudList<KnowledgeEntry, KnowledgeForm>
      config={{
        title: 'Knowledge Repository',
        table: 'knowledge_repo',
        itemLabel: 'Entry',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} entr${items.length !== 1 ? 'ies' : 'y'}`,
        searchPlaceholder: 'Filter by title, content, project, or tag…',
        searchFilter: (item: KnowledgeEntry, query: string) => {
          const q = query.toLowerCase()
          if (item.title.toLowerCase().includes(q)) return true
          if (item.content.toLowerCase().includes(q)) return true
          if (item.projects?.code?.toLowerCase().includes(q)) return true
          if (item.projects?.name?.toLowerCase().includes(q)) return true
          if (item.tags?.some(t => t.toLowerCase().includes(q))) return true
          return false
        },
        tableColumns: [
          { label: 'Project', width: '10%', sortKey: 'project', sortValue: (e: KnowledgeEntry) => e.projects?.code ?? '' },
          { label: 'Title',   width: '30%', sortKey: 'title',   sortValue: (e: KnowledgeEntry) => e.title },
          { label: 'Content', width: '35%' },
          { label: 'Tags',    width: '10%' },
          { label: 'Actions', width: '15%' },
        ],

        load: async (supabase) => {
          const [{ data: entries }, { data: projects }] = await Promise.all([
            supabase
              .from('knowledge_repo')
              .select('*, projects(name, code)')
              .order('created_at', { ascending: false }),
            supabase
              .from('projects')
              .select('id, name, code')
              .eq('is_dormant', false)
              .order('sort_order'),
          ])
          return {
            items: (entries ?? []) as KnowledgeEntry[],
            extra: { projects: projects ?? [] },
          }
        },

        validate: (form) => {
          if (!form.title.trim()) return 'Title is required'
          if (!form.content.trim()) return 'Content is required'
          if (!form.product_id) return 'Project is required'
          return null
        },

        toRecord: (form) => ({
          title: form.title.trim(),
          content: form.content.trim(),
          tags: form.tags.trim() ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          product_id: form.product_id,
        }),

        toForm: (item) => ({
          title: item.title,
          content: item.content,
          tags: item.tags?.join(', ') ?? '',
          product_id: item.product_id ?? '',
        }),

        getId: (item) => item.id,

        deleteWarning: (item) => (
          <>Delete knowledge entry <strong>{item.title}</strong>? This cannot be undone.</>
        ),

        bulkDelete: {
          canSelect: () => true,
          confirmMessage: (count: number) => `Permanently delete ${count} knowledge entr${count > 1 ? 'ies' : 'y'}? This cannot be undone.`,
          onDelete: async (supabase: any, items: KnowledgeEntry[]) => {
            const ids = items.map(e => e.id)
            const { error } = await supabase.from('knowledge_repo').delete().in('id', ids)
            return error ? { error: error.message } : {}
          },
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving, extra }) => (
          <>
            <div className="grid-2col mb-md">
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={e => onChange({ ...form, title: e.target.value })}
                  autoFocus
                  placeholder="What was learned"
                />
              </div>
              <div>
                <label className="label">Project *</label>
                <select
                  className="input"
                  style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                  value={form.product_id}
                  onChange={e => onChange({ ...form, product_id: e.target.value })}
                >
                  <option value="">— Select Project</option>
                  {extra.projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-md">
              <label className="label">Content *</label>
              <textarea
                className="input"
                value={form.content}
                onChange={e => onChange({ ...form, content: e.target.value })}
                placeholder="The knowledge or lesson learned"
                rows={4}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            <div className="mb-lg">
              <label className="label">Tags</label>
              <input
                className="input"
                value={form.tags}
                onChange={e => onChange({ ...form, tags: e.target.value })}
                placeholder="Comma-separated tags"
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

        renderRow: ({ item, onEdit, onDelete, checkbox }) => (
          <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            {checkbox}
            <td className="audit-td" style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text2)', fontSize: '12px' }}>
              {item.projects?.code ?? <span style={{ opacity: 0.4 }}>—</span>}
            </td>
            <td className="audit-td" style={{ fontWeight: 500 }}>
              {item.title}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.content}
            </td>
            <td className="audit-td" style={{ fontSize: '11px' }}>
              {item.tags?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {item.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: 'var(--bg-hover)',
                      color: 'var(--muted)',
                      fontSize: '10px',
                    }}>{tag}</span>
                  ))}
                </div>
              ) : (
                <span style={{ opacity: 0.4 }}>—</span>
              )}
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
