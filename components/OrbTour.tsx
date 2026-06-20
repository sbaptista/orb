'use client'

// ══════════════════════════════════════════════════════════
// OrbTour — guided product tour built on driver.js (v1.4.0)
//
// Opens and closes on strategic value, practical navigation
// sandwiched in the middle.
//
// Cross-component launch: the dashboard registers a controller via
// registerOrbTour(); the conversation nudge button and the Help
// modal call launchOrbTour() without prop-drilling.
// ══════════════════════════════════════════════════════════

import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

export type TourEnv = {
  isMobile: boolean
  showOrbPane: () => void
  showListPane: () => void
  selectWelcomeProject: () => void
}

let runner: ((env?: Partial<TourEnv>) => void) | null = null

export function registerOrbTour(fn: (env?: Partial<TourEnv>) => void) {
  runner = fn
}

export function unregisterOrbTour() {
  runner = null
}

export function launchOrbTour() {
  if (runner) { runner(); return }
  let attempts = 0
  const poll = setInterval(() => {
    attempts++
    if (runner) { clearInterval(poll); runner() }
    else if (attempts >= 20) clearInterval(poll)
  }, 150)
}

export function runOrbTour(env: TourEnv) {
  try { env.selectWelcomeProject() } catch { /* no-op */ }

  const q = (sel: string) => (() => document.querySelector(sel) ?? undefined) as () => Element

  const steps: DriveStep[] = [
    {
      element: q('[data-tour="orb"]'),
      popover: {
        title: 'Meet the Orb',
        description:
          "This is your chief of staff. It watches your workload across every project — its color and motion reflect how things are going. Calm when you're clear, urgent when something needs attention. You don't check the list. The Orb tells you.",
        side: env.isMobile ? 'bottom' : 'right',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="conversation-input"]'),
      popover: {
        title: 'Talk to it',
        description:
          'Ask anything: <em>"What should I focus on?"</em> <em>"What\'s overdue?"</em> <em>"How\'s my week looking?"</em> The Orb reasons across your whole backlog, not just the project on screen.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="orb"]'),
      popover: {
        title: 'Or just talk',
        description:
          'Tap the Orb to start a voice conversation. Speak naturally — the Orb listens, responds aloud, and the mic comes back automatically. No buttons between turns. You can also find <em>Talk to Orb</em> in the More menu, or press <strong>⌘ Shift O</strong>.',
        side: env.isMobile ? 'bottom' : 'right',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="conversation-input"]'),
      popover: {
        title: 'It works for you',
        description:
          'Create tasks, reprioritize, move things between projects — all in plain English. Found a bug or have a suggestion? Just tell the Orb and it files it for the developer.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="orb-toggle"]'),
      popover: {
        title: 'Two modes',
        description:
          'Orb mode for conversation and strategic view. List mode for hands-on task management. These buttons switch between them.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: q('[data-tour="views"]'),
      popover: {
        title: 'Your workspace',
        description:
          'List, Checklist, or Kanban — pick the view that fits how you think. Try dragging tasks between columns in Kanban.',
        side: env.isMobile ? 'bottom' : 'left',
        align: 'start',
      },
    },
    {
      element: q('[data-tour="commands"]'),
      popover: {
        title: 'Everything else',
        description:
          'Settings, Help, and Print are all in here.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      popover: {
        title: 'It gets smarter',
        description:
          "The Orb learns your patterns, remembers your preferences, and adapts over time. The more you use it, the more useful it becomes.",
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Welcome to the alpha',
        description:
          "This is an alpha — things may shift. Please don't store anything sensitive, and don't assume anything is permanent. Go play and may all your projects be calm. — Stan",
        align: 'center',
      },
    },
  ]

  const ensurePaneFor = (index: number) => {
    if (!env.isMobile) return
    if (index === 5) env.showListPane()
    else env.showOrbPane()
  }

  const d = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    smoothScroll: true,
    stagePadding: 8,
    stageRadius: 12,
    overlayColor: 'rgba(20, 24, 28, 0.55)',
    popoverClass: 'orb-tour-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps,
    onHighlightStarted: (_el, _step, opts) => {
      ensurePaneFor(opts.state.activeIndex ?? 0)
      setTimeout(() => { try { opts.driver.refresh() } catch { /* no-op */ } }, 60)
    },
  })

  ensurePaneFor(0)
  setTimeout(() => d.drive(), 80)
}
