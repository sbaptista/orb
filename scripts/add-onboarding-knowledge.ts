import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const TITLE = 'Pre-Alpha Onboarding Lifecycle & OTP Token Hashing Architecture'

const CONTENT = `ARCHITECTURAL SUMMARY: Pre-Alpha Invitation, Token Verification, and Onboarding

1. TOKEN VERIFICATION & FLOW
Supabase default invitation links use Implicit Flow, returning tokens via browser hash fragments (#access_token=...). Since hash fragments reside strictly client-side, Next.js server-side Route Handlers (app/auth/callback/route.ts) cannot read them. 
To bypass this, we generate a custom query-parameterized link: /auth/callback?token_hash=HASHED_TOKEN&type=invite. The token is verified server-side using supabase.auth.verifyOtp to write session cookies securely.

2. DYNAMIC ORIGIN RESOLUTION
Next.js dev servers bind to 0.0.0.0, resolving server-side request.url origin to 0.0.0.0:3001. If users visit 192.168.86.90:3001 or localhost:3001, verification succeeds on that request host, but redirects to 0.0.0.0:3001. Because domain hosts mismatch, cookies are not sent, triggering a middleware auth-failure loop.
To prevent this, the callback route resolves browser origins dynamically from incoming Host and x-forwarded-host request headers, keeping the user strictly on the same matching host.

3. WELCOME ONBOARDING ISOLATION
Onboarding welcome messages and default pre-filled input prompts are tied to user-specific local storage keys: todos_welcome_shown_\${user.id}. This prevents one user's dismissed onboarding prompt from leaking to another user logging in on the same browser.

4. SESSION CROSSOVER PREVENTION
To prevent invitees from inheriting a previous user's active session in case of token failure or duplicate tab states:
- The callback handler calls await supabase.auth.signOut() before OTP verification.
- On mount, AmbientDashboard.tsx verifies the current user. If todos_user_id in sessionStorage differs from user.id, it purges all stored transcripts and inputs.

5. EMPTY BACKLOG RESOLUTION
Removed global selectedId restrictions to allow project-less users to interact with conversational commands (e.g. "Create a project called Work" or /help) directly via chat on signup, while protecting specific tasks and edit commands with localized checks.`

async function populateKnowledge() {
  console.log('--- Registering Onboarding Revamp in Knowledge Repository ---')

  // 1. Fetch all projects
  const { data: projects, error: projectErr } = await supabase
    .from('projects')
    .select('id, name, code')

  if (projectErr || !projects || projects.length === 0) {
    console.error('Failed to fetch projects:', projectErr?.message || 'No projects found')
    process.exit(1)
  }

  console.log(`Found ${projects.length} projects. Populating knowledge...`)

  for (const project of projects) {
    console.log(`Syncing knowledge item for [${project.code}] ${project.name}...`)

    // Check if a similar title already exists for this project to prevent duplicates
    const { data: existing } = await supabase
      .from('knowledge_repo')
      .select('id')
      .eq('product_id', project.id)
      .eq('title', TITLE)
      .maybeSingle()

    if (existing) {
      console.log(`  Skipping: Already exists for [${project.code}]`)
      continue
    }

    const { error: insertErr } = await supabase.from('knowledge_repo').insert({
      product_id: project.id,
      title: TITLE,
      content: CONTENT,
      tags: ['onboarding', 'auth', 'security', 'otp', 'architecture']
    })

    if (insertErr) {
      console.error(`  Error inserting for [${project.code}]:`, insertErr.message)
    } else {
      console.log(`  Success: Saved for [${project.code}]!`)
    }
  }

  console.log('--- Knowledge Repository Sync Complete ---')
  process.exit(0)
}

populateKnowledge()
