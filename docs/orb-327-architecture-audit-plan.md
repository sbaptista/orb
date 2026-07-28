# ORB-327 — Next.js / React Architecture Cost Audit Plan

**Status:** Plan drafted, not yet approved for build. Research/audit only — no code changes without Stan's explicit go-ahead.
**Created:** 2026-07-14
**Scope:** Address ORB-327's two linked pieces of work — (1) the Next.js/React/Vercel/Supabase architecture cost-benefit audit, and (2) its Apple-native voice research addendum.

---

## Core Question

> Next.js and React serve an important purpose in Orb today. Is there an alternative that would do a demonstrably better job — not merely on par — at serving that purpose, judged against defined criteria?

This is a justification question, not primarily a performance question. The audit must define explicit, reproducible criteria, then judge each alternative against them. The bar for replacing a working framework is demonstrably better — not equal. Latency measurement is one input to that judgment, not the spine of the work.

**Alternatives are not limited to off-the-shelf framework swaps.** An alternative may be (a) a different package/library, (b) hand-rolled custom code that replaces a framework feature, or (c) removing a feature entirely if it turns out not to be needed. The audit compares the current framework against the best available alternative of any of these kinds — not only against named competitor frameworks. A small amount of purpose-built code that does a demonstrably better job than a general-purpose framework is a valid recommendation.

---

## Judgment Criteria

Every option (retain / reshape / isolate / replace) is scored against each criterion below, per affected surface. A criterion is only useful if it can be measured or shown from the code; vague "feels simpler" does not count. Where a criterion can't be measured, say so explicitly rather than guessing.

| Criterion | What "better" looks like | How it's evidenced |
|---|---|---|
| **Lines of code / surface area** | Fewer files, fewer lines, less indirection to accomplish the same feature | Count before/after per surface; map framework boilerplate that exists only to satisfy Next/React conventions |
| **Runtime performance** | Faster initial load, navigation, CRUD, cold/warm server paths, voice start | ORB-309 instrumentation, dev + production, Mac/iPad/iPhone |
| **Maintenance burden** | Fewer concepts to hold, fewer upgrade/migration risks, fewer breaking-change surfaces (Next 16, React 19 already broke training-data assumptions) | Count of framework-version-coupled code paths; changelog of past migrations; upgrade friction log |
| **Operational complexity** | Fewer moving parts, less deploy/hosting config, fewer vendor lock-ins | Inventory of Vercel/serverless/server-action dependencies; what fails if the host changes |
| **Capability coverage** | The replacement provides every capability Orb actually uses (routing, auth gate, SSR/RSC, server actions, streaming, metadata, realtime sideband) | The dependency inventory (step 1) — any gap is a cost, not hand-waved |
| **Correctness / integrity** | No regression in auth, RLS, mutation authorization, eval-suite behavior | Orb eval suite (Tier 1) must stay green; RLS / service-role rules unchanged |
| **Multi-platform parity** | Mac, iPad, iPhone all fully functional; no touch-only or desktop-only regressions | Existing ORB-309 platform coverage; the Apple-native prototype findings |
| **Cost** | Lower $ (API spend, hosting, per-minute speech charges) and lower developer-attention cost | Current spend baseline vs replacement; mic-audio upload / TTS per-minute cost |

**Decision rule:** the bar for replacing a working framework is **demonstrably better, not on par**. An alternative earns a recommendation only if it is demonstrably better (not equal) at serving the purpose the current framework serves, judged against the criteria above, while remaining equal or better on the non-negotiables: correctness/integrity (eval suite green, RLS unchanged) and multi-platform parity (Mac/iPad/iPhone). On-par or merely-equal alternatives do not justify replacement. Ties go to retain (no rewrite from preference).

---

## Problem

ORB-327 asks whether Next.js 16 App Router, React 19, Vercel serverless execution, Server Actions/RSC streaming, and Supabase integration still earn their architectural cost across the whole app. The deliverable is an ADR with measured evidence and a phased recommendation — not a rewrite decided from framework preference.

A research addendum (2026-07-14) adds an Apple-native voice option to evaluate: a thin SwiftUI/WKWebView client that keeps the existing React/Next interface and shared Orb server brain but moves Apple-platform audio to native SpeechDetector + SpeechTranscriber, with AVSpeechSynthesizer as a free local-output option.

---

## Success Criteria (from ORB-327)

- Quantify value and overhead across: initial load, navigation, CRUD, Orb text mode, voice mode, cold and warm server paths, authentication, client bundle/re-render cost, deployment, maintainability, and operational complexity.
- Compare retain, reshape, isolate, and replace options.
- Specifically determine whether the voice runtime and fact gateway should sit outside React state and/or Next.js server actions, and whether any persistent server component is needed for Realtime sideband control.
- Deliver an ADR with measured evidence and a phased recommendation.
- Do not authorize a rewrite merely from framework preference.

