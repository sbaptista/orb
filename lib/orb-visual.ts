import type { Urgency } from '@/lib/orb-state'

/**
 * The orb's three-state palette — the single source of truth for what calm,
 * busy and urgent *look* like.
 *
 * Extracted from UnifiedDashboard (ORB-361 Phase 3.2) when Help needed to show
 * the same three states beside their descriptions. Only the calm values exist
 * as CSS variables (`--orb-mid`, `--orb-lo`, `--orb-count` in globals.css);
 * busy and urgent lived nowhere but that one component, so a second renderer
 * would have meant a hand-copied palette that drifts the first time a colour is
 * tuned. Same reasoning as ORB-360's four duplicate due-date parsers.
 *
 * Colours are literal rather than CSS variables because the orb is deliberately
 * painted with inline gradients, not classes — see the sphere/glow in
 * UnifiedDashboard. Keep any new orb renderer on this table.
 */
export type OrbVisualStyle = {
  /** Mid-tone of the sphere's radial gradient. */
  orbMid: string
  /** Outer tone of the sphere's radial gradient. */
  orbLo: string
  /** Colour of the surrounding glow. */
  glow: string
  /** Active-count numeral. */
  countColor: string
  /** Caption beneath the count. */
  labelColor: string
}

export const ORB_STYLE: Record<Urgency, OrbVisualStyle> = {
  calm:   { orbMid: '#d4e4d4', orbLo: '#b8d0b8', glow: 'rgba(80,130,80,0.38)',  countColor: '#2d5a2d', labelColor: '#7a9e7a' },
  busy:   { orbMid: '#e4daf4', orbLo: '#d0c4ee', glow: 'rgba(130,90,200,0.45)', countColor: '#5a3090', labelColor: '#9a7ac8' },
  urgent: { orbMid: '#f8ead8', orbLo: '#f0d4b0', glow: 'rgba(230,130,55,0.6)',  countColor: '#a05010', labelColor: '#c88040' },
}

/** Shown wherever the states are named to the user, in increasing severity. */
export const ORB_STATE_ORDER: Urgency[] = ['calm', 'busy', 'urgent']
