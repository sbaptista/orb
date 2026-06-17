'use client'

import { useState } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getMemoryEntries, updateMemoryEntry, deleteMemoryEntry } from '@/app/actions/get-memory-entries'

type MemoryEntry = {
  id: string
  track: string
  category: string
  content: string
  context: string | null
  confidence: number
  expires_at: string | null
  created_at: string
  updated_at: string
}

type MemoryForm = {
  content: string
}

const EMPTY_FORM: MemoryForm = { content: '' }
const PAGE_SIZE = 25

const TRACK_LABELS: Record<string, string> = {
  autonomous: 'Auto',
  offered: 'Confirmed',
}
const CATEGORY_LABELS: Record<string, string> = {
  pattern: 'Pattern',
  rhythm: 'Rhythm',
  preference: 'Preference',
  emotional: 'Emotional',
  milestone: 'Milestone',
}

export default function SettingsMemory() {
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showCreatedFilter, setShowCreatedFilter] = useState(false)
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter | null>(null)

  const hasAnyFilter = !!textSearchTerm || !!createdFilter

  function resetAll() {
    setTextSearchTerm('')
    setCreatedFilter(null)
  }

  return (
    <>
    <SettingsCrudList<MemoryEntry, MemoryForm>
      config={{
        title: 'Orb Memory',
        table: 'orb_memory',
        itemLabel: 'Memory',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        subtitle: (_items, total, pageInfo) => {
          if (!total) return 'No memories found.'
          const ps = pageInfo?.pageSize ?? PAGE_SIZE
          const pg = pageInfo?.page ?? 0
          const start = pg * ps + 1
          const end = Math.min(start + _items.length - 1, total)
          if (start === end) return `Memory ${start} of ${total}.`
          return `Memories ${start}–${end} of ${total}.`
        },
        externalSearchTerm: textSearchTerm,
        searchCaption: 'Search by text, date, or both',
        externalFilterKey: `${createdFilter?.from ?? ''}|${createdFilter?.to ?? ''}|${createdFilter?.before ?? ''}`,
        onResetFilters: resetAll,
        toolbarExtra: (
          <>
            <button type="button" className="btn-primary" onClick={() => setShowTextSearch(true)}>
              {textSearchTerm || 'Search by Text'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreatedFilter(true)}
              aria-label={createdFilter ? `Change date filter: ${createdFilter.label}` : 'Search by date'}
            >
              {createdFilter ? (
                createdFilter.label2 ? (
                  <span className="audit-date-stack">
                    <span>{createdFilter.label} –</span>
                    <span>{createdFilter.label2}</span>
                  </span>
                ) : createdFilter.label
              ) : 'Search by Date'}
            </button>
            {hasAnyFilter && (
              <button type="button" className="btn-primary" onClick={resetAll}>
                Reset
              </button>
            )}
          </>
        ),
        tableColumns: [
          { label: 'Track',    width: '90px' },
          { label: 'Category', width: '110px' },
          { label: 'Content',  width: '420px' },
          { label: 'Date',     width: '120px' },
        ],

        load: async (_supabase, pagination) => {
          const result = await getMemoryEntries({
            page: pagination?.page,
            pageSize: pagination?.pageSize,
            search: pagination?.search,
            createdFrom: createdFilter?.from,
            createdTo: createdFilter?.to,
            createdBefore: createdFilter?.before,
          })
          return {
            items: (result.data ?? []) as MemoryEntry[],
            totalCount: result.count ?? 0,
          }
        },

        validate: (form) => {
          if (!form.content.trim()) return 'Content is required'
          return null
        },

        toRecord: (form) => ({
          content: form.content.trim(),
        }),

        toForm: (item) => ({
          content: item.content,
        }),

        getId: (item) => item.id,

        hideAdd: true,

        onSave: async (_supabase, id, record) => {
          const result = await updateMemoryEntry(id, record.content)
          if (result.error) throw new Error(result.error)
        },

        onDelete: async (_supabase, item) => {
          const result = await deleteMemoryEntry(item.id)
          if (result.error) throw new Error(result.error)
        },

        deleteWarning: (item) => (
          <>Delete <strong>{item.content.slice(0, 40)}{item.content.length > 40 ? '…' : ''}</strong>?</>
        ),

        bulkDelete: {
          canSelect: () => true,
          confirmMessage: (count: number) => `Delete ${count} memor${count > 1 ? 'ies' : 'y'}? The Orb will not re-save deleted memories.`,
          onDelete: async (supabase: any, items: MemoryEntry[]) => {
            for (const item of items) {
              const result = await deleteMemoryEntry(item.id)
              if (result.error) return { error: result.error }
            }
            return {}
          },
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving }) => (
          <>
            <div className="mb-md">
              <label className="label">Content</label>
              <textarea
                className="input"
                value={form.content}
                onChange={e => onChange({ ...form, content: e.target.value })}
                placeholder="Memory content"
                rows={4}
                autoFocus
                style={{ resize: 'vertical', lineHeight: 'var(--lh-normal)' }}
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

        renderRow: ({ item, onEdit, checkbox }) => (
          <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            {checkbox}
            <td className="audit-td">
              <span style={{
                padding: '2px 8px',
                borderRadius: '8px',
                background: item.track === 'offered' ? 'var(--accent-green-bg)' : 'var(--bg-hover)',
                color: item.track === 'offered' ? 'var(--accent-green)' : 'var(--muted)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 'var(--fw-medium)',
              }}>
                {TRACK_LABELS[item.track] ?? item.track}
              </span>
            </td>
            <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text2)' }}>
              {CATEGORY_LABELS[item.category] ?? item.category}
            </td>
            <td className="audit-td" style={{ color: 'var(--text)', maxWidth: '480px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.content}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)' }}>
              {new Date(item.created_at).toLocaleDateString()}
              {item.expires_at && (
                <span style={{ display: 'block', opacity: 0.7 }}>
                  exp {new Date(item.expires_at).toLocaleDateString()}
                </span>
              )}
            </td>
          </tr>
        ),
      }}
    />

    <TextSearchModal
      open={showTextSearch}
      onClose={() => setShowTextSearch(false)}
      onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
      onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
      currentTerm={textSearchTerm}
      placeholder="Search memories then press"
      ariaLabel="Search memories"
    />

    <DateSearchModal
      open={showCreatedFilter}
      onClose={() => setShowCreatedFilter(false)}
      onApply={filter => { setCreatedFilter(filter); setShowCreatedFilter(false) }}
      onClear={() => { setCreatedFilter(null); setShowCreatedFilter(false) }}
      currentFilter={createdFilter}
    />
    </>
  )
}
