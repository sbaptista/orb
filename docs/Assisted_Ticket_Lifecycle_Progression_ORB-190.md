# Assisted Ticket Lifecycle Progression (ORB-190)

Implement an assisted progression model for reporter tickets when their linked engineering todos are closed, rather than using full auto-closing automation. This bridges the gap between the developer's internal todo lifecycle and the reporter's external expectations, keeping the administrator/Orb in control.

## User Review Required

> [!NOTE]
> This plan changes the ticket lifecycle from a fully automated one (where closing a todo automatically closed a ticket) to an **assisted progression** model. The administrator/Orb will have full control over when a ticket is closed or transitioned to other statuses (e.g. pending release, pending verification) with previewed emails.

> [!IMPORTANT]
> **Aesthetics & HIG target compliance:** Warning indicators and modal alerts reuse the warm amber colors (`bg: #fef3c7`, `color: #d97706`) matching the existing `pending` ticket status style. No new global CSS rules are added, keeping the design premium and consistent with [ui-catalog.md](file:///Users/stanleybaptista/Projects/orb/docs/ui-catalog.md).

## Open Questions

None. The design details map perfectly to the recommendations in [orb-190-ticket-lifecycle-rethink.md](file:///Users/stanleybaptista/Projects/orb/docs/orb-190-ticket-lifecycle-rethink.md).

---

## Proposed Changes

### Admin UI & Ticket Actions

#### [MODIFY] [ticket-actions.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/ticket-actions.ts)
* Update `Ticket` type definition to include the linked todo's `status` field.
* Update the Supabase `select` query in `getTickets()` to fetch `todos!todo_id ( todo_number, status, projects!product_id ( code ) )`.

#### [MODIFY] [SettingsTickets.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsTickets.tsx)
* Check if a ticket has a closed linked todo while the ticket status itself is not final (`status !== 'closed' && status !== 'dismissed'`).
* **Row Warning:** Render a prominent amber badge (`Todo Closed`) in both `renderRow` and `renderMobileRow` next to the linked todo code to draw the administrator's attention.
* **Modal Alert:** Display an warning banner inside the Edit Ticket modal when the ticket has a completed linked todo, prompting the admin to choose the next lifecycle action and customize the reporter-facing notification email.

---

### Conversational Orb & System Prompt

#### [MODIFY] [orb-converse.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/orb-converse.ts)
* Update the Supabase `select` query for `todos` in `buildContext()` to fetch the linked `ticket_id` and join `tickets!ticket_id ( ticket_number )`.
* Update the `todoLine()` helper to print `[Linked: TICKETS-N]` to the backlog context when a todo is linked to a ticket. This allows Claude to see the linkages directly in the backlog text.
* Update `update_todo` tool action: if the todo was transitioned to a closed status, check if it is linked to a ticket. If so, return `linked_ticket: "TICKETS-N"` and `is_closing: true` in the output.
* Update the `_verification` injection logic: if a todo with a linked ticket is closed successfully, append a dynamic verification prompt telling the model:
  `VERIFICATION: This "update_todo" call SUCCEEDED in closing [code]. IMPORTANT: This todo is linked to reporter ticket "[linked_ticket]". You MUST notify the user about this linkage in your speech and ask what should happen to the reporter ticket. Do not update or close the ticket automatically.`

#### [MODIFY] [route.ts](file:///Users/stanleybaptista/Projects/orb/app/api/orb-eval/route.ts)
* Sync the `todos` select query and the `todoLine` format changes with the eval route to keep the system prompt identical.

---

### Regression Testing

#### [MODIFY] [eval-cases.ts](file:///Users/stanleybaptista/Projects/orb/scripts/eval-cases.ts)
* Add a new eval case that asserts that when the user asks the Orb to close a todo linked to a ticket:
  1. The `update_todo` tool is called.
  2. The ticket is NOT closed automatically (no `update_ticket` or ticket updates).
  3. The Orb's speech informs the user of the linked ticket and asks for a progression decision.

---

## Verification Plan

### Automated Tests
* Run the Orb eval suite to ensure no regressions:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --tier 1`

### Manual Verification
1. Create a ticket.
2. Link the ticket to a todo (e.g. click "Create todo" in Settings -> Tickets).
3. Close the todo (either via the UI or by telling the Orb).
4. Verify in Settings -> Tickets that:
   - Row/card displays the `Todo Closed` alert.
   - Edit Modal displays the warning banner.
5. In the Orb conversation, verify that telling the Orb to close the todo triggers the new verification prompt, prompting the Orb to ask the user what to do with the ticket rather than closing it automatically.
