import { SupabaseClient } from '@supabase/supabase-js'

export async function seedOnboardingProjects(admin: SupabaseClient, userId: string) {
  try {
    // Check if the three seed projects exist
    const { data: existingProjects, error: projError } = await admin
      .from('projects')
      .select('id, code')
      .eq('created_by', userId)
      .is('deleted_at', null)

    if (projError) {
      console.error('[seedOnboardingProjects] Check existing projects failed:', projError)
    }

    const seededCodes = (existingProjects || []).map(p => p.code?.toUpperCase())
    const createdProjects: Record<string, string> = {} // maps code -> id

    // Store existing projects mapping
    if (existingProjects) {
      existingProjects.forEach(p => {
        if (p.code) createdProjects[p.code.toUpperCase()] = p.id
      })
    }

    const projectsToCreate = [
      { name: 'Welcome & Guide', code: 'WELCOME', view_mode: 'checklist', description: 'Start here: Guided introduction to Orb features and testing.' },
      { name: 'Home Maintenance', code: 'HOME', view_mode: 'list', description: 'Personal home backlog for testing calm ambient states.' },
      { name: 'Urban Compost Initiative', code: 'ECO', view_mode: 'kanban', description: 'Environmental project backlog for testing urgent states, bottlenecks, and drag-and-drop.' }
    ]

    for (const p of projectsToCreate) {
      if (!seededCodes.includes(p.code)) {
        const { data: projData, error: createError } = await admin
          .from('projects')
          .insert({
            name: p.name,
            code: p.code,
            view_mode: p.view_mode,
            description: p.description,
            created_by: userId
          })
          .select('id')
          .single()

        if (createError) {
          console.error(`[seedOnboardingProjects] Failed to seed project ${p.code}:`, createError)
        } else if (projData) {
          createdProjects[p.code] = projData.id
        }
      }
    }

    // Query existing todos for the user's projects to avoid duplicates
    const projectIds = Object.values(createdProjects)
    const { data: existingTodos } = await admin
      .from('todos')
      .select('id, product_id, title')
      .in('product_id', projectIds)
      .is('deleted_at', null)

    const existingTitlesByProduct = new Map<string, Set<string>>()
    if (existingTodos) {
      existingTodos.forEach(t => {
        if (!existingTitlesByProduct.has(t.product_id)) {
          existingTitlesByProduct.set(t.product_id, new Set())
        }
        existingTitlesByProduct.get(t.product_id)!.add(t.title.toLowerCase().trim())
      })
    }

    const seedTodos = [
      // 1. WELCOME
      {
        productCode: 'WELCOME',
        title: "Mark this task as done to see the Orb shift its mood.",
        priority_value: 4,
        description: "The glowing Orb behaves like a living presence. Its color shifts and pulse rates are tied to the status and priorities of your active backlogs across all projects.",
        status: 'open'
      },
      {
        productCode: 'WELCOME',
        title: "Ask the Orb: 'What should I do next?'",
        priority_value: 4,
        description: "Ask this command in the conversation bar to see the Orb analyze your priorities across projects and recommend a strategic action.",
        status: 'open'
      },
      {
        productCode: 'WELCOME',
        title: "Try out the Kanban board drag-and-drop.",
        priority_value: 4,
        description: "Open the 'Urban Compost Initiative' project, click 'Views' in the toolbar, switch to 'Kanban' mode, and test drag-and-drop of tasks between status columns.",
        status: 'open'
      },
      {
        productCode: 'WELCOME',
        title: "Send a feedback message or report a bug.",
        priority_value: 4,
        description: "Try checking this task or another onboarding item to closed. Note how the ambient glow reflects the lightened workload.",
        status: 'open'
      },
      {
        productCode: 'WELCOME',
        title: "Heads-up: this is a pre-alpha. Please don't store anything sensitive. Don't assume anything is permanent.",
        priority_value: 4,
        description: "Just talk to the Orb. Say 'Report a bug: [issue description]' or 'Suggestion: [your idea]'. It will automatically file a ticket for the developer.",
        status: 'open'
      },
      {
        productCode: 'WELCOME',
        title: "Read the Pre-Alpha Testing guide in the Help tab.",
        priority_value: 4,
        description: "Click on 'Help' in the top navigation bar to read detailed suggestions on what to test, strategic commands, and privacy policies.",
        status: 'open'
      },

      // 2. HOME
      {
        productCode: 'HOME',
        title: "Inspect roof shingles for moss growth and damage",
        priority_value: 4,
        description: "Check the north side of the house after winter rains.",
        status: 'open',
        due_offset_days: 14
      },
      {
        productCode: 'HOME',
        title: "Clean HVAC filters and replace furnace battery",
        priority_value: 5,
        description: "Standard seasonal filter swap to keep air quality high.",
        status: 'open',
        due_offset_days: 10
      },
      {
        productCode: 'HOME',
        title: "Inventory backyard tools and organize shed",
        priority_value: 5,
        description: "Group hand tools together and hang the garden hose.",
        status: 'open'
      },

      // 3. ECO
      {
        productCode: 'ECO',
        title: "Secure municipal permit for neighborhood drop-off site",
        priority_value: 1, // Urgent
        description: "Urgent: We need city council approval before the public launch. Blocked by municipal zoning feedback.",
        status: 'open',
        due_offset_days: -2 // 2 days overdue
      },
      {
        productCode: 'ECO',
        title: "Negotiate bulk order for 200 residential compost bins",
        priority_value: 2, // High
        description: "Negotiations with vendor. Delivery timeline conflicts with launch date if not resolved by EOD today.",
        status: 'in progress',
        due_offset_days: 0 // Today
      },
      {
        productCode: 'ECO',
        title: "Draft community partnership outreach proposal",
        priority_value: 4, // Medium
        description: "Proposal for local grocery stores to host organic waste drop-off bins. Hard deadline overlaps with volunteer schedules.",
        status: 'open',
        due_offset_days: 1 // Tomorrow
      },
      {
        productCode: 'ECO',
        title: "Design educational signage for neighborhood collection stations",
        priority_value: 5, // Low
        description: "Graphics and text explaining what can and cannot be composted to avoid contamination.",
        status: 'open'
      },
      {
        productCode: 'ECO',
        title: "Coordinate volunteer kick-off and orientation schedules",
        priority_value: 2, // High
        description: "Organize training session for the initial 15 volunteer team members.",
        status: 'open',
        due_offset_days: 1 // Tomorrow
      },
      {
        productCode: 'ECO',
        title: "Set up website donation portal and sponsorship tiers",
        priority_value: 4, // Medium
        description: "Integrate Stripe payment links for local green donors.",
        status: 'open'
      }
    ]

    const now = new Date()
    for (const t of seedTodos) {
      const pId = createdProjects[t.productCode]
      if (!pId) continue

      const hasTitle = existingTitlesByProduct.get(pId)?.has(t.title.toLowerCase().trim())
      if (hasTitle) continue

      let dueAt: string | null = null
      if (t.due_offset_days !== undefined) {
        const d = new Date(now)
        d.setDate(d.getDate() + t.due_offset_days)
        if (t.due_offset_days === 0) {
          d.setHours(17, 0, 0, 0)
        } else if (t.due_offset_days === 1) {
          if (t.title.includes("volunteer")) {
            d.setHours(12, 0, 0, 0)
          } else {
            d.setHours(9, 0, 0, 0)
          }
        } else {
          d.setHours(12, 0, 0, 0)
        }
        dueAt = d.toISOString().split('.')[0]
      }

      const { error: todoErr } = await admin
        .from('todos')
        .insert({
          product_id: pId,
          title: t.title,
          description: t.description,
          priority_value: t.priority_value,
          status: t.status,
          due_at: dueAt
        })

      if (todoErr) {
        console.error(`[seedOnboardingProjects] Failed to insert todo "${t.title}":`, todoErr)
      }
    }
  } catch (err) {
    console.error('[seedOnboardingProjects] Seeding projects failed:', err)
  }
}
