'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { inviteUser } from '@/app/actions/invite-user'
import { updateUser } from '@/app/actions/update-user'
import { deleteUser } from '@/app/actions/delete-user'
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

const SUPER_ADMIN_ROLE_ID = 3
const PROTECTED_EMAILS = ['dev@localhost.me', 'owner@test.local']
const EMPTY_INVITE_FORM = { email: '', firstName: '', lastName: '', roleId: 2 }

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--success)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--r)',
  padding: '8px var(--sp-lg)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 'var(--fw-medium)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '8px var(--sp-md)',
}

const rowActionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '4px var(--sp-sm)',
  flexShrink: 0,
  transition: 'all var(--transition)',
}

const dangerConfirmBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--error)',
  fontWeight: 'var(--fw-medium)',
  cursor: 'pointer',
  padding: '8px var(--sp-md)',
}

export default function SettingsUsers() {
  const supabase = useMemo(() => createClient(), [])
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
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from('users').select('id, email, first_name, last_name, role_id').order('email'),
      supabase.from('roles').select('*').order('value'),
    ])
    setUsers(usersData ?? [])
    setRoles(rolesData ?? [])
    setLoading(false)
  }, [supabase])

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

  if (loading) return (
    <div style={{ padding: 'var(--sp-3xl)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  return (
    <div className="settings-page" style={{ padding: 'var(--sp-2xl)', maxWidth: '600px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0 }}>
          Users
        </h2>
        {!showInvite && (
          <button onClick={startInvite} title="Invite a new user" style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            padding: '7px var(--sp-md)', fontSize: 'var(--fs-sm)', color: 'var(--text2)', cursor: 'pointer',
          }}>
            + Invite User
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: '0 0 var(--sp-md)' }}>
          {error}
        </p>
      )}

      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {showInvite && (
          <div key="invite-form" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-lg) var(--sp-xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
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
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: '0 0 var(--sp-md)' }}>
              Invitation email delivery is not yet implemented. The user record will be created without sending an email.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              <button onClick={handleInvite} disabled={saving} style={primaryBtnStyle(saving)}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
              <button onClick={() => setShowInvite(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        )}

        {users.map((user) => {
          const isSuperAdmin = user.role_id === SUPER_ADMIN_ROLE_ID
          const protectedUser = isProtectedUser(user.email)
          const avatarLetter = (user.first_name?.charAt(0) || user.email.charAt(0)).toUpperCase()

          if (editingId === user.id) {
            return (
              <div key={`user-edit-${user.id}`} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-lg) var(--sp-xl)' }}>
                {!protectedUser && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
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
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', margin: '0 0 var(--sp-md)' }}>
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
                <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 'var(--sp-md)' }}>
                  <button onClick={() => handleSave(user.id, user.email)} disabled={saving} style={primaryBtnStyle(saving)}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>Cancel</button>
                </div>
              </div>
            )
          }

          if (confirmDeleteId === user.id) {
            return (
              <div key={`user-del-${user.id}`} style={{ background: 'rgba(139, 32, 32, 0.05)', padding: '10px var(--sp-xl)', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>
                  Delete <strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</strong>?
                </span>
                <button onClick={() => handleDelete(user.id)} disabled={saving} style={dangerConfirmBtnStyle}>Confirm</button>
                <button onClick={() => setConfirmDeleteId(null)} style={cancelBtnStyle}>Cancel</button>
              </div>
            )
          }

          return (
            <div
              key={`user-row-${user.id}`}
              className="settings-list-row"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '10px var(--sp-xl)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(60,110,60,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 600, color: 'var(--success)', flexShrink: 0,
              }}>
                {avatarLetter}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                  {user.email}
                </div>
              </div>

              {isSuperAdmin ? (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 'var(--fw-medium)', flexShrink: 0, whiteSpace: 'nowrap' }}>
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
                <div className="settings-row-actions" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {!protectedUser && (
                    <button onClick={() => startEdit(user)} style={rowActionBtnStyle} title="Edit user name and role">Edit</button>
                  )}
                  {!protectedUser && (
                    <button
                      onClick={() => { setConfirmDeleteId(user.id); setEditingId(null) }}
                      style={rowActionBtnStyle}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
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
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', textAlign: 'center', padding: 'var(--sp-xl) 0' }}>
            No users found.
          </p>
        )}
      </div>
    </div>
  )
}
