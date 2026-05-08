import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function archiveTodos() {
  console.log('--- TODOS Archival Process (TODOS-9) ---')
  
  // 1. Fetch aged closed todos
  // We look for tasks that are closed (status check depends on your specific status names, 
  // but typically 'done' or 'closed'). We'll use the is_closed flag if available.
  const THRESHOLD_DAYS = 30
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS)

  console.log(`Searching for tasks closed before ${thresholdDate.toISOString()}...`)

  // Get status names that are closed
  const { data: closedStatuses } = await supabase
    .from('statuses')
    .select('name')
    .eq('is_closed', true)

  const closedStatusNames = closedStatuses?.map(s => s.name) || ['done', 'closed']

  const { data: toArchive, error: fetchError } = await supabase
    .from('todos')
    .select('*, projects(code, name)')
    .in('status', closedStatusNames)
    .lt('closed_at', thresholdDate.toISOString())
    .is('archived_at', null)

  if (fetchError) {
    console.error('Error fetching todos:', fetchError.message)
    process.exit(1)
  }

  if (!toArchive || toArchive.length === 0) {
    console.log('No tasks found for archival. Everything is current.')
    return
  }

  console.log(`Found ${toArchive.length} tasks to archive.`)

  // 2. Prepare Archive File
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archiveDir = path.join(process.cwd(), 'archives')
  const archiveFile = path.join(archiveDir, `archive_${timestamp}.json`)

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir)
  }

  // 3. Write to Disk
  try {
    fs.writeFileSync(archiveFile, JSON.stringify(toArchive, null, 2))
    console.log(`Archive written to: ${archiveFile}`)
  } catch (err) {
    console.error('Failed to write archive file:', err)
    process.exit(1)
  }

  // 4. Mark as Archived and Purge from DB
  const idsToPurge = toArchive.map(t => t.id)
  
  console.log(`Purging ${idsToPurge.length} records from Supabase...`)
  
  const { error: deleteError } = await supabase
    .from('todos')
    .delete()
    .in('id', idsToPurge)

  if (deleteError) {
    console.error('Error during purge:', deleteError.message)
    console.log('Manual cleanup may be required. The archive file is safe.')
  } else {
    console.log('Purge successful. Database is now leaner.')
  }

  console.log('--- Archival Complete ---')
}

archiveTodos()
