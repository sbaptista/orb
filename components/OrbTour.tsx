'use client'

// ══════════════════════════════════════════════════════════
// OrbTour — guided product tour built on driver.js (v1.4.0)
//
// Observational + state-safe: every step points at a real element
// and explains it. Steps never *require* the user to perform an
// action, so the tour is correct from ANY app state (fresh login or
// after the user has poked around).
//
// Cross-component launch: the dashboard registers a controller via
// registerOrbTour(); the conversation nudge button and the Help
// modal call launchOrbTour() without prop-drilling.
// ══════════════════════════════════════════════════════════

import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

export type TourEnv = {
  isMobile: boolean
  // Ensure the Orb pane / list pane is the one on screen (mobile is tabbed).
  showOrbPane: () => void
  showListPane: () => void
  // Put the app into a sensible starting state if possible (best-effort).
  selectWelcomeProject: () => void
}

// Module-level controller registered by the dashboard.
let runner: ((env?: Partial<TourEnv>) => void) | null = null

export function registerOrbTour(fn: (env?: Partial<TourEnv>) => void) {
  runner = fn
}

export function unregisterOrbTour() {
  runner = null
}

// Anyone can call this (conversation nudge, Help modal) to start the tour.
export function launchOrbTour() {
  if (runner) runner()
}

// Build + run the driver.js tour. Called by the dashboard's registered runner,
// which supplies the live environment (mobile state + pane switchers).
export function runOrbTour(env: TourEnv) {
  // Best-effort prep: land on the Welcome project so anchors exist.
  try { env.selectWelcomeProject() } catch { /* no-op */ }

  // Each element is a function resolved at step time, so a missing anchor
  // (collapsed pane, deleted project, etc.) is tolerated at runtime and
  // driver.js shows the popover centered instead of erroring. The cast keeps
  // the type happy (driver.js types want () => Element) while we stay
  // null-tolerant at runtime.
  const q = (sel: string) => (() => document.querySelector(sel) ?? undefined) as () => Element

  const steps: DriveStep[] = [
    {
      element: q('[data-tour="orb"]'),
      popover: {
        title: 'Meet the Orb',
        description:
          "This is the Orb. It's not just a todo list — its color and motion reflect your workload: Calm, Busy, or Urgent. Lighter or heavier workloads change its appearance.",
        side: env.isMobile ? 'bottom' : 'right',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="conversation-input"]'),
      popover: {
        title: 'Ask the Orb',
        description:
          'Orb is also an analyst. Type <em>What should I do next?</em> here and it reasons across your projects.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="views"]'),
      popover: {
        title: 'Views',
        description:
          "Use Views to switch between List, Checklist, and Kanban. Try dragging tasks between columns in Kanban.",
        side: env.isMobile ? 'bottom' : 'left',
        align: 'start',
      },
    },
    {
      element: q('[data-tour="conversation-input"]'),
      popover: {
        title: 'Feedback & bugs',
        description:
          "See something you like or don't like? Found a bug? Just tell the Orb — it files it for the developer.",
        side: 'top',
        align: 'center',
      },
    },
    {
      element: q('[data-tour="conversation-input"]'),
      popover: {
        title: 'Create a Project',
        description:
          'Open the Slash commands by typing "/". Then select "/create [name]".',
        side: 'top',
        align: 'center',
      },
    },
    {
      // No element — centered, always safe on any screen.
      popover: {
        title: 'A quick heads-up',
        description:
          "This is a pre-alpha. Please don't store anything sensitive, and don't assume anything is permanent.",
        align: 'center',
      },
    },
    {
      element: q('[data-tour="help"]'),
      popover: {
        title: 'Help anytime',
        description:
          "Tap Help anytime for the full guide — including this tour. You're all set. Go play and may all your projects be calm. — Stan",
        side: 'bottom',
        align: 'end',
      },
    },
  ]

  // Per-step mobile prep: switch to the pane that contains the step's anchor
  // so it's actually on screen when driver.js spotlights it.
  const ensurePaneFor = (index: number) => {
    if (!env.isMobile) return
    // Step 2 (Views) lives in the list pane. All others live in or switch to the Orb pane.
    if (index === 2) env.showListPane()
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
      // Give the pane switch a tick to render, then recompute the cutout.
      setTimeout(() => { try { opts.driver.refresh() } catch { /* no-op */ } }, 60)
    },
  })

  // Make sure the first step's pane is on screen, then drive.
  ensurePaneFor(0)
  setTimeout(() => d.drive(), 80)
}
