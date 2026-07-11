'use client'

import { useState } from 'react'
import Link from 'next/link'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
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

const PAGE_SIZE = 25

export default function SettingsUsers() {
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')

  return (
    <>
    <SettingsCrudList<UserRow, UserForm>
      config={{
        title: 'Users',
        table: 'users',
        itemLabel: 'User',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        addButtonLabel: 'Invite User',
        addModalTitle: 'Invite User',
        editModalTitle: 'Edit User',
        subtitle: (_items, total, pageInfo) => {
          if (!total) return 'No users found.'
          const ps = pageInfo?.pageSize ?? PAGE_SIZE
          const pg = pageInfo?.page ?? 0
          const start = pg * ps + 1
          const end = Math.min(start + _items.length - 1, total)
          if (start === end) return `User ${start} of ${total}.`
          return `Users ${start}–${end} of ${total}.`
        },
        externalSearchTerm: textSearchTerm,
        searchCaption: 'Actions',
        onResetFilters: () => setTextSearchTerm(''),
        toolbarExtra: (
          <button type="button" className={textSearchTerm ? 'btn-primary btn-primary-clamped' : 'btn-primary'} onClick={() => setShowTextSearch(true)}>
            {textSearchTerm || 'Search by Text'}
          </button>
        ),
        tableColumns: [
          { label: 'Name',    width: '220px', sortKey: 'name',  sortValue: (u: UserRow) => displayName(u) },
          { label: 'Email',   width: '300px', sortKey: 'email', sortValue: (u: UserRow) => u.email },
          { label: 'Role',    width: '150px', sortKey: 'role',  sortValue: (u: UserRow, extra: any) => {
            const role = extra.roles?.find((r: RoleRow) => r.id === u.role_id)
            return role?.name ?? ''
          }},
          { label: 'Actions', width: '170px' },
        ],

        load: async (_supabase, pagination) => {
          const result = await listUsers({
            page: pagination?.page,
            pageSize: pagination?.pageSize,
            search: pagination?.search,
          })
          return {
            items: (result.users ?? []) as UserRow[],
            extra: {
              roles: (result.roles ?? []) as RoleRow[],
              currentUserId: result.currentUserId ?? null,
            },
            totalCount: result.count ?? 0,
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

        renderForm: ({ form, onChange, extra }) => {
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
            </>
          )
        },

        renderRow: ({ item, onEdit, onDelete, extra, checkbox }) => {
          const isSuperAdmin = item.role_id === SUPER_ADMIN_ROLE_ID
          const isSelf = item.id === extra.currentUserId
          const roleName = (extra.roles ?? []).find((r: RoleRow) => r.id === item.role_id)?.name ?? 'Unknown'

          return (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {checkbox}
              <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>
                <Link href={`/settings/users/${item.id}`} style={{ color: 'var(--link)', textDecoration: 'none' }}>
                  {displayName(item)}
                </Link>
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
                <span style={{ display: 'block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.email}
                </span>
              </td>
              <td className="audit-td">
                {isSuperAdmin ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', fontWeight: 'var(--fw-medium)' }}>{roleName}</span>
                ) : (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>{roleName}</span>
                )}
              </td>
              <td className="audit-td" onClick={e => e.stopPropagation()} style={{ overflow: 'visible' }}>
                <div className="action-cell">
                  {!isSuperAdmin && (
                    <>
                      <button className="action-link" onClick={() => onEdit()}>Edit</button>
                      {!isSelf && (
                        <button className="action-link" onClick={onDelete} style={{ color: 'var(--error)' }}>Delete</button>
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

    <TextSearchModal
      open={showTextSearch}
      onClose={() => setShowTextSearch(false)}
      onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
      onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
      currentTerm={textSearchTerm}
      placeholder="Search users then press"
      ariaLabel="Search users"
    />
    </>
  )
}
