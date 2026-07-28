'use client'

import { useMemo, useState } from 'react'
import EditorModal from '@/components/ui/EditorModal'
import { useDirtyForm } from '@/lib/hooks/useDirtyForm'
import { updateUrgencyWindows } from '@/app/actions/manage-project'
import {
  DEFAULT_URGENCY_WINDOWS,
  FALLBACK_URGENCY_WINDOWS,
  parseUrgencyWindows,
  type UrgencyWindowsMap,
} from '@/lib/orb-state'
import { startInteraction } from '@/lib/performance/telemetry'

/** Structurally matches the dashboard's own Priority — optional fields included. */
type Priority = { value: number; label: string; color?: string | null; is_urgent?: boolean }

type Props = {
  projectId: string
  projectName: string
  priorities: Priority[]
  /** The raw `projects.urgency_windows` value, straight from the row. */
  storedWindows: unknown
  onClose: () => void
  onSaved: (projectId: string, windows: UrgencyWindowsMap | null) => void
}

/** Per-priority row state. Held as strings — an input mid-edit is not a number. */
type Row = { runway: string; imminent: string }
type FormState = {
  /** True while the project tracks the shared defaults. Saving writes NULL. */
  useDefaults: boolean
  rows: Record<number, Row>
}

const MAX_WINDOW_HOURS = 8760

/**
 * Turn an hour count into something readable at a glance. The inputs are in
 * hours because that is the unit the derivation uses, but "72" reads as a
 * number while "3 days" reads as a deadline.
 */
function describeHours(raw: string): string {
  const hours = Number(raw)
  if (!Number.isInteger(hours) || hours < 0) return '—'
  if (hours === 0) return 'at the deadline'
  if (hours % 168 === 0) {
    const weeks = hours / 168
    return weeks === 1 ? '1 week before' : `${weeks} weeks before`
  }
  if (hours % 24 === 0) {
    const days = hours / 24
    return days === 1 ? '1 day before' : `${days} days before`
  }
  return hours === 1 ? '1 hour before' : `${hours} hours before`
}

function defaultsFor(priority: number) {
  return DEFAULT_URGENCY_WINDOWS[priority] ?? FALLBACK_URGENCY_WINDOWS
}

function buildRows(windows: UrgencyWindowsMap | null, priorities: Priority[]): Record<number, Row> {
  const rows: Record<number, Row> = {}
  for (const p of priorities) {
    const w = windows?.[p.value] ?? defaultsFor(p.value)
    rows[p.value] = { runway: String(w.runwayHours), imminent: String(w.imminentHours) }
  }
  return rows
}

/**
 * ORB-361 Phase 3 — per-project urgency windows.
 *
 * Sits beside the orb whose colour these windows govern, so cause and control
 * share a screen. Deliberately defaults-first: most projects will never need
 * this, and a project that never customises keeps tracking the shared defaults
 * rather than freezing a copy of today's numbers.
 */
