'use client'

import SettingsCrudList from './SettingsCrudList'
import { getInvitations, resendInvitation, deleteInvitation, deleteInvitations, type Invitation } from '@/app/actions/invitation-actions'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'

const STAGE_LABELS: Record<string, string> = {
  'pre-alpha': 'Pre-Alpha',
  alpha: 'Alpha',
  beta: 'Beta',
}

// Wrapper to inject toast for row actions
export default function SettingsInvitations() {
  const toast = useToast()
  const [actionSaving, setActionSaving] = useState(false)

  async function handleResend(inv: Invitation) {
    setActionSaving(true)
    const res = await resendInvitation(inv.id)
    setActionSaving(false)
    if (res.error) { toast.error(`Failed: ${res.error}`); return }
    toast.success(`Invite resent to ${inv.email}.`)
  }

  function copyDeclineLink(inv: Invitation) {
    const origin = window.location.origin
    const url = `${origin}/invite/decline?id=${inv.id}`
    navigator.clipboard.writeText(url)
    toast.success('Decline link copied.')
  }

  return (
    <SettingsCrudList<Invitation, Record<string, never>>
      config={{
        title: 'Invitations',
        table: 'invitations',
        itemLabel: 'Invitation',
        emptyForm: {},
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: (items) => {
          const pending = items.filter(i => i.status === 'pending').length
          return `${pending} pending · ${items.length} total`
        },
        tableColumns: [
          { label: 'Invited',   width: '12%', sortKey: 'invited_at',    sortValue: (i: Invitation) => new Date(i.invited_at).getTime() },
          { label: 'Email',     width: '26%', sortKey: 'email',         sortValue: (i: Invitation) => i.email },
          { label: 'Stage',     width: '10%', sortKey: 'release_stage', sortValue: (i: Invitation) => i.release_stage },
          { label: 'Status',    width: '10%', sortKey: 'status',        sortValue: (i: Invitation) => i.status },
          { label: 'Responded', width: '12%', sortKey: 'responded_at',  sortValue: (i: Invitation) => i.responded_at ? new Date(i.responded_at).getTime() : 0 },
          { label: 'Actions',   width: '22%', align: 'right' as const },
        ],

        scopeFilter: {
          defaultScope: 'pending',
          defaultLabel: 'Pending',
          getScopes: () => [
            { id: 'all', label: 'All' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'declined', label: 'Declined' },
          ],
          filterItem: (item: Invitation, scope: string) => {
            if (scope === 'all') return true
            return item.status === scope
          },
        },

        load: async () => {
          const res = await getInvitations()
          return { items: (res.data ?? []) as Invitation[] }
        },

        getId: (item) => item.id,

        deleteWarning: (item) => (
          <>Delete invitation for <strong>{item.email}</strong>?</>
        ),

        onDelete: async (_supabase, item) => {
          const res = await deleteInvitation(item.id)
          if (res.error) throw new Error(res.error)
        },

        bulkDelete: {
          canSelect: () => true,
          confirmMessage: (count: number) => `Permanently delete ${count} invitation${count > 1 ? 's' : ''}? This cannot be undone.`,
          onDelete: async (_supabase: any, items: Invitation[]) => {
            const res = await deleteInvitations(items.map(i => i.id))
            return res.error ? { error: res.error } : {}
          },
        },

        renderRow: ({ item, onDelete, checkbox }) => {
          const canAct = item.status === 'pending'

          return (
            <tr
              key={item.id}
              style={{
                borderBottom: '1px solid var(--border)',
                opacity: item.status !== 'pending' ? 0.7 : 1,
              }}
            >
              {checkbox}
              <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {new Date(item.invited_at).toLocaleDateString()}
              </td>
              <td className="audit-td" style={{ fontWeight: 500, fontSize: '13px' }}>
                {item.email}
              </td>
              <td className="audit-td">
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  background: 'var(--bg3)',
                  color: 'var(--text2)',
                }}>
                  {STAGE_LABELS[item.release_stage] ?? item.release_stage}
                </span>
              </td>
              <td className="audit-td">
                <span style={{
                  fontSize: '11px',
                  textTransform: 'capitalize',
                  color: item.status === 'pending' ? 'var(--status-open)'
                    : item.status === 'accepted' ? 'var(--success)'
                    : 'var(--error)',
                }}>
                  {item.status}
                </span>
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {item.responded_at
                  ? new Date(item.responded_at).toLocaleDateString()
                  : '—'}
                {item.decline_reason && (
                  <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
                    {item.decline_reason}
                  </div>
                )}
              </td>
              <td className="audit-td" style={{ textAlign: 'right' }}>
                <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {canAct && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={() => handleResend(item)}
                        disabled={actionSaving}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Resend
                      </button>
                      <button
                        className="oc-tool-btn"
                        onClick={() => copyDeclineLink(item)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Decline Link
                      </button>
                    </>
                  )}
                  <button
                    className="text-btn"
                    onClick={onDelete}
                    title="Permanently delete"
                    style={{ color: 'var(--error)', padding: '4px', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )
        },
      }}
    />
  )
}
