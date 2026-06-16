'use client'

import SettingsCrudList from './SettingsCrudList'
import { getKnowledgeEntries } from '@/app/actions/get-knowledge-entries'
import { logAudit } from '@/app/actions/log-audit'
import { collectSystemInfo } from '@/lib/system-info'

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
const PAGE_SIZE = 25

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
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        subtitle: (items, total) => total ? `${items.length} of ${total} entr${total !== 1 ? 'ies' : 'y'}` : `${items.length} entr${items.length !== 1 ? 'ies' : 'y'}`,
        searchPlaceholder: 'Filter by title, content, project, or tag…',
        tableColumns: [
          { label: 'Project', width: '10%', sortKey: 'project', sortValue: (e: KnowledgeEntry) => e.projects?.code ?? '' },
          { label: 'Title',   width: '30%', sortKey: 'title',   sortValue: (e: KnowledgeEntry) => e.title },
          { label: 'Content', width: '35%' },
          { label: 'Tags',    width: '10%' },
          { label: 'Actions', width: '15%' },
        ],

        load: async (_supabase, pagination) => {
          const result = await getKnowledgeEntries({
            page: pagination?.page,
            pageSize: pagination?.pageSize,
            search: pagination?.search,
            sortKey: pagination?.sortKey,
            sortDir: pagination?.sortDir,
          })
          return {
            items: (result.data ?? []) as KnowledgeEntry[],
            extra: { projects: result.projects ?? [] },
            totalCount: result.count ?? 0,
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

        onAdd: async (supabase, record) => {
          const { data, error } = await supabase.from('knowledge_repo').insert(record).select('id').single()
          if (error) throw new Error(error.message)
          logAudit({ action: 'knowledge_create', table_name: 'knowledge_repo', record_id: data?.id, after: { title: record.title }, system_info: collectSystemInfo() })
        },

        onSave: async (supabase, id, record) => {
          const { error } = await supabase.from('knowledge_repo').update(record).eq('id', id)
          if (error) throw new Error(error.message)
          logAudit({ action: 'knowledge_update', table_name: 'knowledge_repo', record_id: id, after: { title: record.title }, system_info: collectSystemInfo() })
        },

        onDelete: async (supabase, item) => {
          const { error } = await supabase.from('knowledge_repo').delete().eq('id', item.id)
          if (error) throw new Error(error.message)
          logAudit({ action: 'knowledge_delete', table_name: 'knowledge_repo', record_id: item.id, before: { title: item.title }, system_info: collectSystemInfo() })
        },

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
                style={{ resize: 'vertical', lineHeight: 'var(--lh-normal)' }}
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
            <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
              {item.projects?.code ?? <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>}
            </td>
            <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
              {item.title}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.content}
            </td>
            <td className="audit-td">
              {item.tags?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {item.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: 'var(--bg-hover)',
                      color: 'var(--muted)',
                    }}>{tag}</span>
                  ))}
                </div>
              ) : (
                <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>
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
