'use client'

import { useId, useState } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import { getAdminProjects, getUserProjects, createProject, deleteProject, deleteProjects, updateProject } from '@/app/actions/manage-project'
import { listUsers } from '@/app/actions/list-users'

type Project = {
  id: string
  name: string
  code: string
  description: string | null
  is_dormant: boolean
  sort_order: number
  created_by: string
}

type ProjectForm = {
  name: string
  code: string
  description: string
  is_dormant: boolean
  ownerId: string
}

const EMPTY_FORM: ProjectForm = { name: '', code: '', description: '', is_dormant: false, ownerId: '' }
const PAGE_SIZE = 25
const PROJECT_CODE_MAX_LENGTH = 10

function getProjectCodeError(code: string, required: boolean): string | null {
  if (!code) return required ? 'Code is required for an existing project' : null
  if (code.length > PROJECT_CODE_MAX_LENGTH) return `Code must be ${PROJECT_CODE_MAX_LENGTH} characters or fewer`
  if (!/^[A-Z0-9]+$/.test(code)) return 'Code may only use uppercase letters and numbers'
  return null
}

function ProjectCodeInput({
  value,
  required,
  describedBy,
  onChange,
}: {
  value: string
  required: boolean
  describedBy: string
  onChange: (value: string) => void
}) {
  const [attemptError, setAttemptError] = useState<string | null>(null)
  const error = attemptError ?? getProjectCodeError(value, required)

  function handleChange(rawValue: string) {
    const uppercase = rawValue.toUpperCase()
    const validCharacters = uppercase.replace(/[^A-Z0-9]/g, '')

    if (uppercase !== validCharacters) {
      setAttemptError('Code may only use uppercase letters and numbers')
    } else if (validCharacters.length > PROJECT_CODE_MAX_LENGTH) {
      setAttemptError(`Code must be ${PROJECT_CODE_MAX_LENGTH} characters or fewer`)
    } else {
      setAttemptError(null)
    }

    onChange(validCharacters.slice(0, PROJECT_CODE_MAX_LENGTH))
  }

  return (
    <>
      <input
        className="input"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={required ? 'ORB' : 'Auto-generated'}
        maxLength={PROJECT_CODE_MAX_LENGTH + 1}
        aria-describedby={describedBy}
        aria-invalid={!!error}
        style={{ fontFamily: 'var(--font-mono)' }}
      />
      <p id={describedBy} className={error ? 'text-xs text-error' : 'text-xs text-muted'} role={error ? 'alert' : undefined} style={{ margin: 'var(--sp-xs) 0 0' }}>
        {error ?? `Uppercase letters and numbers only, maximum ${PROJECT_CODE_MAX_LENGTH} characters. Used in task references.`}
      </p>
    </>
  )
}

