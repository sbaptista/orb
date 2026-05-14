'use client'

import { useEffect, useState, useCallback } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { inviteUser } from '@/app/actions/invite-user'
import { updateUser } from '@/app/actions/update-user'
import { deleteUser } from '@/app/actions/delete-user'
import { listUsers } from '@/app/actions/list-users'
import { FormField, inputStyle, inputFocusStyle, selectStyle } from '@/components/ui/FormField'
import Link from 'next/link'

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

  const load = useCallback(async () => {
    const { users: usersData, roles: rolesData } = await listUsers()
    setUsers(usersData as UserRow[])
    setRoles(rolesData as RoleRow[])
    setLoading(false)
  }, [])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const assignableRoles = roles.filter(r => r.id !== SUPER_ADMIN_ROLE_ID)
  const roleName = (roleId: number) => roles.find(r => r.id === roleId)?.name ?? 'Unknown'
  const isProtectedUser = (email: string) => PROTECTED_EMAILS.includes(email)

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
      inviteForm.roleId
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
    load()
  }

  if (loading) return <div className="s-loading">Loading…</div>

  return (
    <div className="settings-page s-page">
      <div className="s-header">
        <h2 className="s-title">Users</h2>
        {!showInvite && (
          <button className="btn-outline" onClick={startInvite} title="Invite a new user">
            + Invite User
          </button>
        )}
      </div>

      {error && <p className="s-error">{error}</p>}

      <div className="s-list">
        {showInvite && (
          <div className="s-form">
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
                <FormField label="Last Name">
                  <input
                    value={inviteForm.lastName}
                    onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle())}
                    onBlur={e => Object.assign(e.currentTarget.style, inputStyle())}
                    placeholder="Last name"
                    style={inputStyle()}
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
            <p className="text-xs text-muted mb-md" style={{ margin: 0 }}>
              Invitation email delivery is not yet implemented. The user record will be created without sending an email.
            </p>
            <div className="flex-row gap-sm">
              <button className="btn-primary" onClick={handleInvite} disabled={saving}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
              <button className="btn-cancel" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        )}

        {users.map((user) => {
          const isSuperAdmin = user.role_id === SUPER_ADMIN_ROLE_ID
          const protectedUser = isProtectedUser(user.email)
          const avatarLetter = (user.first_name?.charAt(0) || user.email.charAt(0)).toUpperCase()

          if (editingId === user.id) {
            return (
              <div key={`user-edit-${user.id}`} className="s-form">
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
          }

          if (confirmDeleteId === user.id) {
            return (
              <div key={`user-del-${user.id}`} className="s-row-delete">
                <span className="text-sm flex-1">
                  Delete <strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</strong>?
                </span>
                <button className="btn-danger-confirm" onClick={() => handleDelete(user.id)} disabled={saving}>Confirm</button>
                <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              </div>
            )
          }

          return (
            <div
              key={`user-row-${user.id}`}
              className="settings-list-row s-row"
            >
              <div className="avatar">{avatarLetter}</div>
              <div className="s-row-info">
                <div className="text-sm truncate">
                  <Link href={`/settings/users/${user.id}`} style={{ fontWeight: 600, color: 'var(--pill-active-color)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                    {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
                  </Link>
                </div>
                <div className="text-xs text-muted">{user.email}</div>
              </div>

              {isSuperAdmin ? (
                <span className="text-sm shrink-0" style={{ color: 'var(--success)', fontWeight: 'var(--fw-medium)', whiteSpace: 'nowrap' }}>
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
                  style={{ ...selectStyle(), width: 'auto', minWidth: '90px', maxWidth: '130px', fontSize: 'var(--fs-sm)' }}
                  title="Change user role"
                >
                  {assignableRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              )}

              {!isSuperAdmin && (
                <div className="settings-row-actions flex-center" style={{ gap: '2px' }}>
                  <Link href={`/settings/users/${user.id}`} className="btn-row-action" style={{ textDecoration: 'none' }}>
                    View Projects
                  </Link>
                  {!protectedUser && (
                    <button className="btn-row-action" onClick={() => startEdit(user)} title="Edit user name and role">Edit</button>
                  )}
                  {!protectedUser && (
                    <button
                      className="btn-row-action btn-row-delete"
                      onClick={() => { setConfirmDeleteId(user.id); setEditingId(null) }}
                      title="Delete this user"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {users.length === 0 && (
          <p className="s-empty">No users found.</p>
        )}
      </div>
    </div>
  )
}
