# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.38
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Uncommitted Changes

All changes below are uncommitted and unstaged:

- **app/globals.css** & **components/AmbientDashboard.tsx** & **components/OrbConversation.tsx** — Finalized Ambient Dashboard UI. Adjusted Orb positioning within the conversation wrapper, aligned conversation container to the footer, removed extra margins, added a 5px gap between user requests and responses, and fixed auto-scroll behavior for new messages. Also bumped z-index to resolve mask overlap issues. Added a "Force Quiet State" button to the Dev Panel.

---

## Last Session Completed

**Ambient Dashboard UI Redesign & Architecture Overhaul**

This session shifted the Orb dashboard away from relying on fixed viewport positioning to a responsive flex-column flow to fix critical mobile/iOS layout bugs where the keyboard would hide the input surface.

The redesign also established two distinct interface modes:
- **Ambient Mode:** Container backgrounds and borders disappear. The Orb sits centered. Project strip floats neatly at the bottom.
- **Dialogue Mode:** The Orb scales down to 35% and retreats to the top-right corner out of the way. Responses become boxed, and the container adopts a translucent blur effect to let the Mural canvas bleed through.
- **Conversation State:** Idle timeouts no longer permanently delete the conversation history, but rather collapse it behind a toggle button.

---

## Key Lesson (Last Session)

Relying on `position: fixed` or bottom-anchored absolute positioning on mobile (particularly iOS Safari) causes significant UX friction during keyboard deployment. Standardizing on `100dvh` flex-column architectures with `flex-grow` ensures the viewport adjusts and pushes content up predictably without overlapping vital input zones.

Using `data-*` attributes (`data-mode`) is a highly effective, clean way to trigger complex multi-element CSS transitions without relying on React to inline heavily computed styles.

---

## Next Priorities

1. **Commit and push** the UI Redesign and previous CSS migrations.
2. Fetch live backlog at session start.
3. Address ORB-87 context gaps (project metadata, task relationships, user permissions).

---

## Open Backlog (fetch live)

```bash
curl -s "https://orb-eight-lake.vercel.app/api/tasks?product=ORB&status=open" -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

---

## AI Tool Used Last Session

`2026-05-12 — Antigravity (DeepMind Agentic AI)`

---

*Updated by AI at end of each session. Committed with session code changes.*
