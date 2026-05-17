'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { declineInvitation } from '@/app/actions/invitation-actions'

export default function DeclineForm() {
    const searchParams = useSearchParams()
    const invitationId = searchParams.get('id')

    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleDecline() {
        if (!invitationId) {
            setError('Invalid invitation link.')
            return
        }
        setSubmitting(true)
        setError(null)
        const res = await declineInvitation(invitationId, reason.trim() || undefined)
        setSubmitting(false)
        if (res.error) {
            setError(res.error)
            return
        }
        setDone(true)
    }

    if (done) {
        return (
            <div style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                fontFamily: 'var(--font-ui)',
            }}>
                <div style={{
                    maxWidth: '420px',
                    textAlign: 'center',
                }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
                        Got it — invitation declined
                    </h1>
                    <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: 1.5 }}>
                        Thanks for letting us know. No action needed on your end.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'var(--font-ui)',
        }}>
            <div style={{
                maxWidth: '420px',
                width: '100%',
            }}>
                <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Decline invitation
                </h1>
                <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
                    No worries — if you'd rather not participate, just let us know below.
                </p>

                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                    Reason (optional)
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Too busy right now, not interested, etc."
                    rows={3}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '15px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        marginBottom: '16px',
                    }}
                />

                {error && (
                    <p style={{ color: 'var(--error)', fontSize: '14px', marginBottom: '12px' }}>
                        {error}
                    </p>
                )}

                <button
                    onClick={handleDecline}
                    disabled={submitting || !invitationId}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--text)',
                        color: 'var(--bg)',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: submitting ? 'wait' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                    }}
                >
                    {submitting ? 'Declining…' : 'Decline invitation'}
                </button>
            </div>
        </div>
    )
}