---

## Current Environment (verified 2026-07-14)

- next 16.2.1, react / react-dom 19.2.4, @supabase/ssr ^0.10.3, @supabase/supabase-js ^2.106.2, typescript ^5
- App Router surface: app/ includes account, actions, api, auth, dashboard, help, invite, maintenance, prototype, settings
- lib/orb-realtime/ and lib/orb-model/ exist (voice runtime + Orb conversational contract) — the surfaces under ORB-325 typed-parity work

---

## Approach

### 1. Framework dependency inventory (the spine of the audit)

Catalog every Next.js and React feature Orb actually uses, and for each, classify it as load-bearing, incidental, or replaceable. The output is a table that directly answers "does it need this?"

**Next.js features to inventory and assess:**
- App Router file conventions (layout, page, loading, error, route handlers)
- Server Components / RSC streaming
- Server Actions (app/actions/)
- Middleware / proxy.ts (auth + maintenance lookup, module cache)
- Route Handlers (app/api/) — Orb API, version, health, orb-eval, orb-realtime
- Metadata API, image/icon/font optimization, manifest
- Vercel serverless execution model + deployment

**React features to inventory and assess:**
- Server Components vs client components ('use client')
- Hooks (context, effects, refs, etc.)
- Suspense / streaming boundaries
- Concurrent rendering features
- Client state architecture for voice (lib/orb-realtime, lib/orb-model)

For each row: what Orb feature depends on it, what removing it would break, and the replacement cost. Then score each against the Judgment Criteria above.

### 2. Removal-impact scenarios

Run the retain / reshape / isolate / replace comparison explicitly against the inventory and criteria:
- **Retain** — what's genuinely load-bearing and worth keeping?
- **Reshape** — what's incidental and removable without changing the framework choice?
- **Isolate** — what should move outside React state / Next.js server actions (voice runtime, fact gateway, Realtime sideband)?
- **Replace** — what framework feature could be dropped for a lighter alternative?

### 3. Performance measurement as supporting evidence (not the spine)

Reuse ORB-309 instrumentation where it already covers a dimension from ORB-327 (initial load, auth, dashboard-init, dashboard-clicks, voice-start). Extend only for gaps: cold vs warm server paths, client bundle/re-render cost, CRUD, Orb text mode. Run dev + production across Mac/iPad/iPhone per the ORB-309 Production Collection Checklist.

### 4. Answer the specific architectural question

Should the voice runtime and fact gateway sit outside React state and/or Next.js server actions, and is a persistent server component needed for Realtime sideband control? This is answered from the dependency inventory (step 1) and the isolate scenario (step 2), judged against the criteria, not from performance numbers alone.

---

## Apple-Native Prototype (Research Addendum)

Build a speech-only SwiftUI/WKWebView prototype using SpeechDetector / SpeechTranscriber / AVSpeechSynthesizer, routing finalized transcripts through the existing text workflow — not a UI rewrite. The ADR must measure:

- Native-shell/auth/distribution maintenance
- Unsupported-language / older-device fallback
- Browser parity
- Real interactive latency
- Ambient false activation
- Quiet-speech retention
- Total cost (on-device/private VAD+STT, no per-minute speech charge, no mic-audio upload)

Caveats: APIs are native Swift-only, locale-configured, Apple OS 26-dependent. First step is a speech-only native prototype across Mac/iPad/iPhone.

---

## Deliverables

- **ADR** in docs/ with measured evidence and a phased recommendation, leading with the dependency inventory table, the judgment criteria, and the retain/reshape/isolate/replace verdict scored against them.
- Link Knowledge Repo entry 3a81b135-6b01-43fe-9fe8-0b5619ebeae4 and ORB-325 checkpoint 8d4c4ac3-a3c7-4a09-8d4c-f0beb877c24a.
- Update docs/object-capability-matrix.md Part 2 if the audit surfaces new critical flows or performance coverage gaps.

---

## Reference URLs

- https://get-inscribe.com/blog/apple-speech-api-benchmark.html
- https://developer.apple.com/documentation/speech/speechanalyzer
- https://developer.apple.com/documentation/speech/speechdetector
- https://developer.apple.com/videos/play/wwdc2025/277/

---

## Approval

This plan covers the audit/research path only. Any implementation, dependency addition (e.g. Silero-style native deps), or code change requires Stan's separate explicit go-ahead. No git push without in-chat approval.
