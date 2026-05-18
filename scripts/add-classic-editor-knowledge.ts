import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OWNER_PROJECT_CODE = process.argv[2] || 'ORB'

const TITLE = 'Classic Editor Navigation & Ambient Dashboard Actions Shortcut'

const CONTENT = `ARCHITECTURAL SUMMARY: Classic Editor Navigation & Ambient Dashboard Actions Shortcut

1. CONTEXT & REQUIREMENT
Currently, the Orb image in the AmbientDashboard is the only way to navigate to the list-based todo editor (TodoView), which is non-obvious for users. To improve discoverability and accessibility, we added a direct entry point (Classic Editor shortcut) in the top-right actions list, positioned directly to the left of the Help, Settings, and User buttons.

2. CONDITIONAL INTERACTION & ACCESSIBILITY
- When a project is active (selectedId is not null), the Classic Editor button is rendered as a Next.js <Link> pointing directly to the list view for that active project: /dashboard/\${selectedId}.
- When no project is selected (selectedId is null), the button is rendered as an HTML <button> with a disabled attribute.
- Sets standard accessibility tags: title="Classic Editor" and aria-label="Classic Editor".

3. SPREADSHEET / TABLE GRID ICON
Implemented a clean 18x18 SVG spreadsheet/table grid icon (drawn with <rect> and grid lines <line>) that perfectly matches the existing AmbientDashboard SVG action icons (Help, Settings).

4. COHESIVE DISABLED STATE STYLING
Added a .nav-btn:disabled and .nav-btn-disabled class rule in app/globals.css:
- opacity: 0.35;
- cursor: not-allowed;
- pointer-events: none;
- background: rgba(255, 255, 255, 0.4);
- border-color: rgba(60, 110, 60, 0.1);
This elegantly grays out the spreadsheet button when no active project is selected, preventing clicks or focus.`

async function populateKnowledge() {
  console.log('--- Registering Classic Editor Shortcut in Knowledge Repository ---')

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
    tags: ['navigation', 'dashboard', 'ux', 'classic-editor', 'accessibility']
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
