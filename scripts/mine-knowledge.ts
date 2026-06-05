import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function mineKnowledge() {
  console.log('--- Starting the Great Knowledge Mining ---')

  // 1. Fetch all closed todos that don't have knowledge extracted yet
  const { data: closedTodos, error } = await supabase
    .from('todos')
    .select('*, projects(code, name)')
    .not('closed_at', 'is', null)

  if (error || !closedTodos || closedTodos.length === 0) {
    console.log('No closed tasks found to mine.')
    return
  }

  // Also check existing knowledge to avoid duplicates
  const { data: existingKnowledge } = await supabase.from('knowledge_repo').select('origin_todo_id')
  const existingIds = new Set(existingKnowledge?.map(k => k.origin_todo_id) || [])

  const toMine = closedTodos.filter(t => !existingIds.has(t.id))

  console.log(`Found ${toMine.length} closed tasks to analyze...`)

  for (const todo of toMine) {
    if (!todo.resolution_notes && !todo.description) continue

    console.log(`Mining [${todo.projects?.code}-${todo.todo_number}] ${todo.title}...`)

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929', 
        max_tokens: 500,
        system: "You are a senior technical writer. Extract the 'Gold' (the key technical decision or lesson learned) from the following task. Return a RAW JSON object with 'title' (short summary) and 'content' (the distilled insight). DO NOT use markdown formatting or code blocks. If there is no significant knowledge to extract, return { 'skip': true }.",
        messages: [{ role: 'user', content: `Task: ${todo.title}\nDescription: ${todo.description}\nResolution: ${todo.resolution_notes}` }]
      })

      const text = (response.content[0] as any).text
      // Surgical JSON extraction: find first { and last }
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      
      if (firstBrace === -1 || lastBrace === -1) {
          console.error('  Failed to find JSON block in response')
          continue
      }
      
      const jsonStr = text.substring(firstBrace, lastBrace + 1)
      const result = JSON.parse(jsonStr)

      if (result.skip) {
        console.log('  (No significant knowledge found)')
        continue
      }

      const { error: insertError } = await supabase.from('knowledge_repo').insert({
        product_id: todo.product_id,
        origin_todo_id: todo.id,
        title: result.title,
        content: result.content,
      })

      if (insertError) console.error(`  Error inserting insight: ${insertError.message}`)
      else console.log(`  Insight saved: ${result.title}`)

    } catch (err) {
      console.error(`  Failed to mine task ${todo.id}:`, err)
    }
  }

  console.log('--- Mining Complete ---')
}

mineKnowledge()
