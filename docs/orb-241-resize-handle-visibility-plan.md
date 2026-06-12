# ORB-241 Resize Handle Visibility Plan

Date: 2026-06-11  
Status: Approved by Stan and implemented in local v0.5.200; awaiting Stan's localhost testing.

## Goal

Make the split-pane resize divider between the Orb pane and List pane easier to discover and grab without making it visually loud.

Parent: ORB-196 (World Class App)  
Ticket: ORB-241, "Make split-pane resize handle more visible"

## Research Summary

Current files:

- `components/DragDivider.tsx`
- `components/UnifiedDashboard.tsx`
- `app/globals.css`
- `docs/ui-catalog.md`

Current implementation:

- `DragDivider` renders `.ud-divider` plus `.ud-divider-handle`.
- Desktop and iPad-width layouts use side-by-side panes with `direction="horizontal"` and a vertical resize rail.
- iPhone/narrow mobile uses Orb/List tab switching and hides `.ud-divider`.
- The visible handle is subtle: `5px` thick, `48px` long, `background: var(--border)`.
- The original hit target was `28px` on fine pointers and `36px` on coarse pointers. The local implementation uses a quieter `40px` coarse-pointer gutter after iPad testing feedback that `48px` felt too large.
- UI catalog requires 44pt minimum hit targets and `touch-action: none` only on drag surfaces.

Ticket details:

> The resize divider between the Orb pane and List pane is too subtle -- hard to discover and grab.
>
> Make it more prominent without being intrusive. Ideas: wider hit target, visible grab handle (dots or line), subtle highlight on hover, cursor change.

Note: the ticket mentions `.ud-resize-handle`, but the current class names are `.ud-divider` and `.ud-divider-handle`.

## Platform Requirements

### MacBook

- Side-by-side panes.
- Divider should be visible at rest but still quiet.
- Hover should clearly indicate interactivity.
- Cursor remains `col-resize`.

### iPad

- Side-by-side panes in wider layouts.
- Hit area should be comfortable without making the gutter visually heavy; use a `40px` coarse-pointer gutter with a clearer handle and drag feedback.
- Because hover is unavailable, pressed/dragging feedback must be visible while dragging.

### iPhone

- Portrait/narrow layout uses Orb/List tabs and hides the divider.
- Do not add a divider to the tabbed mobile layout.
- If a wider/coarse layout exposes the divider, it should inherit the same touch-friendly target.

## Proposed Changes

1. Keep the existing `DragDivider` component and `ud-divider` CSS family.
2. Add a small dragging state in `DragDivider`.
   - Set `isDragging` on pointer down.
   - Clear it on pointer up/cancel.
   - Render `data-dragging="true"` while active.
3. Add light accessibility semantics.
   - `role="separator"`
   - `aria-orientation`
   - `aria-label="Resize Orb and List panes"`
   - Do not add keyboard resizing in this pass; defer to ORB-239 unless Stan wants it now.
4. Improve visible affordance in CSS.
   - Resting handle: slightly stronger green-tinted rail.
   - Hover/focus/dragging: stronger accent, subtle shadow, possibly a faint center line or dot detail.
   - Use pseudo-elements for the detail instead of adding DOM.
5. Increase touch hit target without over-widening the visual gutter.
   - Fine pointer can remain `28px`.
   - Coarse pointer should become `40px` in both vertical and horizontal variants.
6. Update `docs/ui-catalog.md`.
   - Clarify current platform behavior: MacBook/iPad split panes, iPhone tabbed panes with divider hidden.
   - Document the 40px coarse-pointer divider gutter and visible handle affordance.

## Non-Goals

- Do not implement ORB-196 panel transitions.
- Do not change split-pane sizing math.
- Do not add new layout modes.
- Do not add keyboard resizing unless Stan explicitly asks for it.
- Do not change Orb/List tab behavior on iPhone.

## Verification Plan

After Stan approves build:

1. Run `npm run lint`.
2. Check desktop width:
   - Divider visible at rest.
   - Hover/active state is clear.
   - Dragging still resizes smoothly.
3. Check iPad-like width/coarse pointer:
   - Gutter feels comfortably grabbable without taking too much layout space.
   - Pressed/dragging state is visible.
   - Split pane remains usable.
4. Check iPhone portrait:
   - Divider remains hidden.
   - Orb/List tab switching still works.
5. No Orb eval case is required because this does not change conversational tools, routing, or speech behavior.
   - Tier 1 eval is still required before production push per AGENTS.
