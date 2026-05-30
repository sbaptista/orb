'use client'

import SettingsCrudList from './SettingsCrudList'
import { inviteUser } from '@/app/actions/invite-user'
import { updateUser } from '@/app/actions/update-user'
import { deleteUser, deleteUsers } from '@/app/actions/delete-user'
import { listUsers } from '@/app/actions/list-users'

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

type UserForm = {
  email: string
  firstName: string
  lastName: string
  roleId: number
  isInvite: boolean
}

const SUPER_ADMIN_ROLE_ID = 3

const EMPTY_FORM: UserForm = { email: '', firstName: '', lastName: '', roleId: 2, isInvite: true }

function displayName(u: UserRow) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
}

export default function SettingsUsers() {
  return (
    <SettingsCrudList<UserRow, UserForm>
      config={{
        title: 'Users',
        table: 'users',
        itemLabel: 'User',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        addButtonLabel: 'Invite User',
        addModalTitle: 'Invite User',
        editModalTitle: 'Edit User',
        subtitle: items => `${items.length} user${items.length !== 1 ? 's' : ''}`,
        tableColumns: [
          { label: 'Name',    width: '30%', sortKey: 'name',  sortValue: (u: UserRow) => displayName(u) },
          { label: 'Email',   width: '30%', sortKey: 'email', sortValue: (u: UserRow) => u.email },
          { label: 'Role',    width: '20%', sortKey: 'role',  sortValue: (u: UserRow, extra: any) => {
            const role = extra.roles?.find((r: RoleRow) => r.id === u.role_id)
            return role?.name ?? ''
          }},
          { label: 'Actions', width: '20%', align: 'right' as const },
        ],

        load: async () => {
          const result = await listUsers()
          return {
            items: (result.users ?? []) as UserRow[],
            extra: {
              roles: (result.roles ?? []) as RoleRow[],
              currentUserId: result.currentUserId ?? null,
            },
          }
        },

        validate: (form) => {
          if (form.isInvite) {
            if (!form.email.trim()) return 'Email is required'
            if (!form.firstName.trim()) return 'First name is required'
            if (!form.lastName.trim()) return 'Last name is required'
          } else {
            if (!form.firstName.trim()) return 'First name is required'
          }
          return null
        },

        toRecord: (form) => ({
          email: form.email.trim(),
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          role_id: form.roleId,
          _isInvite: form.isInvite,
        }),

        toForm: (item) => ({
          email: item.email,
          firstName: item.first_name ?? '',
          lastName: item.last_name ?? '',
          roleId: item.role_id,
          isInvite: false,
        }),

        getId: (item) => item.id,

        onAdd: async (_supabase, record) => {
          const res = await inviteUser(
            record.email,
            record.first_name,
            record.last_name,
            record.role_id,
            typeof window !== 'undefined' ? window.location.origin : ''
          )
          if (res.error) throw new Error(res.error)
        },

        onSave: async (_supabase, id, record) => {
          const res = await updateUser(id, {
            first_name: record.first_name,
            last_name: record.last_name,
            role_id: record.role_id,
          })
          if (res.error) throw new Error(res.error)
        },

        onDelete: async (_supabase, item) => {
          const res = await deleteUser(item.id)
          if (res.error) throw new Error(res.error)
        },

        deleteWarning: (item) => (
          <>Delete <strong>{displayName(item)}</strong>?</>
        ),

        canDelete: (item, extra) => {
          return item.role_id !== SUPER_ADMIN_ROLE_ID && item.id !== extra.currentUserId
        },

        bulkDelete: {
          canSelect: (item: UserRow) => item.role_id !== SUPER_ADMIN_ROLE_ID,
          confirmMessage: (count: number) => `Permanently delete ${count} user${count > 1 ? 's' : ''}? This cannot be undone.`,
          onDelete: async (_supabase: any, items: UserRow[]) => {
            const res = await deleteUsers(items.map(u => u.id))
            return res.error ? { error: res.error } : {}
          },
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving, extra }) => {
          const assignableRoles = (extra.roles ?? []).filter((r: RoleRow) => r.id !== SUPER_ADMIN_ROLE_ID)
          return (
            <>
              {form.isInvite && (
                <div className="mb-md">
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={e => onChange({ ...form, email: e.target.value })}
                    autoFocus
                    placeholder="user@example.com"
                  />
                </div>
              )}
              <div className="grid-2col mb-md">
                <div>
                  <label className="label">First Name *</label>
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={e => onChange({ ...form, firstName: e.target.value })}
                    autoFocus={!form.isInvite}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={e => onChange({ ...form, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="mb-lg">
                <label className="label">Role</label>
                <select
                  className="input"
                  style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                  value={form.roleId}
                  onChange={e => onChange({ ...form, roleId: Number(e.target.value) })}
                >
                  {assignableRoles.map((role: RoleRow) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-row gap-sm">
                <button className="btn-primary" onClick={onSubmit} disabled={saving}>
                  {saving ? 'Saving…' : submitLabel}
                </button>
                <button className="btn-cancel" onClick={onCancel}>Cancel</button>
              </div>
            </>
          )
        },

        renderRow: ({ item, onEdit, onDelete, extra, checkbox }) => {
          const isSuperAdmin = item.role_id === SUPER_ADMIN_ROLE_ID
          const isSelf = item.id === extra.currentUserId
          const roleName = (extra.roles ?? []).find((r: RoleRow) => r.id === item.role_id)?.name ?? 'Unknown'

          return (
            <tr key={item.id} onClick={e => onEdit(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              {checkbox}
              <td className="audit-td" style={{ fontWeight: 500, fontSize: '13px' }}>
                {displayName(item)}
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '13px' }}>
                <span style={{ display: 'block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.email}
                </span>
              </td>
              <td className="audit-td">
                {isSuperAdmin ? (
                  <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>{roleName}</span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{roleName}</span>
                )}
              </td>
              <td className="audit-td" style={{ textAlign: 'right' }}>
                <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                  {!isSuperAdmin && (
                    <>
                      <button className="text-btn" onClick={onEdit} style={{ fontSize: '12px', padding: '4px' }}>Edit</button>
                      {!isSelf && (
                        <button className="text-btn" onClick={onDelete} style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}>Delete</button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          )
        },
      }}
    />
  )
}
