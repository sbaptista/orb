import { ORB_STYLE } from '@/lib/orb-visual'
import type { Urgency } from '@/lib/orb-state'

type Props = {
  state: Urgency
  /** Diameter in px. 28 reads clearly beside body text without crowding it. */
  size?: number
}

/**
 * A small, still portrait of the orb in one state — for places that *describe*
 * the orb rather than being it (Help, and anywhere else the three states get
 * named side by side).
 *
 * Deliberately **static**: the live orb breathes, and three of them pulsing in a
 * Help table would compete with the text they exist to label. The design brief's
 * "living, not static" applies to the orb the user is watching, not to a legend
 * entry. It also means nothing here needs `prefers-reduced-motion` handling.
 *
 * Painted with the same inline radial gradients the real orb uses, from the same
 * `ORB_STYLE` table, so it introduces no CSS class and cannot drift from the
 * thing it depicts. Purely decorative — `aria-hidden`, since the state is always
 * named in adjacent text.
 */
export default function OrbStateIcon({ state, size = 28 }: Props) {
  const style = ORB_STYLE[state]
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        // Highlight at 36%/30% matches the live sphere's light source.
        background: `radial-gradient(circle at 36% 30%, #ffffff, ${style.orbMid} 45%, ${style.orbLo} 100%)`,
        // A restrained bloom — enough to carry the state's colour past the
        // sphere edge, far short of the live orb's glow.
        boxShadow: `0 0 ${Math.round(size / 2.5)}px ${style.glow}`,
      }}
    />
  )
}
