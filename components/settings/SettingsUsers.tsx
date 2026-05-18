'use client'

import { useEffect, useState, useCallback } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { inviteUser } from '@/app/actions/invite-user'
import { updateUser } from '@/app/actions/update-user'
import { deleteUser, deleteUsers } from '@/app/actions/delete-user'
import { listUsers } from '@/app/actions/list-users'
import { FormField, inputStyle, inputFocusStyle, selectStyle } from '@/components/ui/FormField'

type UserRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role_id: number
}

type RoleRow = {
  id: number
  value: number
  name: string
}

type SortKey = 'name' | 'email' | 'role'
type SortDir = 'asc' | 'desc'

const SUPER_ADMIN_ROLE_ID = 3
const PROTECTED_EMAILS = ['dev@localhost.me', 'owner@test.local']
const EMPTY_INVITE_FORM = { email: '', firstName: '', lastName: '', roleId: 2 }

export default function SettingsUsers() {
  const toast = useToast()

  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM)
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', roleId: 0 })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    try {
      const result = await listUsers()
      if (result.error) setError(result.error)
      setUsers((result.users ?? []) as UserRow[])
      setRoles((result.roles ?? []) as RoleRow[])
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const assignableRoles = roles.filter(r => r.id !== SUPER_ADMIN_ROLE_ID)
  const roleName = (roleId: number) => roles.find(r => r.id === roleId)?.name ?? 'Unknown'
  const isProtectedUser = (email: string) => PROTECTED_EMAILS.includes(email)

  function displayName(u: UserRow) {
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
  }

  const sortedUsers = [...users].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = displayName(a).localeCompare(displayName(b))
    else if (sortKey === 'email') cmp = a.email.localeCompare(b.email)
    else if (sortKey === 'role') cmp = roleName(a.role_id).localeCompare(roleName(b.role_id))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const selectableIds = sortedUsers.filter(u => u.role_id !== SUPER_ADMIN_ROLE_ID && !isProtectedUser(u.email)).map(u => u.id)
    if (selectableIds.every(id => selectedIds.includes(id))) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectableIds)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (!confirm(`Permanently delete ${count} user${count > 1 ? 's' : ''}? This cannot be undone.`)) return
    setSaving(true)
    const res = await deleteUsers(selectedIds)
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(`${count} user${count > 1 ? 's' : ''} deleted.`)
    setSelectedIds([])
    load()
  }

  function clearInviteError(field: string) {
    setInviteErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function clearEditError(field: string) {
    setEditErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function startInvite() {
    setShowInvite(true)
    setEditingId(null)
    setConfirmDeleteId(null)
    setError('')
    setInviteErrors({})
    setInviteForm({ email: '', firstName: '', lastName: '', roleId: 2 })
  }

  function validateInviteForm() {
    const errs: Record<string, string> = {}
    if (!inviteForm.email.trim()) errs.email = 'Email is required'
    if (!inviteForm.firstName.trim()) errs.firstName = 'First name is required'
    if (!inviteForm.lastName.trim()) errs.lastName = 'Last name is required'
    return errs
  }

  async function handleInvite() {
    const errs = validateInviteForm()
    if (Object.keys(errs).length > 0) { setInviteErrors(errs); return }

    setSaving(true)
    setError('')
    const { error: err } = await inviteUser(
      inviteForm.email.trim(),
      inviteForm.firstName.trim(),
      inviteForm.lastName.trim(),
      inviteForm.roleId,
      window.location.origin
    )
    setSaving(false)
    if (err) { setError(err); return }
    toast.success('User invited.')
    setShowInvite(false)
    setInviteForm(EMPTY_INVITE_FORM)
    load()
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id)
    setEditForm({ firstName: u.first_name ?? '', lastName: u.last_name ?? '', roleId: u.role_id })
    setEditErrors({})
    setShowInvite(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleSave(userId: string, email: string) {
    const isProtected = isProtectedUser(email)
    const errs: Record<string, string> = {}
    if (!isProtected) {
      if (!editForm.firstName.trim()) errs.firstName = 'First name is required'
    }
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }

    const payload: { first_name?: string; last_name?: string; role_id?: number } = {}
    if (!isProtected) {
      payload.first_name = editForm.firstName.trim()
      payload.last_name = editForm.lastName.trim()
    }
    payload.role_id = editForm.roleId

    setSaving(true)
    setError('')
    const { error: err } = await updateUser(userId, payload)
    setSaving(false)
    if (err) { setError(err); return }
    toast.success('User updated.')
    setEditingId(null)
    load()
  }

  async function handleDelete(userId: string) {
    setSaving(true)
    setError('')
    const { error: err } = await deleteUser(userId)
    setSaving(false)
    if (err) { setError(err); return }
    toast.success('User deleted.')
    setConfirmDeleteId(null)
    setSelectedIds(prev => prev.filter(x => x !== userId))
    load()
  }

  if (loading) return <div className="s-loading">Loading…</div>

  const selectableIds = sortedUsers.filter(u => u.role_id !== SUPER_ADMIN_ROLE_ID && !isProtectedUser(u.email)).map(u => u.id)
  const allChecked = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id))
  const someChecked = selectedIds.length > 0

  return (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
          <h2 className="s-title" style={{ marginBottom: '4px' }}>Users</h2>
          <p className="text-sm text-muted">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        {!showInvite && (
          <button className="btn-outline" onClick={startInvite} title="Invite a new user">
            + Invite User
          </button>
        )}
      </div>

      {error && <p className="s-error">{error}</p>}

      {showInvite && (
        <div className="s-form" style={{ marginBottom: '12px' }}>
          <div className="flex-col gap-md mb-md">
            <FormField label="Email" required error={inviteErrors.email}>
              <input
                type="email"
                value={inviteForm.email}
                onChange={e => { setInviteForm(f => ({ ...f, email: e.target.value })); clearInviteError('email') }}
                onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle(!!inviteErrors.email))}
                onBlur={e => Object.assign(e.currentTarget.style, inputStyle(!!inviteErrors.email))}
                placeholder="user@example.com"
                style={inputStyle(!!inviteErrors.email)}
                autoFocus
              />
            </FormField>
            <div className="grid-2col">
              <FormField label="First Name" required error={inviteErrors.firstName}>
                <input
                  value={inviteForm.firstName}
                  onChange={e => { setInviteForm(f => ({ ...f, firstName: e.target.value })); clearInviteError('firstName') }}
                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle(!!inviteErrors.firstName))}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle(!!inviteErrors.firstName))}
                  placeholder="First name"
                  style={inputStyle(!!inviteErrors.firstName)}
                />
              </FormField>
              <FormField label="Last Name" required error={inviteErrors.lastName}>
                <input
                  value={inviteForm.lastName}
                  onChange={e => { setInviteForm(f => ({ ...f, lastName: e.target.value })); clearInviteError('lastName') }}
                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle(!!inviteErrors.lastName))}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle(!!inviteErrors.lastName))}
                  placeholder="Last name"
                  style={inputStyle(!!inviteErrors.lastName)}
                />
              </FormField>
            </div>
            <FormField label="Role" hint="Which level of access this user should have.">
              <select
                value={inviteForm.roleId}
                onChange={e => setInviteForm(f => ({ ...f, roleId: Number(e.target.value) }))}
                style={selectStyle()}
              >
                {assignableRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="flex-row gap-sm">
            <button className="btn-primary" onClick={handleInvite} disabled={saving}>
              {saving ? 'Sending…' : 'Send Invitation'}
            </button>
            <button className="btn-cancel" onClick={() => setShowInvite(false)}>Cancel</button>
          </div>
        </div>
      )}

      {someChecked && (
        <div className="flex-row gap-sm" style={{
          padding: '8px 12px',
          background: 'var(--bg2)',
          borderRadius: 'var(--r-md)',
          marginBottom: '8px',
          alignItems: 'center',
        }}>
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {selectedIds.length} selected
          </span>
          <button
            className="oc-tool-btn"
            onClick={handleBulkDelete}
            disabled={saving}
            style={{ fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
          >
            Delete
          </button>
          <button
            className="text-btn text-sm"
            onClick={() => setSelectedIds([])}
            style={{ color: 'var(--muted)' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Edit form (shown above table when editing) */}
      {editingId && (() => {
        const user = users.find(u => u.id === editingId)
        if (!user) return null
        const protectedUser = isProtectedUser(user.email)
        return (
          <div className="s-form" style={{ marginBottom: '12px' }}>
            <p className="text-sm" style={{ fontWeight: 600, marginBottom: '8px' }}>
              Editing {displayName(user)}
            </p>
            {!protectedUser && (
              <div className="grid-2col mb-md">
                <FormField label="First Name" required error={editErrors.firstName}>
                  <input
                    value={editForm.firstName}
                    onChange={e => { setEditForm(f => ({ ...f, firstName: e.target.value })); clearEditError('firstName') }}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle(!!editErrors.firstName))}
                    onBlur={e => Object.assign(e.currentTarget.style, inputStyle(!!editErrors.firstName))}
                    style={inputStyle(!!editErrors.firstName)}
                    autoFocus
                  />
                </FormField>
                <FormField label="Last Name">
                  <input
                    value={editForm.lastName}
                    onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle())}
                    onBlur={e => Object.assign(e.currentTarget.style, inputStyle())}
                    style={inputStyle()}
                  />
                </FormField>
              </div>
            )}
            {protectedUser && (
              <p className="text-sm text-muted mb-md" style={{ margin: 0 }}>
                Name cannot be changed for this test user.
              </p>
            )}
            <FormField label="Role">
              <select
                value={editForm.roleId}
                onChange={e => setEditForm(f => ({ ...f, roleId: Number(e.target.value) }))}
                style={selectStyle()}
              >
                {assignableRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </FormField>
            <div className="flex-row gap-sm mt-md">
              <button className="btn-primary" onClick={() => handleSave(user.id, user.email)} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-cancel" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        )
      })()}

      {/* Confirm delete (shown above table) */}
      {confirmDeleteId && (() => {
        const user = users.find(u => u.id === confirmDeleteId)
        if (!user) return null
        return (
          <div className="s-row-delete" style={{ marginBottom: '12px' }}>
            <span className="text-sm flex-1">
              Delete <strong>{displayName(user)}</strong>?
            </span>
            <button className="btn-danger-confirm" onClick={() => handleDelete(user.id)} disabled={saving}>Confirm</button>
            <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
          </div>
        )
      })()}

      {users.length === 0 ? (
        <div className="s-card s-empty">No users found.</div>
      ) : (
        <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  <th className="audit-th" style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th
                    className="audit-th"
                    style={{ cursor: 'pointer', userSelect: 'none', width: '30%' }}
                    onClick={() => handleSort('name')}
                  >
                    Name{sortArrow('name')}
                  </th>
                  <th
                    className="audit-th"
                    style={{ cursor: 'pointer', userSelect: 'none', width: '30%' }}
                    onClick={() => handleSort('email')}
                  >
                    Email{sortArrow('email')}
                  </th>
                  <th
                    className="audit-th"
                    style={{ cursor: 'pointer', userSelect: 'none', width: '15%' }}
                    onClick={() => handleSort('role')}
                  >
                    Role{sortArrow('role')}
                  </th>
                  <th className="audit-th" style={{ textAlign: 'right', width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(user => {
                  const isSuperAdmin = user.role_id === SUPER_ADMIN_ROLE_ID
                  const protectedUser = isProtectedUser(user.email)
                  const selectable = !isSuperAdmin && !protectedUser

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: selectedIds.includes(user.id) ? 'var(--bg2)' : undefined,
                      }}
                    >
                      <td className="audit-td" style={{ textAlign: 'center' }}>
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : null}
                      </td>
                      <td className="audit-td" style={{ fontWeight: 500, fontSize: '13px' }}>
                        {displayName(user)}
                      </td>
                      <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '13px' }}>
                        <span style={{ display: 'block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.email}
                        </span>
                      </td>
                      <td className="audit-td">
                        {isSuperAdmin ? (
                          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                            {roleName(user.role_id)}
                          </span>
                        ) : (
                          <select
                            value={user.role_id}
                            onChange={async e => {
                              const { error: err } = await updateUser(user.id, { role_id: Number(e.target.value) })
                              if (err) { toast.error(err); return }
                              toast.success('Role updated.')
                              load()
                            }}
                            style={{
                              fontSize: '12px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg)',
                              color: 'var(--text)',
                            }}
                            title="Change user role"
                          >
                            {assignableRoles.map(role => (
                              <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="audit-td" style={{ textAlign: 'right' }}>
                        <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                          {!isSuperAdmin && !protectedUser && (
                            <>
                              <button
                                className="text-btn"
                                onClick={() => startEdit(user)}
                                style={{ padding: '4px', fontSize: '12px', color: 'var(--text2)' }}
                              >
                                Edit
                              </button>
                              <button
                                className="text-btn"
                                onClick={() => { setConfirmDeleteId(user.id); setEditingId(null) }}
                                style={{ color: 'var(--error)', padding: '4px', fontSize: '12px' }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
