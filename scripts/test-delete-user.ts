import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SECRET_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const testEmail = 'delete-test-email@example.com'
  
  // 1. Setup: Insert a test user and test invitations
  console.log('Inserting test data...')
  
  // Create user in auth.users
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
    password: 'testpassword123'
  })
  if (authErr) {
    console.error('Error creating auth user:', authErr)
    return
  }
  const userId = authUser.user.id
  console.log('Auth user created with ID:', userId)
  
  // Create user in public.users
  const { error: userErr } = await supabase.from('users').insert({
    id: userId,
    email: testEmail,
    first_name: 'Delete',
    last_name: 'Test',
    role_id: 2
  })
  if (userErr) {
    console.error('Error creating public user:', userErr)
    // Clean up
    await supabase.auth.admin.deleteUser(userId)
    return
  }
  console.log('Public user created.')
  
  // Create multiple test invitations
  const { error: inviteErr } = await supabase.from('invitations').insert([
    { email: testEmail, status: 'accepted' },
    { email: testEmail, status: 'pending' },
    { email: 'DELETE-TEST-EMAIL@example.com', status: 'accepted' } // test casing
  ])
  if (inviteErr) {
    console.error('Error creating invitations:', inviteErr)
    // Clean up
    await supabase.from('users').delete().eq('id', userId)
    await supabase.auth.admin.deleteUser(userId)
    return
  }
  console.log('Test invitations created.')
  
  // 2. Perform deletion replication
  console.log('Performing delete replication...')
  
  // Delete from public.users
  const { error: dbError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)
  if (dbError) {
    console.error('Error deleting public user:', dbError)
  }
  
  // Delete invitations
  const { error: inviteDelError } = await supabase
    .from('invitations')
    .delete()
    .ilike('email', testEmail.trim().toLowerCase())
  if (inviteDelError) {
    console.error('Error deleting invitations:', inviteDelError)
  }
  
  // Delete auth user
  const { error: authDelErr } = await supabase.auth.admin.deleteUser(userId)
  if (authDelErr) {
    console.error('Error deleting auth user:', authDelErr)
  }
  
  // 3. Verify
  const { data: invitesAfter } = await supabase.from('invitations').select('id').ilike('email', testEmail)
  console.log(`Invitations remaining: ${invitesAfter?.length}`)
  if (invitesAfter?.length === 0) {
    console.log('SUCCESS: All invitations deleted.')
  } else {
    console.log('FAILURE: Some invitations remain.')
  }
}

run()
