import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OWNER_PROJECT_CODE = process.argv[2] || 'ORB'

const TITLE = 'Access Hardening, Email Syncing, and Admin Ticket Notifications'

const CONTENT = `ARCHITECTURAL SUMMARY: Login Hardening, Email Change Tracking, and Ticket Alerts

1. INVITATION-ONLY LOGIN BLOCKER (app/auth/login/page.tsx, app/actions/auth-actions.ts)
To secure the application for invited users, we added a pre-login authorization check. Before requesting a Supabase OTP code, the system validates the email against registered users and pending invitations. Uninvited users are blocked and shown an informative warning, preventing unauthorized account creation.

2. STABLE IDENTITY & EMAIL SYNCHRONIZATION (lib/resolve-user.ts)
Supabase can replace auth UUIDs on re-invite, meaning email is the stable identity. To handle users changing their emails:
- resolveUser() first queries by the stable auth UUID (authId).
- If the email in Supabase Auth differs from the email in public.users, it synchronizes public.users and public.invitations tables.
- It records a user_update audit log event showing the previous and new email addresses.

3. ADMIN NOTIFICATIONS FOR TICKETS (app/actions/ticket-actions.ts)
When a new ticket is submitted:
- Admins and Super Admins (roles 1 and 3) are fetched.
- They are notified in parallel via a styled email (Resend) and a Web Push Alert (VAPID manager).
- Emails use dynamic origin resolution (reconstructed from headers, falling back to SITE_URL) to ensure dashboard links point to the originating environment (e.g., localhost:3001).
- VAPID push alerts point to /settings/tickets and use unique tags to prevent duplicate alerts.`

async function populateKnowledge() {
  console.log('--- Registering Access Hardening & Notifications in Knowledge Repository ---')

  const { data: existing } = await supabase
    .from('knowledge_repo')
    .select('id')
    .eq('title', TITLE)
    .maybeSingle()

  if (existing) {
    console.log('Skipping: Entry already exists globally')
    process.exit(0)
  }

  const { data: owner, error: ownerErr } = await supabase
    .from('projects')
    .select('id, name, code')
    .eq('code', OWNER_PROJECT_CODE)
    .maybeSingle()

  if (ownerErr || !owner) {
    console.error(`Owner project "${OWNER_PROJECT_CODE}" not found:`, ownerErr?.message || 'No match')
    process.exit(1)
  }

  const { error: insertErr } = await supabase.from('knowledge_repo').insert({
    product_id: owner.id,
    title: TITLE,
    content: CONTENT,
    tags: ['security', 'auth', 'notifications', 'email', 'push']
  })

  if (insertErr) {
    console.error('Error inserting:', insertErr.message)
    process.exit(1)
  }

  console.log(`Success: Knowledge entry saved (anchored to [${owner.code}])`)
  console.log('--- Knowledge Repository Sync Complete ---')
  process.exit(0)
}

populateKnowledge()
