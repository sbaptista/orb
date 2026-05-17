'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { getInvitations, resendInvitation, deleteInvitation, deleteInvitations, type Invitation } from '@/app/actions/invitation-actions'

type FilterStatus = 'pending' | 'all' | 'accepted' | 'declined'

const STAGE_LABELS: Record<string, string> = {
    'pre-alpha': 'Pre-Alpha',
    'alpha': 'Alpha',
    'beta': 'Beta',
}

export default function SettingsInvitations() {
    const toast = useToast()

    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState<FilterStatus>('pending')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    
    // Sort states
    const [sortField, setSortField] = useState<'invited_at' | 'email' | 'release_stage' | 'status' | 'responded_at'>('invited_at')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    
    const loaded = useRef(false)

    function copyDeclineLink(inv: Invitation) {
        const origin = window.location.origin
        const url = `${origin}/invite/decline?id=${inv.id}`
        navigator.clipboard.writeText(url)
        toast.success('Decline link copied.')
    }

    const load = useCallback(async () => {
        if (!loaded.current) setLoading(true)
        const res = await getInvitations(filter === 'all' ? undefined : filter)
        setInvitations(res.data ?? [])
        setSelectedIds([])
        loaded.current = true
        setLoading(false)
    }, [filter])

    useVisibilityRefetch(load)
    useEffect(() => { load() }, [load])

    function handleSort(field: typeof sortField) {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    // Sort the list of invitations
    const sortedInvitations = [...invitations].sort((a, b) => {
        let valA: any = a[sortField]
        let valB: any = b[sortField]

        // Handle string comparison case-insensitively
        if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase()
            valB = valB.toLowerCase()
        }

        // Handle date strings
        if (sortField === 'invited_at' || sortField === 'responded_at') {
            const timeA = valA ? new Date(valA).getTime() : 0
            const timeB = valB ? new Date(valB).getTime() : 0
            return sortDirection === 'asc' ? timeA - timeB : timeB - timeA
        }

        if (valA === undefined || valA === null) return sortDirection === 'asc' ? 1 : -1
        if (valB === undefined || valB === null) return sortDirection === 'asc' ? -1 : 1

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
    })

    function toggleSelect(id: string) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    function toggleSelectAll() {
        if (selectedIds.length === sortedInvitations.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(sortedInvitations.map(i => i.id))
        }
    }

    async function handleResend(inv: Invitation) {
        setSaving(true)
        const res = await resendInvitation(inv.id)
        setSaving(false)
        if (res.error) {
            toast.error(`Failed: ${res.error}`)
            return
        }
        toast.success(`Invite resent to ${inv.email}.`)
    }

    async function handleDelete(invId: string) {
        setSaving(true)
        const res = await deleteInvitation(invId)
        setSaving(false)
        if (res.error) {
            toast.error(`Failed: ${res.error}`)
            return
        }
        toast.success('Invitation deleted.')
        setInvitations(prev => prev.filter(i => i.id !== invId))
        setSelectedIds(prev => prev.filter(x => x !== invId))
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return
        const count = selectedIds.length
        if (!confirm(`Permanently delete ${count} invitation${count > 1 ? 's' : ''}? This cannot be undone.`)) return
        setSaving(true)
        const res = await deleteInvitations(selectedIds)
        setSaving(false)
        if (res.error) {
            toast.error(`Failed: ${res.error}`)
            return
        }
        toast.success(`${count} invitation${count > 1 ? 's' : ''} deleted.`)
        setInvitations(prev => prev.filter(i => !selectedIds.includes(i.id)))
        setSelectedIds([])
    }

    if (loading) return <div className="s-loading">Loading…</div>

    const pendingCount = invitations.filter(i => i.status === 'pending').length
    const allChecked = sortedInvitations.length > 0 && selectedIds.length === sortedInvitations.length
    const someChecked = selectedIds.length > 0

    function renderSortHeader(label: string, field: typeof sortField, width: string) {
        const isCurrent = sortField === field
        return (
            <th
                className="audit-th"
                style={{ width, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort(field)}
            >
                <div className="flex-row" style={{ alignItems: 'center', gap: '4px', display: 'inline-flex' }}>
                    <span>{label}</span>
                    <span style={{ fontSize: '10px', opacity: isCurrent ? 1 : 0.3 }}>
                        {isCurrent ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                </div>
            </th>
        )
    }

    return (
        <div className="settings-page s-page-wide">
            <div className="s-header">
                <div>
                    <h2 className="s-title" style={{ marginBottom: '4px' }}>Invitations</h2>
                    <p className="text-sm text-muted">
                        {filter === 'pending' ? `${pendingCount} pending` : `${invitations.length} invitations`}
                    </p>
                </div>
                <div className="flex-row gap-sm">
                    {(['pending', 'all', 'accepted', 'declined'] as FilterStatus[]).map(f => (
                        <button
                            key={f}
                            type="button"
                            className="oc-tool-btn"
                            aria-pressed={filter === f}
                            onClick={() => { setFilter(f); setSelectedIds([]) }}
                            style={{ textTransform: 'capitalize' }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

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

            {sortedInvitations.length === 0 ? (
                <div className="s-card s-empty">No invitations found.</div>
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
                                    {renderSortHeader('Invited', 'invited_at', '14%')}
                                    {renderSortHeader('Email', 'email', '28%')}
                                    {renderSortHeader('Stage', 'release_stage', '12%')}
                                    {renderSortHeader('Status', 'status', '10%')}
                                    {renderSortHeader('Responded', 'responded_at', '14%')}
                                    <th className="audit-th" style={{ textAlign: 'right', width: '22%' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedInvitations.map(inv => (
                                    <tr
                                        key={inv.id}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            opacity: inv.status !== 'pending' ? 0.7 : 1,
                                            background: selectedIds.includes(inv.id) ? 'var(--bg2)' : undefined,
                                        }}
                                    >
                                        <td className="audit-td" style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(inv.id)}
                                                onChange={() => toggleSelect(inv.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                            {new Date(inv.invited_at).toLocaleDateString()}
                                        </td>
                                        <td className="audit-td" style={{ fontWeight: 500, fontSize: '13px' }}>
                                            {inv.email}
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
                                                {STAGE_LABELS[inv.release_stage] ?? inv.release_stage}
                                            </span>
                                        </td>
                                        <td className="audit-td">
                                            <span style={{
                                                fontSize: '11px',
                                                textTransform: 'capitalize',
                                                color: inv.status === 'pending' ? 'var(--status-open)'
                                                    : inv.status === 'accepted' ? 'var(--success)'
                                                    : 'var(--error)',
                                            }}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="audit-td" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                            {inv.responded_at
                                                ? new Date(inv.responded_at).toLocaleDateString()
                                                : '—'}
                                            {inv.decline_reason && (
                                                <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
                                                    {inv.decline_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="audit-td" style={{ textAlign: 'right' }}>
                                            <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                {inv.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className="btn-primary"
                                                            onClick={() => handleResend(inv)}
                                                            disabled={saving}
                                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                                        >
                                                            Resend
                                                        </button>
                                                        <button
                                                            className="oc-tool-btn"
                                                            onClick={() => copyDeclineLink(inv)}
                                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                                        >
                                                            Decline Link
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    className="text-btn"
                                                    onClick={() => handleDelete(inv.id)}
                                                    disabled={saving}
                                                    title="Permanently delete"
                                                    style={{ color: 'var(--error)', padding: '4px', fontSize: '12px' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