export default function SettingsProjects({ isAdmin = false, userId }: { isAdmin?: boolean; userId?: string }) {
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const projectCodeHelpId = useId()

  return (
    <>
    <SettingsCrudList<Project, ProjectForm>
      config={{
        title: 'Projects',
        table: 'projects',
        itemLabel: 'Project',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        subtitle: (_items, total, pageInfo) => {
          if (!total) return 'No projects found.'
          const ps = pageInfo?.pageSize ?? PAGE_SIZE
          const pg = pageInfo?.page ?? 0
          const start = pg * ps + 1
          const end = Math.min(start + _items.length - 1, total)
          if (start === end) return `Project ${start} of ${total}.`
          return `Projects ${start}–${end} of ${total}.`
        },
        externalSearchTerm: textSearchTerm,
        searchCaption: 'Search by text',
        onResetFilters: () => setTextSearchTerm(''),
        toolbarExtra: (
          <>
            <button type="button" className="btn-primary" onClick={() => setShowTextSearch(true)}>
              {textSearchTerm || 'Search by Text'}
            </button>
            {textSearchTerm && (
              <button type="button" className="btn-primary" onClick={() => setTextSearchTerm('')}>
                Reset
              </button>
            )}
          </>
        ),
        tableColumns: [
          { label: 'Code',        width: '90px',  sortKey: 'code',  sortValue: (p: Project) => p.code ?? '' },
          { label: 'Name',        width: '180px', sortKey: 'name',  sortValue: (p: Project) => p.name },
          { label: 'Description', width: '240px' },
          ...(isAdmin ? [
            { label: 'Owner',     width: '160px', sortKey: 'owner', sortValue: (p: Project, extra: any) => {
              const owner = extra.users?.find((u: any) => u.id === p.created_by)
              return owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email : ''
            }},
          ] : []),
          { label: 'Status',      width: '110px', align: 'center' as const },
          { label: 'Actions',     width: '140px' },
        ],

        load: async (_supabase, pagination) => {
          const paginationOpts = {
            page: pagination?.page,
            pageSize: pagination?.pageSize,
            search: pagination?.search,
          }
          const [projectsRes, usersRes] = await Promise.all([
            isAdmin ? getAdminProjects(paginationOpts) : getUserProjects(paginationOpts),
            isAdmin ? listUsers() : Promise.resolve({ users: [] }),
          ])
          return {
            items: (projectsRes.projects ?? []) as Project[],
            extra: { users: usersRes.users ?? [] },
            totalCount: projectsRes.count ?? 0,
          }
        },

        validate: (form, items, editingId) => {
          if (!form.name.trim()) return 'Name is required'
          const code = form.code.toUpperCase()
          const codeError = getProjectCodeError(code, !!editingId)
          if (codeError) return codeError
          if (code) {
            // Scope conflict check to same owner (per-user uniqueness)
            const targetOwner = form.ownerId || userId
            if (items.some(p => p.id !== editingId && p.code?.toUpperCase() === code && (!targetOwner || p.created_by === targetOwner)))
              return `Code "${code}" is already in use`
          }
          return null
        },

        toRecord: (form) => ({
          name: form.name.trim(),
          code: form.code || null,
          description: form.description.trim() || null,
          is_dormant: form.is_dormant,
          created_by: form.ownerId || null,
        }),

        toForm: (item) => ({
          name: item.name,
          code: item.code ?? '',
          description: item.description ?? '',
          is_dormant: item.is_dormant ?? false,
          ownerId: item.created_by ?? '',
        }),

        getId: (item) => item.id,

        onAdd: async (_supabase, record) => {
          const res = await createProject({
            name: record.name,
            code: record.code,
            description: record.description ?? null,
            ownerId: record.created_by,
          })
          if (res.error) throw new Error(res.error)
        },

        onSave: async (_supabase, id, record) => {
          const res = await updateProject(id, {
            name: record.name,
            code: record.code,
            description: record.description,
            is_dormant: record.is_dormant,
            created_by: record.created_by,
          })
          if (res.error) throw new Error(res.error)
        },

        onDelete: async (_supabase, item) => {
          const res = await deleteProject(item.id)
          if (res.error) throw new Error(res.error)
        },

        deleteWarning: (item) => (
          <>Delete project <strong>{item.name}</strong>? This will also delete all its todos.</>
        ),

        bulkDelete: {
          canSelect: () => true,
          confirmMessage: (count: number) => `Permanently delete ${count} project${count > 1 ? 's' : ''} and all their todos? This cannot be undone.`,
          onDelete: async (_supabase: any, items: Project[]) => {
            const res = await deleteProjects(items.map(p => p.id))
            return res.error ? { error: res.error } : {}
          },
        },

        renderForm: ({ form, onChange, extra, mode }) => {
          return (
          <>
            <div className="grid-2col mb-md">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => onChange({ ...form, name: e.target.value })}
                  autoFocus
                  placeholder="My Project"
                />
              </div>
              <div>
                <label className="label">Code{mode === 'add' ? ' (Optional)' : ''}</label>
                <ProjectCodeInput
                  value={form.code}
                  required={mode === 'edit'}
                  describedBy={projectCodeHelpId}
                  onChange={code => onChange({ ...form, code })}
                />
              </div>
            </div>
            <div className="mb-md">
              <label className="label">Description</label>
              <input
                className="input"
                value={form.description}
                onChange={e => onChange({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            {isAdmin && (
              <div className="mb-md">
                <label className="label">Owner</label>
                <select
                  className="input"
                  style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                  value={form.ownerId}
                  onChange={e => onChange({ ...form, ownerId: e.target.value })}
                >
                  <option value="">— Select Owner (defaults to you)</option>
                  {extra.users?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="proj-is-dormant"
                checked={form.is_dormant}
                onChange={e => onChange({ ...form, is_dormant: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="proj-is-dormant" className="label" style={{ margin: 0, cursor: 'pointer' }}>
                Dormant — hidden from project strip and insights
              </label>
            </div>
          </>
          )
        },

        renderRow: ({ item, onEdit, onDelete, extra, checkbox }) => (
          <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_dormant ? 'var(--opacity-muted)' : 1, cursor: 'pointer' }}>
            {checkbox}
            <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
              {item.code}
            </td>
            <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
              {item.name}
            </td>
            <td className="audit-td" style={{ color: 'var(--muted)' }}>
              {item.description ?? <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>}
            </td>
            {isAdmin && (
              <td className="audit-td" style={{ color: 'var(--text)' }}>
                {(() => {
                  const owner = extra.users?.find((u: any) => u.id === item.created_by)
                  if (!owner) return <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>
                  return [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email
                })()}
              </td>
            )}
            <td className="audit-td" style={{ textAlign: 'center' }}>
              {item.is_dormant ? (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: 'var(--fs-version)',
                  background: 'var(--bg-hover)',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-body)',
                }}>Dormant</span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>—</span>
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

    <TextSearchModal
      open={showTextSearch}
      onClose={() => setShowTextSearch(false)}
      onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
      onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
      currentTerm={textSearchTerm}
      placeholder="Search projects then press"
      ariaLabel="Search projects"
    />
    </>
  )
}