export default function UrgencyWindowsModal({
  projectId,
  projectName,
  priorities,
  storedWindows,
  onClose,
  onSaved,
}: Props) {
  // Priority 1 is flagged is_urgent and short-circuits the window check
  // entirely — a todo at that priority is urgent regardless of its due date —
  // so offering windows for it would be a control that does nothing.
  const tunable = useMemo(
    () => priorities.filter(p => !p.is_urgent).sort((a, b) => a.value - b.value),
    [priorities],
  )

  const initialWindows = useMemo(() => parseUrgencyWindows(storedWindows), [storedWindows])

  const editor = useDirtyForm<FormState>({
    useDefaults: initialWindows === null,
    rows: buildRows(initialWindows, tunable),
  })
  const { form, setForm, isDirty, markSaved } = editor

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Validation ──
  const errors = useMemo(() => {
    const out: Record<number, string> = {}
    for (const p of tunable) {
      const row = form.rows[p.value]
      if (!row) continue
      const runway = Number(row.runway)
      const imminent = Number(row.imminent)

      if (row.runway.trim() === '' || !Number.isInteger(runway) || runway < 0 || runway > MAX_WINDOW_HOURS) {
        out[p.value] = `Busy must be a whole number of hours between 0 and ${MAX_WINDOW_HOURS}.`
      } else if (row.imminent.trim() === '' || !Number.isInteger(imminent) || imminent < 0 || imminent > MAX_WINDOW_HOURS) {
        out[p.value] = `Urgent must be a whole number of hours between 0 and ${MAX_WINDOW_HOURS}.`
      } else if (imminent > runway) {
        // Otherwise 'busy' is unreachable for this priority: everything inside
        // the busy window would already have turned urgent.
        out[p.value] = 'Urgent cannot start earlier than busy — it is the inner window.'
      }
    }
    return out
  }, [form.rows, tunable])

  const hasErrors = Object.keys(errors).length > 0

  function editRow(priority: number, patch: Partial<Row>) {
    setForm(f => ({
      // Any edit means this project is no longer tracking the defaults.
      useDefaults: false,
      rows: { ...f.rows, [priority]: { ...f.rows[priority], ...patch } },
    }))
  }

  function resetToDefaults() {
    setForm({ useDefaults: true, rows: buildRows(null, tunable) })
  }

  async function handleSave(): Promise<boolean> {
    if (hasErrors) return false
    setSaving(true)
    setSaveError(null)
    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'urgency-windows',
      interaction: 'save',
      surface: 'dashboard',
      metadata: { usingDefaults: form.useDefaults, priorityCount: tunable.length },
    })

    try {
      const windows: UrgencyWindowsMap | null = form.useDefaults
        ? null
        : tunable.reduce<UrgencyWindowsMap>((acc, p) => {
          const row = form.rows[p.value]
          acc[p.value] = { runwayHours: Number(row.runway), imminentHours: Number(row.imminent) }
          return acc
        }, {})

      const result = await updateUrgencyWindows(projectId, windows)
      if (result?.error) {
        setSaveError(result.error)
        measurement.end(false, 'save_rejected')
        return false
      }

      markSaved()
      onSaved(projectId, windows)
      measurement.end(true)
      onClose()
      return true
    } catch (err) {
      console.error('[UrgencyWindowsModal] Save failed:', err)
      setSaveError('Could not save. Please try again.')
      measurement.end(false, 'save_failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditorModal
      title={`Urgency windows — ${projectName}`}
      titleId="urgency-windows-title"
      isDirty={isDirty}
      isSaving={saving}
      saveDisabled={hasErrors}
      onSave={handleSave}
      onClose={onClose}
      className="modal-lg"
      footerStart={
        <button
          type="button"
          className="btn-outline"
          onClick={resetToDefaults}
          disabled={form.useDefaults || saving}
          style={{ marginRight: 'auto' }}
        >
          Reset to defaults
        </button>
      }
    >
      <div
        className="modal-body"
        style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}
      >
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-body)' }}>
          How early a deadline starts pressing on this project, by priority. <strong>Busy</strong> is when the
          orb first leans in; <strong>urgent</strong> is the inner window where it stops being gentle about it.
          Anything past due is urgent regardless.
        </p>

        {form.useDefaults && (
          <div className="pill pill-active" style={{ alignSelf: 'flex-start' }}>
            Using shared defaults
          </div>
        )}

        {tunable.map(p => {
          const row = form.rows[p.value]
          if (!row) return null
          const error = errors[p.value]
          return (
            <div
              key={p.value}
              className={`pf-field ${error ? 's-error' : ''}`}
              style={{ gap: 'var(--sp-sm)' }}
            >
              <span className="pf-label" style={p.color ? { color: p.color } : undefined}>{p.label}</span>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--sp-md)',
                }}
              >
                <div className="pf-field">
                  <label htmlFor={`uw-runway-${p.value}`} className="pf-label">Busy from (hours)</label>
                  <input
                    id={`uw-runway-${p.value}`}
                    className="pf-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_WINDOW_HOURS}
                    value={row.runway}
                    onChange={e => editRow(p.value, { runway: e.target.value })}
                  />
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                    {describeHours(row.runway)}
                  </span>
                </div>

                <div className="pf-field">
                  <label htmlFor={`uw-imminent-${p.value}`} className="pf-label">Urgent from (hours)</label>
                  <input
                    id={`uw-imminent-${p.value}`}
                    className="pf-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_WINDOW_HOURS}
                    value={row.imminent}
                    onChange={e => editRow(p.value, { imminent: e.target.value })}
                  />
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                    {describeHours(row.imminent)}
                  </span>
                </div>
              </div>

              {error && <p className="s-error">{error}</p>}
            </div>
          )
        })}

        {saveError && <p className="s-error">{saveError}</p>}
      </div>
    </EditorModal>
  )
}
