'use client'

import { useRef, useState } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import SearchMatchIndicator from '@/components/ui/SearchMatchIndicator'
import CopyButton, { formatClipboardRecord } from '@/components/ui/CopyButton'
import { getKnowledgeEntries } from '@/app/actions/get-knowledge-entries'
import { logAudit } from '@/app/actions/log-audit'
import { collectSystemInfo } from '@/lib/system-info'
import { startInteraction } from '@/lib/performance/telemetry'
import { knowledgeSearchTerms, matchingKnowledgeTerms, type KnowledgeSearchMode } from '@/lib/knowledge-search'

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
const COPY_RESULTS_LIMIT = 10

function knowledgeClipboard(form: KnowledgeForm, item: KnowledgeEntry | null, extra: any, mode: 'add' | 'edit') {
  const project = extra.projects?.find((candidate: any) => candidate.id === form.product_id)
  const projectName = project
    ? `${project.name}${project.code && project.code !== project.name ? ` (${project.code})` : ''}`
    : form.product_id
  return formatClipboardRecord(mode === 'edit' ? 'Knowledge entry' : 'Knowledge entry draft', [
    ...(item ? [
      { label: 'ID', value: item.id },
      { label: 'Origin Todo ID', value: item.origin_todo_id },
    ] : []),
    { label: 'Project', value: projectName },
    { label: 'Title', value: form.title },
    { label: 'Content', value: form.content },
    { label: 'Tags', value: form.tags },
    ...(item ? [
      { label: 'Created', value: item.created_at },
      { label: 'Updated', value: item.updated_at },
    ] : []),
  ])
}

function knowledgeEntryClipboard(item: KnowledgeEntry) {
  const projectName = item.projects
    ? `${item.projects.name}${item.projects.code && item.projects.code !== item.projects.name ? ` (${item.projects.code})` : ''}`
    : item.product_id
  return formatClipboardRecord('Knowledge entry', [
    { label: 'ID', value: item.id },
    { label: 'Origin Todo ID', value: item.origin_todo_id },
    { label: 'Project', value: projectName },
    { label: 'Title', value: item.title },
    { label: 'Content', value: item.content },
    { label: 'Tags', value: item.tags?.join(', ') },
    { label: 'Created', value: item.created_at },
    { label: 'Updated', value: item.updated_at },
  ])
}

