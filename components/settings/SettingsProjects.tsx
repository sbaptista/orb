'use client'

import SettingsCrudList from './SettingsCrudList'
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

export default function SettingsProjects({ isAdmin = false, userId }: { isAdmin?: boolean; userId?: string }) {
  return (
    <SettingsCrudList<Project, ProjectForm>
      config={{
        title: 'Projects',
        table: 'projects',
        itemLabel: 'Project',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} project${items.length !== 1 ? 's' : ''}`,
        searchPlaceholder: 'Filter by name, code, or owner…',
        searchFilter: (item: Project, query: string, extra: any) => {
          const q = query.toLowerCase()
          if (item.name.toLowerCase().includes(q)) return true
          if (item.code?.toLowerCase().includes(q)) return true
          if (item.description?.toLowerCase().includes(q)) return true
          const owner = extra.users?.find((u: any) => u.id === item.created_by)
          if (owner) {
            const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(' ').toLowerCase()
            if (ownerName.includes(q) || owner.email?.toLowerCase().includes(q)) return true
          }
          return false
        },
        tableColumns: [
          { label: 'Code',        width: '10%', sortKey: 'code',  sortValue: (p: Project) => p.code ?? '' },
          { label: 'Name',        width: '20%', sortKey: 'name',  sortValue: (p: Project) => p.name },
          { label: 'Description', width: '25%' },
          ...(isAdmin ? [
            { label: 'Owner',     width: '15%', sortKey: 'owner', sortValue: (p: Project, extra: any) => {
              const owner = extra.users?.find((u: any) => u.id === p.created_by)
              return owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email : ''
            }},
          ] : []),
          { label: 'Status',      width: '12%', align: 'center' as const },
          { label: 'Actions',     width: '18%' },
        ],

        load: async (_supabase) => {
          const [projectsRes, usersRes] = await Promise.all([
            isAdmin ? getAdminProjects() : getUserProjects(),
            isAdmin ? listUsers() : Promise.resolve({ users: [] }),
          ])
          return {
            items: (projectsRes.projects ?? []) as Project[],
            extra: { users: usersRes.users ?? [] },
          }
        },

        validate: (form, items, editingId) => {
          if (!form.name.trim()) return 'Name is required'
          const code = form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
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
          code: form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || null,
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

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving, extra }) => (
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
                <label className="label">Code (Optional)</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={e => onChange({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="Auto-generated"
                  maxLength={10}
                  style={{ fontFamily: 'var(--font-mono)' }}
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
            <div className="flex-row gap-sm">
              <button className="btn-primary" onClick={onSubmit} disabled={saving}>
                {saving ? 'Saving…' : submitLabel}
              </button>
              <button className="btn-cancel" onClick={onCancel}>Cancel</button>
            </div>
          </>
        ),

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
  )
}
