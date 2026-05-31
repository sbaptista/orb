# Developer-to-Orb Communication Channel

## Context

When developer AI tools (Claude Code, Gemini CLI) build features for Orb, Stan currently acts as a manual relay — copy-pasting questions from the developer tool into the Orb UI and responses back. This feature creates a direct, bidirectional API channel between developer tools and the Orb AI, with all exchanges visible inline in the Orb conversation UI.

Key constraint from Stan: **no action can take place on either end without his approval.** Developer tools can ask questions and share context; the Orb can respond with information; but neither side creates, updates, or deletes anything autonomously.

The channel also serves as context sharing — developer tools can tell the Orb what they just built so it has session awareness.

---

## Phase 1: Database Schema

**Create:** `scripts/migrations/20260531_dev_channel.sql`

```sql
CREATE TABLE dev_channel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction       TEXT NOT NULL CHECK (direction IN ('dev_to_orb', 'orb_to_dev')),
  sender_label    TEXT NOT NULL,        -- "Claude Code (Opus 4.6)", "Gemini CLI"
  content         TEXT NOT NULL,
  product_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  session_summary TEXT,                 -- optional working session encapsulation
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'delivered', 'processed')),
  orb_response    TEXT,                 -- Orb's reply (for dev_to_orb messages)
  metadata        JSONB DEFAULT '{}',   -- model, session_id, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_dev_channel_status ON dev_channel (status) WHERE status = 'pending';
CREATE INDEX idx_dev_channel_product ON dev_channel (product_id);
```

RLS: admin-only access (same pattern as tickets table).

Schema supports bidirectional (`direction` column) and the full message lifecycle (`status`: pending → delivered → processed).

---

## Phase 2: API Route

**Create:** `app/api/dev-channel/route.ts`

Auth: identical to `app/api/tasks/route.ts` — `ORB_API_ENABLED` gate, `ORB_API_SECRET` in Authorization header, `resolveTargetUserId` via X-User headers.

### POST /api/dev-channel — Send message to Orb

Request:
```json
{
  "content": "I finished the dev channel API. Are there related open todos?",
  "sender_label": "Claude Code (Opus 4.6)",
  "product_code": "ORB",
  "session_summary": "Working on dev-to-Orb channel. Created migration and API route."
}
```

Response: `201 { id, status: "pending", created_at }`

### GET /api/dev-channel — Poll for responses

Query: `?status=processed&direction=dev_to_orb&since=<ISO>`

Returns messages with `orb_response` populated. Developer tools poll this to get the Orb's answers.

---

## Phase 3: Orb Processing (Restricted Tool Set)

**Modify:** `lib/orb-contract.ts` — add `ORB_TOOLS_READ_ONLY` constant filtering to: `query_todos`, `search_knowledge`, `query_db`, `query_audit_trail`, `query_capabilities`.

**Create:** `app/actions/dev-channel.ts` — server actions:

- `fetchPendingDevMessages(productId)` — returns undelivered dev_to_orb messages
- `markDevMessageDelivered(id)` — sets status to 'delivered'
- `processDevMessage(id)` — calls `orbConverse` variant with:
  - Read-only tools only (no mutations)
  - Modified system prompt identifying the sender as a developer AI tool
  - Instruction: if a mutation is requested, describe what would be done and say Stan must approve
- Saves `orb_response` on the `dev_channel` row
- Logs exchange to `knowledge_repo` tagged `['dev-channel', senderLabel]`

---

## Phase 4: UI — Message Rendering

**Modify:** `components/OrbConversation.tsx`

Extend `ConversationMessage`:
```typescript
type ConversationMessage = {
  id: string
  type: 'user' | 'orb' | 'dev'   // add 'dev'
  text: string
  isStreaming?: boolean
  thoughts?: string[]
  senderLabel?: string            // "Claude Code (Opus 4.6)"
}
```

Add `DevCard` component (private, alongside existing `OrbCard`):
- Left-aligned like Orb messages
- Distinct visual: subtle blue/purple tint background, left accent border, small sender label header
- Sender label shows tool name + model in small uppercase text

Rendering order in the message loop: `dev` → `DevCard`, `user` → user bubble, `orb` → `OrbCard`.

**Modify:** `app/globals.css`

Add `.oc-dev-card` and `.oc-dev-label` classes. Blue-tinted card with left accent border, distinct from Orb's neutral and user's right-aligned style.

---

## Phase 5: UI — Polling and Injection

**Modify:** `components/UnifiedDashboard.tsx` (the active dashboard component — NOT AmbientDashboard which is orphaned)

On tab focus (via existing `useVisibilityRefetch` pattern):
1. Call `fetchPendingDevMessages(selectedId)`
2. If messages found, inject them into `messages` state as `type: 'dev'`
3. Mark as delivered in DB
4. Auto-trigger `processDevMessage()` to get Orb's response
5. Orb's response appears as a normal `type: 'orb'` message following the dev card

User sees: tab back to Orb → dev message card appears → Orb auto-responds below it.

---

## Phase 6: Knowledge Repo Logging

Every processed exchange is written to `knowledge_repo`:
- **title:** `"Dev Channel: {truncated question}"`
- **content:** `"**{senderLabel}:** {question}\n\n**Orb:** {answer}"`
- **tags:** `['dev-channel', 'auto-logged']`
- **product_id:** from the message

---

## Files Summary

| Action | File | What |
|--------|------|------|
| Create | `scripts/migrations/20260531_dev_channel.sql` | Table + indexes + RLS |
| Create | `app/api/dev-channel/route.ts` | REST API (POST, GET) |
| Create | `app/actions/dev-channel.ts` | Server actions for processing |
| Modify | `lib/orb-contract.ts` | `ORB_TOOLS_READ_ONLY` constant |
| Modify | `components/OrbConversation.tsx` | `'dev'` message type + `DevCard` |
| Modify | `components/UnifiedDashboard.tsx` | Tab-focus polling + injection |
| Modify | `app/globals.css` | `.oc-dev-card`, `.oc-dev-label` styles |

---

## Verification

1. **Migration:** Run SQL, verify `\d dev_channel`
2. **API POST:** curl a test message, expect `201`
3. **UI rendering:** Switch tab and back, dev message appears as blue-tinted card with sender label
4. **Mutation blocking:** Send "create a todo called test" — Orb responds saying Stan must approve, no todo created
5. **Knowledge logging:** Check `knowledge_repo` for `dev-channel` tagged entry after processing
6. **Developer polling:** `GET /api/dev-channel?status=processed` returns message with `orb_response`
7. **Live test:** From this Claude Code session, POST a context summary and verify end-to-end

---

## Deferred to v2

- **Orb → Developer direction:** Schema supports it (`direction = 'orb_to_dev'`) but no write path exists yet. Would let the Orb flag things for developer tools to pick up — potentially replacing or complementing the ticket system.
- **Mutation approval flow:** v1 blocks mutations. v2 adds Approve/Reject buttons in the UI when the Orb says a mutation was requested.
- **Multi-tool registration:** v1 uses `sender_label` as display text. v2 could add per-tool API keys and capability scoping.
