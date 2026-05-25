import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function run() {
  // Check if column already exists
  const { data: check, error: checkErr } = await supabase
    .from('projects')
    .select('view_mode')
    .limit(1)

  if (!checkErr) {
    console.log('Column view_mode already exists. Sample:', check)
    process.exit(0)
  }

  // Column doesn't exist — apply via RPC
  const { error } = await supabase.rpc('exec_sql' as any, {
    query: `ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'list' CONSTRAINT projects_view_mode_check CHECK (view_mode IN ('list', 'checklist'));`
  })

  if (error) {
    console.error('Could not apply migration automatically. Run manually:\n')
    console.log(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'list' CONSTRAINT projects_view_mode_check CHECK (view_mode IN ('list', 'checklist'));`)
    process.exit(1)
  }

  console.log('Migration applied.')
  process.exit(0)
}
run()
