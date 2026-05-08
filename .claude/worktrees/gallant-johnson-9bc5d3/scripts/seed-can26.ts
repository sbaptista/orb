// scripts/seed-can26.ts
// Run with: npx ts-node --skip-project scripts/seed-can26.ts
// Requires .env.local to be present in project root

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// ── Load CAN26 data ──────────────────────────────────────────
const dataPath = path.join(process.cwd(), 'scripts', 'CAN26_data_2026-03-31.json')
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
const can26Todos = raw.todos as any[]

// ── Status mapping ───────────────────────────────────────────
function mapStatus(s: string): string {
  if (s === 'done') return 'done'
  if (s === 'on-hold') return 'on_hold'
  return 'open'
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('Starting CAN26 seed...')

  // Get the authenticated user
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError || !users.length) {
    console.error('No users found. Make sure you have signed in at least once.')
    process.exit(1)
  }
  const userId = users[0].id
  console.log(`Seeding as user: ${users[0].email}`)

  // 1. Create CAN26 product
  console.log('\n1. Creating CAN26 product...')
  const { data: product, error: productError } = await supabase
    .from('projects')
    .insert({
      name: 'CAN26',
      description: 'Canadian Rockies trip planner — October 2026',
      color: '#2563eb',
      icon: '🏔️',
      sort_order: 1,
    })
    .select()
    .single()

  if (productError) {
    console.error('Product error:', productError.message)
    process.exit(1)
  }
  console.log(`  Created product: ${product.name} (${product.id})`)

  // 2. Collect unique groups and categories
  const uniqueGroups = [...new Set(can26Todos.map((t) => t.group).filter(Boolean))]
  const uniqueCategories = [...new Set(can26Todos.map((t) => t.category).filter(Boolean))]

  // 3. Insert groups
  console.log(`\n2. Inserting ${uniqueGroups.length} groups...`)
  const groupMap: Record<string, string> = {}
  for (let i = 0; i < uniqueGroups.length; i++) {
    const name = uniqueGroups[i]
    const { data, error } = await supabase
      .from('groups')
      .insert({ product_id: product.id, name, sort_order: i })
      .select()
      .single()
    if (error) { console.error(`  Group error (${name}):`, error.message); continue }
    groupMap[name] = data.id
    console.log(`  ${name}`)
  }

  // 4. Insert categories
  console.log(`\n3. Inserting ${uniqueCategories.length} categories...`)
  const categoryMap: Record<string, string> = {}
  for (let i = 0; i < uniqueCategories.length; i++) {
    const name = uniqueCategories[i]
    const { data, error } = await supabase
      .from('categories')
      .insert({ product_id: product.id, name, sort_order: i })
      .select()
      .single()
    if (error) { console.error(`  Category error (${name}):`, error.message); continue }
    categoryMap[name] = data.id
    console.log(`  ${name}`)
  }

  // 5. Insert todos
  console.log(`\n4. Inserting ${can26Todos.length} todos...`)
  let inserted = 0
  let failed = 0

  for (const t of can26Todos) {
    const priorityValue = t.urgent === true ? 1 : null

    const todo = {
      product_id: product.id,
      group_id: t.group ? groupMap[t.group] ?? null : null,
      category_id: t.category ? categoryMap[t.category] ?? null : null,
      priority_value: priorityValue,
      title: t.task ?? '',
      description: t.ref ?? null,
      resolution_notes: t.resolution || null,
      status: mapStatus(t.status ?? 'open'),
      urls: t.urls ?? [],
      sort_order: t.id ?? 0,
      created_at: t.createdAt || new Date().toISOString(),
      closed_at: t.closedAt || null,
    }

    const { error } = await supabase.from('todos').insert(todo)
    if (error) {
      console.error(`  FAILED: "${t.task}" — ${error.message}`)
      failed++
    } else {
      inserted++
    }
  }

  console.log(`\n✅ Done. ${inserted} todos inserted, ${failed} failed.`)
  console.log(`   Product: CAN26 (${product.id})`)
  console.log(`   Groups: ${Object.keys(groupMap).length}`)
  console.log(`   Categories: ${Object.keys(categoryMap).length}`)
}

main().catch(console.error)
