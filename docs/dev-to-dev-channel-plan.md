# Proposal: Developer-to-Developer Communication Channel

## Status: Proposed
**Author:** Antigravity (Gemini 3.5 Flash)  
**Date:** 2026-06-01  
**Target Version:** v0.5.125 (or next release)

---

## 1. Context & Motivation

Orb development uses a **tag-team multi-agent workflow** (typically Gemini CLI for rapid iteration, refactoring, and bug fixes, and Claude Code for complex architecture and deep debugging).

Currently, context sharing and task transitions between these developer AIs are manual:
- Agents read and write static markdown files (`HANDOFF.md`, `WIP.md`).
- If an agent hits a usage/rate limit mid-task, it relies on these files to hand off state.
- Human oversight (Stan) acts as a relay, or incoming agents must run `git diff` to understand what was done.

We can extend the existing **Developer-to-Orb (dev_to_orb)** channel to support **Developer-to-Developer (dev_to_dev)** communication. This will allow developer AIs to leave structured handoffs, test results, code drafts, and queries for subsequent agents directly in the database.

---

## 2. Proposed Changes

### Phase 1: Database Migration
We will extend the `direction` CHECK constraint on the `dev_channel` table to allow `'dev_to_dev'`.

**SQL Migration File:** `scripts/migrations/20260601_dev_to_dev_channel.sql`
```sql
-- Allow dev-to-dev direction on dev_channel
ALTER TABLE dev_channel DROP CONSTRAINT dev_channel_direction_check;
ALTER TABLE dev_channel ADD CONSTRAINT dev_channel_direction_check 
  CHECK (direction IN ('dev_to_orb', 'orb_to_dev', 'dev_to_dev'));
```

---

### Phase 2: API Route Updates
We need to update [app/api/dev-channel/route.ts](file:///Users/stanleybaptista/Projects/orb/app/api/dev-channel/route.ts) to:
1. Accept the `direction` column in the `POST` payload (defaulting to `'dev_to_orb'`).
2. Add a `PATCH` endpoint to allow developer agents to update message statuses (e.g., mark a handoff as `processed` / `read`).

#### Updated POST & PATCH Handlers:
```typescript
// app/api/dev-channel/route.ts

// POST: Allow custom direction
export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { content, sender_label, product_code, session_summary, metadata, direction } = body

  if (!content || !sender_label) {
    return NextResponse.json({ error: 'Missing required fields: content, sender_label' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let productId: string | null = null
  
  if (product_code) {
    const targetUserId = await resolveTargetUserId(request, supabase)
    const { data: product } = await supabase
      .from('projects')
      .select('id')
      .ilike('code', product_code)
      .eq('created_by', targetUserId)
      .single()
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    productId = product.id
  }

  const { data, error } = await supabase
    .from('dev_channel')
    .insert({
      direction: direction ?? 'dev_to_orb', // Accept incoming direction (e.g., 'dev_to_dev')
      sender_label,
      content,
      product_id: productId,
      session_summary: session_summary ?? null,
      metadata: metadata ?? {},
    })
    .select('id, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH: Allow status updates (e.g. marking messages as processed)
export async function PATCH(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { id, status } = body

  if (!id || !status) {
    return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('dev_channel')
    .update({ 
      status, 
      processed_at: status === 'processed' ? new Date().toISOString() : null 
    })
    .eq('id', id)
    .select('id, status, processed_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}
```

---

## 3. Developer Tool Integration Workflow

Once the API changes are live, we will add the following rules to the shared configurations in `shared/AGENTS.md`:

### Startup Workflow (Checking for pending messages)
At the start of every session, the developer AI executes:
```bash
# Query the REST API for pending dev-to-dev messages
curl -s "https://orb-eight-lake.vercel.app/api/dev-channel?direction=dev_to_dev&status=pending" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```
1. If messages are found, the agent reads them into context.
2. The agent checks if the message's `metadata.target_agent` is intended for its tool name (e.g., `"Claude Code"`) or `"all"`.
3. Once processed, the agent marks the message as read via PATCH:
   ```bash
   curl -s -X PATCH "https://orb-eight-lake.vercel.app/api/dev-channel" \
     -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
     -H "Content-Type: application/json" \
     -d '{"id": "<message-id>", "status": "processed"}'
   ```

### Shutdown Workflow (Posting a hand-off)
When ending a session or hitting a rate limit mid-session, the developer AI posts a message detailing its work:
```bash
curl -s -X POST "https://orb-eight-lake.vercel.app/api/dev-channel" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "dev_to_dev",
    "sender_label": "Claude Code (Opus 4.6)",
    "content": "Staged changes for the layout refactor on ORB-194 but hit a metadata route collision in Next.js. The current state is committed in branch wip/orb-194-meta. Gemini should investigate the app/layout.tsx file next.",
    "product_code": "ORB",
    "metadata": { "target_agent": "Gemini CLI" }
  }'
```

---

## 4. Key Benefits

1. **Robust Context Synced Across Devices:** Because the handoff is stored in the database, it resolves the issues where agents operate in separate terminals, remote environments, or when local files aren't synced.
2. **Developer-to-Developer Q&A:** Allows an agent to ask a question to the next agent (e.g., "Hey Gemini, can you double check the touch coordinates handling on Android Chrome?").
3. **Structured Working Sessions:** Using the `session_summary` and `metadata` structures, agents can programmatically detect the state they need to recover.
4. **Human Transparency:** Stan can view these dev-to-dev logs via SQL, in the `knowledge_repo`, or through a future Developer Collaboration tab in settings, ensuring full visibility into agent coordination.
