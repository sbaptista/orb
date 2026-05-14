import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: users } = await supabase.from('users').select('id, email, first_name')
  const { data: projects } = await supabase.from('projects').select('id, name, created_by')
  const { data: todos } = await supabase.from('todos').select('id, title, status, product_id').ilike('title', '%Trouble Ticket%')
  
  fs.writeFileSync('scripts/db_out.json', JSON.stringify({ users, projects, todos }, null, 2))
}
check()
