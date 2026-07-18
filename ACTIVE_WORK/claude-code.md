# Claude Code — Active Claims

Written only by Claude Code. Rules: `docs/multi-agent-concurrency-protocol.md`.

## Active Claims

- **2026-07-12 18:20 HST (still open)**
  Surface: ORB-326 — SystemStateProvider poll dedup (client stops polling /api/health)
  Files: components/SystemStateProvider.tsx
  Intent: derive isOnline from the /api/version poll; remove the separate /api/health fetch (route kept for external probes). Version bump + changelog + HANDOFF still deferred; commit pending release-bookkeeping.
  Long-running: no
