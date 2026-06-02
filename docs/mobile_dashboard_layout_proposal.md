# UX & Architectural Proposal: Separate Screens vs. Unified Dashboard Layout (Refined)

**Date:** June 1, 2026  
**Project:** Orb Task Tracker  
**Author:** Antigravity (AI Assistant)  

---

## 1. Context & Problem Definition
The **Unified Dashboard** (split-pane layout) was designed to bridge the gap between conversational action (the Orb) and structured backlog visualization (Kanban/List/Checklist views). 

* **The Desktop Experience (Mac):** Works exceptionally well. The wide screen allows side-by-side panes (`ud-orb-pane` and `ud-list-pane`) separated by a resizable divider (`DragDivider`). As the user interacts with the Orb, the backlog updates in real-time, providing immediate visual feedback.
* **The Mobile Experience (iPhone / Portrait iPad):** Fails to function. Stacking the panes vertically leaves minimal space for either view. When the virtual keyboard appears on iPhone, it occupies up to 50% of the viewport, squeezing the rest of the layout into a cramped, unusable ribbon. On portrait iPad, the vertical stacking is similarly constricted.

---

## 2. Refined Recommendation: "Adaptive Viewports" (Model B - CSS Tabs)

We recommend an **Adaptive Viewport Architecture** that keeps the unified side-by-side split screen on wide monitors, but adopts a **single-screen-at-a-time (tabbed) model** for smaller screens:

1. **Landscape iPad & Desktop (≥ 1024px):** Render side-by-side panes with the `DragDivider` draggable split.
2. **iPhone & Portrait iPad (< 1024px):** Show only one pane at a time (either the full-screen Orb conversation or the full-screen Task Backlog). Toggling between them is handled via a client-side layout swap.

### Implementation Architecture: Attribute-Driven CSS Toggling (Model B)
To ensure the transition is instantaneous, maintains state, and keeps the DOM mounted without complex inline style injection:

* **Container Attribute:** The parent dashboard container (`.ud-split`) receives a `data-active-tab="orb"` or `data-active-tab="list"` attribute.
* **Visibility Mechanics (Preserving Scroll Position):** Instead of using `display: none` (which unmounts elements from the layout flow and causes scroll position loss in long tables/boards), we use a combination of `visibility: hidden`, `position: absolute`, and `width: 0 / height: 0` for the inactive pane on narrow viewports:
  ```css
  @media (max-width: 1023px) {
    .ud-divider {
      display: none !important; /* Hide drag handle */
    }
    
    /* When Orb is active, hide list pane */
    .ud-split[data-active-tab="orb"] .ud-list-pane {
      position: absolute;
      visibility: hidden;
      width: 0;
      height: 0;
      overflow: hidden;
    }
    .ud-split[data-active-tab="orb"] .ud-orb-pane {
      width: 100% !important;
      height: 100% !important;
      visibility: visible;
    }

    /* When List is active, hide orb pane */
    .ud-split[data-active-tab="list"] .ud-orb-pane {
      position: absolute;
      visibility: hidden;
      width: 0;
      height: 0;
      overflow: hidden;
    }
    .ud-split[data-active-tab="list"] .ud-list-pane {
      width: 100% !important;
      height: 100% !important;
      visibility: visible;
    }
  }
  ```
  This keeps both panes fully mounted, maintains active text area scroll/focus and task table scroll positions, and prevents the browser from incurring expensive repaint costs for the hidden content.

---

## 3. Interaction Mechanics & Scope for Version 1

Based on peer AI consultation, we have refined the transition mechanics to focus on clarity, prevent viewport hijacking, and avoid gesture conflicts:

### 1. Minimal Bottom Navigation Bar (V1 Scope)
On screens `< 1024px`, render a sticky bottom navigation bar.
* **Two Tabs:** `Orb Assistant` and `Task Backlog`.
* **Consistent Icon Language:** Do not use emojis. Use the existing SVG assets from the codebase:
  * **Orb Assistant:** The glowing Orb SVG favicon (from the top command bar).
  * **Task Backlog:** The grid-table SVG icon (from the layout pane toggle).
* **Target Size:** Standard `48px` height with large hit zones complying with touch-first accessibility guidelines.

### 2. Orb-to-Task Linkage (V1 Scope)
* When the Orb mentions specific tasks in its chat log (e.g. "I updated task #123"), it outputs a clickable link or pill.
* Tapping this link/pill in the chat area:
  1. Switches the active viewport tab to `list`.
  2. Scrolls the view to target task `#123`.
  3. Plays a subtle, brief highlight glow on the target row or Kanban card.
* *Note: The reverse "Ask Orb" shortcut on every individual row/card is deferred to later versions to prevent visual clutter in V1.*

### 3. Excluded Mechanics (Rejected)
* **Swipe Gestures (REJECTED):** Swiping horizontally to switch screens is skipped because it directly conflicts with the horizontal scroll navigation of the Kanban board columns.
* **Smart Focus Auto-Switching (REJECTED):** We will not auto-switch viewports on background updates. Forcing a viewport switch when the Orb finishes processing is disorienting and hijacks the screen. Instead, the Orb will politely output a hint (e.g., *"Done! Tap 'Task Backlog' below to inspect the updated board"*).

---

## 4. Technical Evaluation Matrix

| Metric | Model A (Routes) | Model B (CSS Tabs - Refined) | Model C (Bottom Sheet) |
|---|---|---|---|
| **Mobile Real-Estate** | **Excellent** (100% space) | **Excellent** (100% space) | **Good** (covers list context) |
| **State Persistence** | **Poor** (requires hoisting) | **Perfect** (remains mounted) | **Perfect** (remains mounted) |
| **Scroll Retention** | **None** (unmounts scroll view) | **Perfect** (`visibility: hidden`) | **Perfect** (remains mounted) |
| **Switch Latency** | **Medium** (100-300ms) | **Instant** (< 5ms) | **Instant** (CSS animation) |
| **Implementation Cost** | High (routing structure rewrite) | **Low** (media queries + tab state) | Medium (iOS Safari keyboard fixes) |
| **Desktop Continuity** | Complex (dual codebases) | **Simple** (one unified layout) | Simple (one unified layout) |

---

## 5. Implementation Plan

1. **State Injection (`components/UnifiedDashboard.tsx`):**
   - Inject `activeMobileTab` state:
     ```typescript
     const [activeMobileTab, setActiveMobileTab] = useState<'orb' | 'list'>('list')
     ```
   - Bind `activeMobileTab` to the outer split wrapper:
     ```tsx
     <div ref={splitRef} className="ud-split" data-active-tab={activeMobileTab}>
     ```

2. **Add Bottom Nav Component:**
   - Render a sticky bottom navigation bar at the base of the page, visible only on `< 1024px`.
   - Wire the tab switch buttons to `setActiveMobileTab('orb')` and `setActiveMobileTab('list')`.

3. **Media Query & CSS Adjustments (`app/globals.css`):**
   - Implement the `visibility: hidden` and `position: absolute` selector patterns for the inactive tab pane when screen width is `< 1024px`.
   - Ensure the sticky bottom navigation offsets the scroll height of both panes by adding a bottom padding equal to the nav bar height to prevent layout truncation.
