#!/usr/bin/env node
// scripts/migrations/migrate-tickets-todos.js
// ORB-148: One-time migration — move TICKETS project todos → tickets table
// Run: node scripts/migrations/migrate-tickets-todos.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local manually
const envPath = path.join(__dirname, '../../.env.local')
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => {
    const [k, ...v] = l.split('=')
    if (k) acc[k.trim()] = v.join('=').trim()
    return acc
  }, {})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY, // service role — bypasses RLS
)

// Maps TICKETS todo status → tickets table status
function mapStatus(todoStatus) {
  if (todoStatus === 'closed') return 'closed'
  if (todoStatus === 'in_progress') return 'in_progress'
  return 'open'
}

// Infer ticket type from title/description heuristics
function inferType(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase()
  if (text.includes('[bug]') || text.includes('bug') || text.includes('misalign') || text.includes('fix')) return 'bug'
  if (text.includes('suggestion') || text.includes('improve')) return 'suggestion'
  if (text.includes('capability') || text.includes('feature')) return 'capability_gap'
  if (text.includes('friction') || text.includes('workflow')) return 'workflow_friction'
  return 'bug' // default
}

async function run() {
  console.log('=== ORB-148: TICKETS → tickets migration ===\n')

  // 1. Get the TICKETS project
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, created_by')
    .eq('code', 'TICKETS')
    .is('deleted_at', null)
    .limit(1)

  if (projErr || !projects?.length) {
    console.error('❌ Could not find TICKETS project:', projErr?.message)
    process.exit(1)
  }
  const ticketsProject = projects[0]
  console.log(`✓ Found TICKETS project: ${ticketsProject.id}`)

  // 2. Get all todos in TICKETS project
  const { data: todos, error: todoErr } = await supabase
    .from('todos')
    .select('id, todo_number, title, status, description, resolution_notes, created_at, updated_at, closed_at')
    .eq('product_id', ticketsProject.id)
    .is('deleted_at', null)
    .order('todo_number', { ascending: true })

  if (todoErr) {
    console.error('❌ Could not fetch TICKETS todos:', todoErr.message)
    process.exit(1)
  }
  console.log(`✓ Found ${todos.length} todos in TICKETS project\n`)

  if (todos.length === 0) {
    console.log('Nothing to migrate.')
  } else {
    // 3. Get current max ticket_number
    const { data: maxRow } = await supabase
      .from('tickets')
      .select('ticket_number')
      .order('ticket_number', { ascending: false })
      .limit(1)

    let nextTicketNum = (maxRow?.[0]?.ticket_number ?? 0) + 1

    // 4. Migrate each todo → ticket
    for (const todo of todos) {
      const ticketStatus = mapStatus(todo.status)
      const ticketType = inferType(todo.title, todo.description)

      // Parse detail JSON from description if it contains "Details:\n{...}"
      let detail = {}
      if (todo.description) {
        const detailMatch = todo.description.match(/Details:\n(\{[\s\S]+\})\s*$/)
        if (detailMatch) {
          try { detail = JSON.parse(detailMatch[1]) } catch {}
        }
      }

      const ticket = {
        ticket_number: nextTicketNum++,
        type: ticketType,
        source: 'orb-auto',
        summary: todo.title.replace(/^\[.*?\]\s*/, ''), // strip [bug] prefix
        detail,
        conversation_snippet: null,
        reported_by: ticketsProject.created_by, // attribute to project owner
        status: ticketStatus,
        dismiss_reason: null,
        todo_id: null, // these are historical — no linked todo in new system
        notified_in_progress: ticketStatus !== 'open',
        notified_closed: ticketStatus === 'closed',
        created_at: todo.created_at,
        updated_at: todo.updated_at,
        closed_at: todo.closed_at,
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('tickets')
        .insert(ticket)
        .select('id, ticket_number, summary, status')
        .single()

      if (insertErr) {
        console.error(`  ❌ Failed to insert TICKETS-${todo.todo_number}: ${insertErr.message}`)
      } else {
        console.log(`  ✓ Migrated TICKETS-${todo.todo_number} → ticket #${inserted.ticket_number} (${inserted.status}): ${inserted.summary}`)
      }
    }
  }

  // 5. Mark TICKETS project dormant
  const { error: dormantErr } = await supabase
    .from('projects')
    .update({ is_dormant: true })
    .eq('id', ticketsProject.id)

  if (dormantErr) {
    console.error('\n❌ Failed to mark TICKETS project dormant:', dormantErr.message)
  } else {
    console.log('\n✓ TICKETS project marked dormant')
  }

  // 6. Final count
  const { count } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✅ Migration complete. Total tickets in table: ${count}`)
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
