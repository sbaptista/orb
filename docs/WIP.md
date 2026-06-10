# WIP: Mobile "More" Kebab Button — Not Activating on iPhone/iPad

## Problem

The Orb conversation toolbar was decluttered for touch devices. Primary actions (Cmds, Voice, Send/Stop) stay visible. Secondary actions (Prev, Next, Copy, Log, Clear) are hidden behind a "More" kebab button that only appears on touch devices via a media query.

**The More button renders correctly but tapping it does nothing on iPhone or iPad.** The adjacent Cmds button — same `oc-tool-btn` class, same toolbar, same `onMouseDown` + `onClick` pattern — works perfectly.

## What Works vs. What Doesn't

| Button | Class | onClick | onMouseDown | Works on touch? |
|--------|-------|---------|-------------|-----------------|
| Cmds (`/`) | `oc-tool-btn` | Sets input to `/`, focuses textarea | `e.preventDefault()` | YES |
| Voice | `oc-tool-btn` | Toggles speech recognition | `e.preventDefault()` | YES |
| **More (`⋮`)** | `oc-tool-btn` | `setMoreMenuOpen(o => !o)` | `e.preventDefault()` | **NO** |

The key difference: Cmds and Voice manipulate state that directly changes the textarea or starts a browser API. More toggles a boolean that conditionally renders a dropdown. The dropdown never appears — the state toggle itself seems to not fire on touch.

## Current Implementation

### Component: `components/OrbConversation.tsx`

The More button lives inside `div.oc-toolbar-mobile` (lines 630–692):

```tsx
<div className="oc-toolbar-mobile" style={{ position: 'relative' }}>
  <button
    type="button"
    className="oc-tool-btn"
    onClick={() => setMoreMenuOpen(o => !o)}
    onMouseDown={(e) => e.preventDefault()}
    aria-label="More actions"
    aria-expanded={moreMenuOpen}
  >
    <span className="oc-tool-btn-icon">⋮</span>
    <span className="oc-tool-btn-label">More</span>
  </button>
  {moreMenuOpen && (
    <>
      <div className="dropdown-backdrop" onClick={e => { e.stopPropagation(); setMoreMenuOpen(false) }} />
      <div className="dropdown-menu" style={{ bottom: '100%', left: 0, right: 'auto', marginBottom: '4px' }}>
        {/* dropdown-item buttons for Prev, Next, Copy input, Copy log, Clear */}
      </div>
    </>
  )}
</div>
```

### CSS: `app/globals.css`

Desktop/mobile toggle (lines 2701–2712):
```css
.oc-toolbar-desktop { display: flex; gap: 8px; }
.oc-toolbar-mobile  { display: none; }

@media (hover: none), (pointer: coarse) {
  .oc-toolbar-desktop { display: none; }
  .oc-toolbar-mobile  { display: flex; }
}
```

The dropdown uses the project's proven `dropdown-backdrop` + `dropdown-menu` + `dropdown-item` pattern (lines 1348–1383), which works correctly in SettingsTickets and other tables.

### Container: `.oc-input-border`

Previously had `overflow: hidden` which was clipping absolutely-positioned children (like the dropdown menu). That was removed. Currently (line 2549):
```css
.oc-input-border {
  border: 1.5px solid rgba(60, 110, 60, 0.55);
  border-radius: var(--r-xl);
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: var(--shadow-sm);
}
```

No `overflow: hidden` — so clipping is not the issue anymore.

## Three Failed Fix Attempts

### Attempt 1: Added `touchstart` listener
Added a `touchstart` event listener alongside `mousedown` for click-outside handling, and used `pointer: coarse` media query. **Result: Still not working.** Touch events may conflict with React's synthetic event system.

### Attempt 2: Switched to `dropdown-backdrop` pattern
Replaced custom click-outside logic with the project's proven `dropdown-backdrop` (position: fixed; inset: 0; z-index: 29) for dismiss handling. Changed media query to `(hover: none), (pointer: coarse)` to catch iPad. **Result: Still not working.** The backdrop never renders because the menu never opens — the problem is the button's onClick, not the dismiss mechanism.

### Attempt 3: Removed `overflow: hidden`, matched Cmds button attributes
Removed `overflow: hidden` from `.oc-input-border` (was clipping the dropdown). Added `onMouseDown={(e) => e.preventDefault()}` to match the working Cmds button. Added explicit `border-radius` to `.oc-textarea` and `.oc-toolbar` to compensate for lost overflow clipping. **Result: Still not working.**

## What I Haven't Tried / Hypotheses

1. **Textarea blur race condition.** When you tap More, the textarea loses focus. The `onBlur` handler sets `setInputFocused(false)`. If React batches this with the `setMoreMenuOpen` call in a way that triggers a re-render that disrupts the event, the click might get swallowed. The Cmds button avoids this because its onClick immediately calls `textareaRef.current?.focus()`, re-focusing the textarea before the blur settles.

2. **The `<form>` wrapper.** The More button is inside a `<form onSubmit={handleFormSubmit}>`. On touch, tapping a `type="button"` inside a form should NOT trigger submit — but worth verifying. The Cmds button is also inside this form and works, so this is unlikely but not ruled out.

3. **Touch target occlusion.** Something invisible (the slash menu, the form itself, or a sibling element) might be positioned over the More button on touch devices specifically. The `.oc-toolbar` has `overflow-x: auto` — on narrow viewports, the More button might be partially scrolled or overlapped.

4. **React state update not triggering render.** The `moreMenuOpen` state is a simple boolean toggle. This should work, but if the component is re-rendering for another reason (blur, input change) at the same moment, React might discard the state update.

5. **`position: relative` on the mobile container.** The `div.oc-toolbar-mobile` has `style={{ position: 'relative' }}` to anchor the dropdown. This shouldn't prevent clicks but could interact with stacking context on iOS Safari.

## Files to Inspect

- `components/OrbConversation.tsx` — lines 630–692 (More button + dropdown)
- `app/globals.css` — lines 2549–2564 (`.oc-input-border`), 2635–2712 (toolbar classes)
- Compare with working `dropdown-backdrop` usage in `components/settings/SettingsTickets.tsx`

## Suggested Debugging Approach

Add a temporary `console.log` or `alert()` inside the More button's `onClick` to confirm whether the handler fires at all on touch. If it doesn't fire, the problem is event interception (something above it is catching the tap). If it does fire but the menu doesn't appear, the problem is a React render issue (state updates getting batched/discarded).
