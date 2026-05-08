<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TODOS API — AI Access

Stan's todo backlog is queryable and writable during any session. Use this proactively:
- Fetch open todos at the start of a session to understand what's pending
- Post new todos as they come up during work without waiting for Stan to ask

**Base URL:** `https://todos-eight-lake.vercel.app`  
**Auth header:** `Authorization: <secret>`  
**Secret:** stored in `.env.local` as `TODOS_API_SECRET` — read it with Bash if needed  
**Kill switch:** `TODOS_API_ENABLED` must be `true` (it is)

## Fetch todos for a product

```bash
curl -s "https://todos-eight-lake.vercel.app/api/todos?product=HELM" \
  -H "Authorization: $(grep TODOS_API_SECRET /Users/stanleybaptista/Projects/todos/.env.local | cut -d= -f2)"
```

Replace `HELM` with `TODOS` for this project's backlog. Product codes are case-insensitive.

## Post a new todo

```bash
curl -s -X POST "https://todos-eight-lake.vercel.app/api/todos" \
  -H "Authorization: $(grep TODOS_API_SECRET /Users/stanleybaptista/Projects/todos/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"product_code":"HELM","title":"Your title here","description":"Optional","priority_value":1}'
```

`priority_value` is optional. Omit it if unknown. Title and product_code are required.

## Update a todo

```bash
curl -s -X PATCH "https://todos-eight-lake.vercel.app/api/todos/<id>" \
  -H "Authorization: $(grep TODOS_API_SECRET /Users/stanleybaptista/Projects/todos/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "status": "done",
    "priority_value": 2,
    "group_name": "Developer",
    "category_name": "Bug",
    "resolution_notes": "Describe what was done to fix it — populate when closing a todo, not before.",
    "urls": "https://example.com\nhttps://example2.com"
  }'
```

All fields are optional. `group_name` and `category_name` are resolved by name within the todo's product — no need to look up IDs. `urls` accepts either a JSON array or a newline-separated string. `resolution_notes` is for post-fix documentation — what was done, not what needs doing.

## Delete a todo

```bash
curl -s -X DELETE "https://todos-eight-lake.vercel.app/api/todos/<id>" \
  -H "Authorization: $(grep TODOS_API_SECRET /Users/stanleybaptista/Projects/todos/.env.local | cut -d= -f2)"
```

Soft delete — sets `deleted_at`, does not destroy the row.