export default function SettingsKnowledge() {
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [textSearchMode, setTextSearchMode] = useState<KnowledgeSearchMode>('all')
  const placeTitleCaretAtStart = useRef(false)

  async function copySearchResults() {
    const measurement = startInteraction({
      focus: 'settings',
      flow: 'settings-knowledge_repo',
      interaction: 'copy_search_results',
      surface: 'Knowledge Repository',
      immediateFlush: true,
      metadata: { limit: COPY_RESULTS_LIMIT, matchMode: textSearchMode, termCount: knowledgeSearchTerms(textSearchTerm).length },
    })
    try {
      const result = await getKnowledgeEntries({
        page: 0,
        pageSize: COPY_RESULTS_LIMIT,
        search: textSearchTerm,
        searchMode: textSearchMode,
      })
      measurement.mark('search_results_loaded')
      if (result.error) throw new Error(result.error)
      const entries = (result.data ?? []) as KnowledgeEntry[]
      const total = result.count ?? entries.length
      measurement.end(true, null, { copiedCount: entries.length, totalCount: total })
      return [
        'KNOWLEDGE SEARCH RESULTS',
        '',
        'Query:',
        textSearchTerm,
        '',
        'Match:',
        textSearchMode === 'all' ? 'All terms' : 'Any term',
        '',
        'Copied:',
        `${entries.length} of ${total} matching entries${total > COPY_RESULTS_LIMIT ? ` (limited to ${COPY_RESULTS_LIMIT})` : ''}`,
        '',
        ...entries.flatMap((entry, index) => [
          index === 0 ? '' : '---',
          knowledgeEntryClipboard(entry),
          '',
        ]),
      ].join('\n').trim()
    } catch (error) {
      measurement.end(false, 'copy_results_failed', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  return (
    <>
    <SettingsCrudList<KnowledgeEntry, KnowledgeForm>
      config={{
        title: 'Knowledge Repository',
        table: 'knowledge_repo',
        itemLabel: 'Entry',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        subtitle: (_items, total, pageInfo) => {
          if (!total) return 'No entries found.'
          const ps = pageInfo?.pageSize ?? PAGE_SIZE
          const pg = pageInfo?.page ?? 0
          const start = pg * ps + 1
          const end = Math.min(start + _items.length - 1, total)
          if (start === end) return `Entry ${start} of ${total}.`
          return `Entries ${start}–${end} of ${total}.`
        },
        externalSearchTerm: textSearchTerm,
        externalFilterKey: `knowledge-match:${textSearchMode}`,
        searchCaption: 'Actions',
        onResetFilters: () => { setTextSearchTerm(''); setTextSearchMode('all') },
        toolbarExtra: (
          <>
            <button type="button" className={textSearchTerm ? 'btn-primary btn-primary-clamped' : 'btn-primary'} onClick={() => setShowTextSearch(true)}>
              {textSearchTerm || 'Search by Text'}
            </button>
            {textSearchTerm && (
              <CopyButton value={copySearchResults} fieldLabel="knowledge search results" label="Copy Results" compact={false} />
            )}
          </>
        ),
        tableColumns: [
          { label: 'Project', width: '170px', sortKey: 'project', sortValue: (e: KnowledgeEntry) => e.projects?.code ?? '' },
          { label: 'Title',   width: '170px', sortKey: 'title',   sortValue: (e: KnowledgeEntry) => e.title },
          { label: 'Content', width: '180px' },
          { label: 'Tags',    width: '170px' },
          { label: 'Actions', width: '170px' },
        ],

        load: async (_supabase, pagination) => {
          const result = await getKnowledgeEntries({
            page: pagination?.page,
            pageSize: pagination?.pageSize,
            search: pagination?.search,
            searchMode: textSearchMode,
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

        toForm: (item) => {
          placeTitleCaretAtStart.current = true
          return {
            title: item.title,
            content: item.content,
            tags: item.tags?.join(', ') ?? '',
            product_id: item.product_id ?? '',
          }
        },

        searchMatchFields: (form, term) => {
          const terms = knowledgeSearchTerms(term)
          return [
            { label: 'Title', value: form.title },
            { label: 'Content', value: form.content },
            { label: 'Tags', value: form.tags },
          ].map(field => ({ ...field, terms: matchingKnowledgeTerms([field.value], term) }))
            .filter(field => field.terms.length > 0 || terms.length === 0)
        },

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

        renderHeaderEnd: ({ form, extra, mode, item }) => (
          <CopyButton
            value={knowledgeClipboard(form, item, extra, mode)}
            fieldLabel="knowledge entry"
            label="Copy All"
            compact={false}
          />
        ),

        renderForm: ({ form, onChange, extra, searchMatches, onOpenSearchMatch }) => {
          const titleMatch = searchMatches.find(match => match.label === 'Title')
          const contentMatch = searchMatches.find(match => match.label === 'Content')
          const tagsMatch = searchMatches.find(match => match.label === 'Tags')
          const project = extra.projects?.find((candidate: any) => candidate.id === form.product_id)
          const projectName = project
            ? `${project.name}${project.code && project.code !== project.name ? ` (${project.code})` : ''}`
            : form.product_id
          return (
          <>
            <div className="grid-2col mb-md">
              <div>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                  <label className="label field-label-with-match" style={{ marginBottom: 0 }}>Title * {titleMatch && <SearchMatchIndicator fieldLabel="Title" onOpen={() => onOpenSearchMatch(titleMatch)} />}</label>
                  <CopyButton value={form.title} fieldLabel="title" />
                </div>
                <input
                  ref={input => {
                    if (!input || !placeTitleCaretAtStart.current) return
                    placeTitleCaretAtStart.current = false
                    requestAnimationFrame(() => {
                      input.focus()
                      input.setSelectionRange(0, 0)
                    })
                  }}
                  className="input"
                  value={form.title}
                  onChange={e => onChange({ ...form, title: e.target.value })}
                  autoFocus
                  placeholder="What was learned"
                />
              </div>
              <div>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Project *</label>
                  <CopyButton value={projectName} fieldLabel="project" />
                </div>
                <select
                  className="input"
                  style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                  value={form.product_id}
                  onChange={e => onChange({ ...form, product_id: e.target.value })}
                >
                  <option value="">— Select Project</option>
                  {extra.projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-md">
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                <label className="label field-label-with-match" style={{ marginBottom: 0 }}>Content * {contentMatch && <SearchMatchIndicator fieldLabel="Content" onOpen={() => onOpenSearchMatch(contentMatch)} />}</label>
                <CopyButton value={form.content} fieldLabel="content" />
              </div>
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
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                <label className="label field-label-with-match" style={{ marginBottom: 0 }}>Tags {tagsMatch && <SearchMatchIndicator fieldLabel="Tags" onOpen={() => onOpenSearchMatch(tagsMatch)} />}</label>
                <CopyButton value={form.tags} fieldLabel="tags" />
              </div>
              <input
                className="input"
                value={form.tags}
                onChange={e => onChange({ ...form, tags: e.target.value })}
                placeholder="Comma-separated tags"
              />
            </div>
          </>
          )
        },

        renderRow: ({ item, onEdit, onDelete, checkbox }) => {
          let contentSnippet: string = item.content
          if (textSearchTerm) {
            const lowerContent = item.content.toLowerCase()
            const idx = knowledgeSearchTerms(textSearchTerm)
              .map(term => lowerContent.indexOf(term))
              .filter(index => index >= 0)
              .sort((a, b) => a - b)[0] ?? -1
            if (idx > 15) {
              contentSnippet = '…' + item.content.slice(idx - 8)
            }
          }
          return (
          <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            {checkbox}
            <td className="audit-td" style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
              {item.projects ? (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{item.projects.code}</span>
                  {item.projects.name !== item.projects.code && (
                    <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 'var(--fw-normal)', fontFamily: 'var(--font-body)' }}>{item.projects.name}</span>
                  )}
                </>
              ) : <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>}
            </td>
            <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
              {item.title}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contentSnippet}
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
        )},
      }}
    />

    <TextSearchModal
      open={showTextSearch}
      onClose={() => setShowTextSearch(false)}
      onApply={(term, matchMode) => {
        setTextSearchTerm(term)
        setTextSearchMode(matchMode ?? 'all')
        setShowTextSearch(false)
      }}
      onClear={() => { setTextSearchTerm(''); setTextSearchMode('all'); setShowTextSearch(false) }}
      currentTerm={textSearchTerm}
      currentMatchMode={textSearchMode}
      placeholder="Search entries then press"
      ariaLabel="Search knowledge entries"
    />
    </>
  )
}
