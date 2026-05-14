import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: users } = await supabase.from('users').select('id, email, first_name')
  console.log("Users:")
  console.table(users)

  const { data: projects } = await supabase.from('projects').select('id, name, created_by')
  console.log("Projects:")
  console.table(projects)
}
check()
