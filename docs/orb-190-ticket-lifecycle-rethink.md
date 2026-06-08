# ORB-190 Ticket Lifecycle Rethink

## Purpose

This note collects the current understanding of ORB-190 so Gemini, Claude, or another agent can continue without rediscovering the history.

## Source Task

**ORB-190 — Implement ticket→todo linkage with auto-close and user notification**

Current status when reviewed: `in progress`

Original intent:

- Add database linkage between tickets and todos.
- Auto-close a ticket when its linked todo is closed.
- Notify the ticket creator when the linked todo is resolved.
- Update Orb guidance:
  - AI-observed issues in current scope should become todos directly.
  - `create_ticket` should be reserved for user-reported issues or cross-cutting concerns that need triage.

## What Already Exists

The task is not untouched. Later work implemented substantial pieces:

- `tickets.todo_id`
- `todos.ticket_id`
- `createTodoFromTicket()` in `app/actions/ticket-actions.ts`
- Ticket → todo creation from Settings → Tickets
- Reporter acknowledgment emails
- Reporter progress/status emails
- Ticket code propagation
- Admin ticket lifecycle UI
- Multiple ticket states:
  - `open`
  - `in_progress`
  - `pending`
  - `awaiting_input`
  - `pending_release`
  - `pending_verification`
  - `on_hold`
  - `deferred`
  - `closed`
  - `dismissed`

## Historical Pivot

The original automation was partially implemented by **ORB-202**:

> When `createTodoFromTicket` succeeds and the ticket is linked to the new todo, the ticket status is automatically set to closed with a `closed_at` timestamp. The existing `updateTicketStatus` notification flow fires to notify the reporter.

That was later deliberately changed by **ORB-213**.

The key Knowledge Repo entry is:

**Manual progression lifecycle and interactive column resizing**  
`2026-06-06 — Antigravity (Gemini 3.5 Flash)`

Relevant conclusion:

> Decoupled ticket statuses from todo updates to prevent automated state changes on linked feedback.

The changelog also records this pivot in `v0.5.149`:

> Tickets Manual Progression: Decoupled ticket states from todo actions so closing a todo does not automatically close its linked ticket.

## Why The Original Auto-Close Was Diverted

The core issue is that ORB-190 collapsed two different lifecycles:

- **Engineering todo lifecycle:** internal work tracking.
- **Reporter ticket lifecycle:** external communication and expectation tracking.

Closing a todo is not enough information to decide the correct reporter-facing outcome.

A linked todo may be closed because:

- the fix is implemented but not released,
- it is pending verification,
- it was deferred,
- it was rejected,
- it needs more user input,
- it was merged into another task,
- it is technically done but not user-visible yet,
- it resolved the engineering task but should not send a “fixed” email yet.

So full auto-close was too blunt. It risked telling reporters that an issue was resolved when the product lifecycle was not actually ready for that message.

## Better Direction

The right rethink is probably **assisted progression**, not full automation.

Keep the ticket/todo linkage, but when a linked todo closes, surface an intentional decision point:

1. Detect that the closed todo has a linked ticket.
2. Prompt the admin/developer/Orb:
   - “This todo is linked to TICKETS-N. What should happen to the reporter ticket?”
3. Offer lifecycle choices:
   - `pending_release`
   - `pending_verification`
   - `closed` with version
   - `dismissed` with reason
   - `awaiting_input`
   - `deferred`
   - no change
4. Preview the reporter-facing email before sending.
5. Record the decision in the ticket status fields and audit trail.

This preserves the judgment ORB-213 introduced while reducing the chance that linked tickets are forgotten.

## Possible Product Shape

### Admin UI

When a linked todo is closed:

- Show a visible prompt or queue item in Settings → Tickets.
- Highlight tickets whose linked todo is closed but whose ticket status is not final.
- Provide a quick action menu:
  - “Mark pending release”
  - “Mark pending verification”
  - “Close and notify”
  - “Dismiss with explanation”
  - “Ask reporter for input”

### Orb Behavior

Orb should not silently auto-close reporter tickets.

Instead, when closing a linked todo through conversation, Orb should say something like:

> ORB-123 is closed. It is linked to TICKETS-7. Should I update the reporter ticket as pending release, pending verification, closed with a version, or leave it unchanged?

If mutation approval allows it, this can become a tool-assisted flow. Otherwise it should ask before changing the ticket.

### Eval Implication

If Orb conversation behavior changes, update `scripts/eval-cases.ts`.

Suggested eval:

- User asks Orb to close a todo linked to a ticket.
- Expect `update_todo` call.
- Expect no automatic `update_ticket` / ticket close unless the user explicitly asks.
- Speech should mention the linked ticket needs a reporter-facing lifecycle decision.

## Open Design Questions

- Should the linked-ticket prompt appear immediately after any linked todo is closed, or only when the ticket is still `open` / `in_progress`?
- Should `pending_release` be the default recommendation when a todo is closed with resolution notes?
- Should a release/version be required before sending “closed” email?
- Should dismissed/no-action outcomes require a reason?
- Should reporter emails always be manual-previewed, or can trusted templates send automatically for some statuses?
- Should this be implemented first in Settings → Tickets, then later through Orb conversation?

## Recommended Next Step

Do not implement ORB-190 as originally written.

Rewrite/split it into a clearer task:

**“Add assisted ticket lifecycle progression for linked todos.”**

Acceptance criteria:

- Linked todo closure does not auto-close the ticket.
- The system detects linked tickets that need follow-up.
- Admin UI or Orb offers explicit lifecycle actions.
- Reporter notification is previewed or deliberately confirmed.
- Knowledge repo and eval suite are updated if Orb behavior changes.

