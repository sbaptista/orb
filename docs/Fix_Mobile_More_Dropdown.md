# Fix Mobile "More" Dropdown Menu Interaction on iOS/iPad

## Goal
Resolve the issue where the "More" dropdown menu (⋮) does not render/display or interact correctly on touch viewports (iPad/iPhone) due to:
1. **Stacking Context Conflict**: The fixed-position `dropdown-backdrop` (`z-index: 29`) is positioned relative to the root layout, rendering *above* the dropdown menu (`z-index: 30`) which is nested within the lower-stacked input wrap. This causes the backdrop to visually overlay the dropdown menu.
2. **Touch Interception / Immediate Closure**: Tapping anywhere on the dropdown menu coordinate triggers the backdrop's `onTouchStart` event instead of the dropdown items, closing the menu instantly before the user can select an action.

We will eliminate the fixed DOM backdrop entirely and replace it with a standard document-level click-outside event listener.

---

## Proposed Changes

### [MODIFY] [OrbConversation](file:///Users/stanleybaptista/Projects/orb/components/OrbConversation.tsx)

1. **Introduce container reference**:
   Add a `moreContainerRef` to target the mobile toolbar container:
   ```typescript
   const moreContainerRef = useRef<HTMLDivElement>(null)
   ```

2. **Implement document event listener for click-outside**:
   Add a React `useEffect` hook to handle click/touch outside:
   ```typescript
   useEffect(() => {
       if (!moreMenuOpen) return
       const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
           if (moreContainerRef.current && !moreContainerRef.current.contains(e.target as Node)) {
               logToTerminal('More menu closed: clicked outside')
               setMoreMenuOpen(false)
           }
       }
       document.addEventListener('mousedown', handleOutsideClick)
       document.addEventListener('touchstart', handleOutsideClick)
       return () => {
           document.removeEventListener('mousedown', handleOutsideClick)
           document.removeEventListener('touchstart', handleOutsideClick)
       }
   }, [moreMenuOpen])
   ```

3. **Clean up DOM rendering**:
   - Bind `moreContainerRef` to the `<div className="oc-toolbar-mobile">` wrapper.
   - Remove the `<div className="dropdown-backdrop" />` element entirely.
   - Keep the `<div className="dropdown-menu">` nested under the conditional `{moreMenuOpen && (...)` render path.

---

## Verification Plan

### Automated Tests
- Run the Orb eval suite to ensure no conversational behaviors or regression are introduced:
  ```bash
  NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --tier 1
  ```

### Manual Verification
- Ask Stan to test on iPad/iPhone localhost:
  1. Tapping the "More" button displays the dropdown menu cleanly above the button.
  2. Tapping dropdown actions ("Previous", "Next", "Copy input", "Copy log", "Clear") fires the actions correctly and closes the menu without blurring the textarea or dismissing the keyboard.
  3. Tapping anywhere outside the dropdown menu closes the menu.
