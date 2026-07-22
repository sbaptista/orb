export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: 'v0.6.224',
    date: '2026-07-21',
    changes: [
      'Restored the Category list in the todo editor by replacing its unreliable custom searchable field with the same native dropdown used for Status and Priority. Category remains optional with None mapping to no category, and the obsolete custom popover code and styles were removed.',
    ],
  },
  {
    version: 'v0.6.223',
    date: '2026-07-20',
    changes: [
      'Reduced Orb AI cost: the UI catalog reference (used internally so Orb knows the app\'s layout and navigation) was being resent at full price on every single request instead of being cached, since it sat in the wrong part of the prompt. Moved it into the cached portion — no change to what Orb can see or do, just cheaper to run.',
    ],
  },
  {
    version: 'v0.6.221',
    date: '2026-07-19',
    changes: [
      'Unified TodoForm and TodoPanel into a single TodoEditor component, eliminating duplicate form code. Category field is now optional with None as the first option mapping to NULL. Priority label standardized to None. Status field is always visible on both create and edit. URLs field removed from the UI (kept in database). Per-field validation with s-error class displays inline errors in real-time; required fields like Title show errors immediately on form open. Fixed project ID assignment for new todos to use the currently selected project instead of defaulting to the first project alphabetically.',
    ],
  },
  {
    version: 'v0.6.220',
    date: '2026-07-19',
    changes: [
      'Fixed Gemini strategic-routing requests failing before the model could respond when an Orb tool contained nested strict-object schemas. Orb now recursively removes Gemini-unsupported `additionalProperties` keywords only from the Gemini provider payload.',
      'Kept the canonical generated Orb contract strict for Anthropic and every other consumer instead of weakening the shared API specification to accommodate one provider.',
      'Added a deterministic compatibility check covering deeply nested schemas, union branches, the real Orb tool catalog, canonical-schema immutability, and legitimate arguments named `additionalProperties`.',
    ],
  },
  {
    version: 'v0.6.219',
    date: '2026-07-19',
    changes: [
      'Fixed the voice assistant occasionally mishearing a short confirmation word (like "confirmed") as an entirely different language, by giving its speech recognizer a vocabulary hint toward the words it needs to catch most reliably.',
      'Orb (both the voice assistant and text chat) now accepts a clear "yes"/confirmed style response in any language as approval for a pending change, instead of only recognizing a narrow set of English phrases or hesitating over an unfamiliar-looking short reply.',
      'Fixed the voice assistant sometimes inventing a plausible-sounding but false explanation when asked why it mistranscribed something or rejected a confirmation. It now says plainly when it cannot see the reason, rather than guessing.',
      'Fixed the voice assistant silently narrating something vague instead of telling the user what was actually pending, when it proposed several changes at once (e.g. asking to delete three todos by name in one sentence).',
      'The voice assistant can now propose several todo changes at once (create, update, delete, and/or move, in any mix) as one combined confirmation, instead of asking about each one separately or losing track when several are proposed together.',
    ],
  },
  {
    version: 'v0.6.218',
    date: '2026-07-18',
    changes: [
      'Fixed Realtime voice database lookups that need a specific column (e.g. "which task has gone longest without an update") failing with a generic error. The voice assistant now has the same database schema reference the text assistant has always had, instead of having to guess column names.',
      'Fixed Realtime voice errors sometimes reporting a generic failure message instead of the actual reason, making some issues harder to diagnose.',
    ],
  },
  {
    version: 'v0.6.217',
    date: '2026-07-18',
    changes: [
      'Restored `query_db` to the canonical generated serial Orb tool contract. Its implementation, routing policy, Realtime schema, and regression case already existed, but the generated tool list no longer exposed its required table/filter schema; structural date queries could therefore name the tool without supplying the required table.',
      'Clarified exact-code mutation routing: when a current request or visible backlog already provides the precise task code, Orb calls the matching update/close/delete/move tool directly and lets the server resolve and validate the live row instead of performing a redundant read first.',
    ],
  },
  {
    version: 'v0.6.216',
    date: '2026-07-18',
    changes: [
      'Made todo addresses monotonic and concurrency-safe within each project. Creates and moves now allocate from a row-locked database high-water counter; soft deletes, hard deletes, and moves never return a number to the pool, and positive/non-null/full-history uniqueness constraints defend the invariant across every surviving row.',
      'Seeded each project counter from both surviving todos and parseable audit history, with fail-closed validation that no existing or audited number exceeds the recovered high-water. REST, serial Orb, Realtime Orb, and ticket-to-todo paths now rely on the same database allocator instead of independently calculating a maximum.',
      'Fixed Backup & Recovery so restoring or merging an archive preserves each todo UUID, project, exported number, and JSON-array fields through a service-role-only restore function. Triggers remain enabled throughout the transaction; occupied-address collisions fail closed, repeated restores are idempotent, and subsequent creates continue above the restored high-water.',
      'Added an emergency maintenance-only rollback and a disposable-project verification harness covering concurrent inserts, failed-write rollback, hard-delete and move non-reuse, direct-address immutability, and restore integrity. Existing create/move interaction telemetry measures counter overhead without adding per-allocation logging.',
    ],
  },
  {
    version: 'v0.6.215',
    date: '2026-07-18',
    changes: [
      'Halved app-shell system-state polling from two requests to one. The existing `/api/version` response now supplies both reachability and version, maintenance, lockout, and broadcast state, so initial checks, visible-tab intervals, focus/visibility events, network recovery, manual refresh, and DEV simulation no longer make a redundant `/api/health` request.',
      'Preserved the lightweight `/api/health` endpoint for possible external uptime probes while confirming there is no remaining in-app caller. Network errors and non-successful `/api/version` responses set Orb offline; the next successful response restores online state and refreshes the complete system-state packet.',
      'Added opt-in background performance telemetry for the consolidated version poll and updated the standing initialization and flow-performance documentation with the one-request contract.',
    ],
  },
  {
    version: 'v0.6.214',
    date: '2026-07-17',
    changes: [
      'Realtime voice failures (OpenAI outage, rate limit, or billing/quota issues) now go through the same incident pipeline as every other Orb AI provider: a deduplicated ticket is filed, every admin is emailed with the reason and a direct link to the provider console, and the person using voice sees a specific explanation instead of a generic failure message.',
    ],
  },
  {
    version: 'v0.6.213',
    date: '2026-07-17',
    changes: [
      'Fixed Realtime voice cutting itself off on speakerphone: Orb’s own voice echoing back into the microphone was misread by the provider as an interruption. Raised the volume gate for what counts as speech so acoustic echo no longer triggers a false interruption while real speech still does; validated clean on Mac (Safari, Chrome, Edge), iPad Safari, and iPhone Safari.',
      'Fixed a brief status flicker on iPad Safari caused by the provider occasionally redelivering the same turn-completion event; a repeat is now dropped outright instead of being misattributed to a different turn.',
      'Added the specific connection-failure reason to the Realtime lifecycle trace so a failed voice session can be diagnosed from one copied trace instead of separate console digging.',
    ],
  },
  {
    version: 'v0.6.212',
    date: '2026-07-17',
    changes: [
      'Rebuilt the allowlisted Realtime voice operator on provider-owned turn-taking. OpenAI server VAD now owns turn detection and barge-in interruption; the client creates a response only once a turn has transcribed and never cancels one. This removes the fatal “no active response to cancel” and “conversation already has an active response” errors that could end a session after a handful of turns, and it fixes lost/empty responses. Parallel tool calls within one turn are batched into a single response, and the session opens straight into listening with no greeting.',
      'Completed native typed-capability parity for Realtime voice: managing todos and projects, preserving and correcting Knowledge Repository entries, inspecting tickets, audit history, source, project facts, and bounded database reads, navigating the app, managing preferences and memories, proposing adaptations, filing tickets, and messaging developer tools. Project and Knowledge Repository mutations are transactional and replay-safe — confirmation rechecks ownership, conflicts, and stale state, writes one audit event, and returns one durable receipt; project deletion warns that every todo in it is permanently deleted; Knowledge deletion stays deliberately unavailable.',
      'Fixed named-project todo creation so “add this to Helm” can no longer land in whichever project happens to be selected, and made Realtime project reads speak the human owner and dormancy rather than an internal identifier.',
      'Retained a self-hosted Silero VAD classifier (pinned `@ricky0123/vad-web` 0.0.30 with self-hosted Silero V5 / ONNX Runtime assets under an immutable-cache path) as advisory telemetry only; it never gates, suppresses, or alters provider audio. Voice telemetry records privacy-safe lifecycle and per-turn evidence with no transcript or audio content retained.',
      'Realtime voice remains developer/allowlist-gated and is not yet the default voice control. Supported-browser acceptance and ambient false-turn tuning still precede any product-default switch.',
    ],
  },
  {
    version: 'v0.6.200',
    date: '2026-07-14',
    changes: [
      'Knowledge Repository entries now survive deleting the project they came from. Deleting a project used to permanently destroy every distilled lesson that originated from it — the entries are meant to outlive the work that produced them, and are shared rather than owned by one project. Each surviving entry keeps its full original content and gains a note at the top recording which project was deleted and when, so nothing silently loses its context.',
    ],
  },
  {
    version: 'v0.6.199',
    date: '2026-07-14',
    changes: [
      'Fixed confirmation of a pending change being far too strict to use. Only a bare “yes” or “confirm” was accepted, so natural explicit approvals — “approved”, “I confirm the change”, “Yes, apply the change to close ORB-338” — were all refused, and a change could end up impossible to approve at all. An unambiguous explicit approval now authorizes the pending change, while questions, declines, and complaints or reminders about permission you gave earlier still never authorize anything on their own.',
      'Stopped Orb describing or guessing which exact words count as approval. It had begun telling people that accepted phrases were rejected and suggesting wordings that could not work; the server alone decides, so Orb now simply restates the pending change and asks you to approve it in your own words.',
    ],
  },
  {
    version: 'v0.6.197',
    date: '2026-07-14',
    changes: [
      'Began Realtime voice capability parity (still developer/allowlist-gated, not the default voice control). The Realtime operator can now close a todo through a dedicated, confirmed workflow that atomically saves resolution notes, writes a matching Knowledge Repository entry, records one audit event, and returns a single durable receipt — closing is never a silent status change and is not available through the plain update path.',
    ],
  },
  {
    version: 'v0.6.196',
    date: '2026-07-13',
    changes: [
      'Instrumented Realtime ambient-turn diagnosis without adding a speculative speech filter. The session now requests input-transcription log probabilities and records only aggregate token count, average/minimum log probability, geometric confidence, and server-VAD audio duration; transcript text and audio remain unrecorded.',
      'Preserved transcript confidence metadata through later fact or mutation tool calls, allowing false ambient turns and legitimate short commands to be compared before choosing a suppression threshold.',
    ],
  },
  {
    version: 'v0.6.195',
    date: '2026-07-13',
    changes: [
      'Closed the Realtime post-tool authorization loop. Once the server returns exact proposal text, an error, or a canonical database receipt, the follow-up speech response is created with response-level tools disabled and must only speak that server-authored text. A successfully pre-authorized mutation can no longer be followed by a redundant confirmation-tool call that falsely reports failure after the database already committed the change.',
      'Extended voice telemetry with privacy-safe pre-authorized and canonical-receipt flags so mutation success can be distinguished from later model narration without recording the user’s words.',
    ],
  },
  {
    version: 'v0.6.194',
    date: '2026-07-13',
    changes: [
      'Moved the Realtime response boundary from raw voice-activity detection to the matching completed transcript. Server VAD still commits native audio and interrupts immediately, but only the client creates a model response after correlating the committed audio item with the current turn. Late transcripts remain visible without authorizing or answering a newer turn, and ambient/no-transcript events can no longer trigger unsolicited Orb speech.',
      'Recognized the natural upfront-authorization phrase “you have my approval” through the same shared server grammar used by text and Realtime mutations. The phrase remains effectful only when that utterance also produces a concrete mutation proposal.',
      'Removed trailing passive dashboard status announcements together with the passive greeting when Realtime starts, leaving one synchronized audible greeting without erasing earlier conversation history.',
    ],
  },
  {
    version: 'v0.6.193',
    date: '2026-07-13',
    changes: [
      'Improved safe natural-title resolution for Realtime todo mutations by reusing Orb’s existing relevance scorer after exact matching. A uniquely stronger near-exact title now wins over broad topical matches, while tied candidates still require clarification; the voice model is also told to preserve the user’s full title phrase instead of reducing it to keywords.',
      'Removed competing Realtime startup announcements. Starting the DEV voice operator now replaces the passive dashboard greeting with its synchronized audible greeting and suppresses urgency-transition narration while the Realtime session is connecting or active.',
    ],
  },
  {
    version: 'v0.6.192',
    date: '2026-07-13',
    changes: [
      'Fixed Realtime voice recovery after a 12-second response timeout. The watchdog still cancels and quarantines the stalled provider response, but it no longer pauses the session-owned WebRTC audio element and thereby silently mutes every later answer. Telemetry now records whether the remote element was paused when inbound audio first arrived so received network packets cannot be mistaken for audible playback.',
      'Made natural priority labels deterministic in the Realtime mutation contract: urgent, high, normal, and low map directly to values 1, 2, 3, and 4. Orb no longer asks for an internal priority number after the user has already supplied a known label.',
    ],
  },
  {
    version: 'v0.6.191',
    date: '2026-07-13',
    changes: [
      'Changed Orb’s routine Tier 1, Tier 2, and strategic evaluation suites to use Gemini 3.1 Pro Preview as their centralized default evaluator instead of Claude Haiku 4.5. The CLI now prints the evaluator before a run, the server endpoint applies the same default, and explicit provider/model overrides remain available for deliberate future comparisons.',
      'Updated routing fixtures so they still verify operational-versus-strategic classification while Gemini evaluates both roles, and reduced the strategic manifest to the same Gemini reference model. Production Orb model routing is unchanged.',
    ],
  },
  {
    version: 'v0.6.190',
    date: '2026-07-13',
    changes: [
      'Added an isolated localhost Realtime voice architecture spike behind Orb’s existing DEV panel without replacing the production voice path. A persistent authenticated WebRTC session now owns microphone input, semantic turn detection, synchronized transcript events, speech output, and provider-level interruption for controlled testing.',
      'Added a narrow database Fact Gateway for voice. Active-task counts and next-step recommendations are read from fresh owned-project database snapshots with canonical active-status definitions, typed packets, exact observation times, and server-composed factual speech instead of model memory or Orb’s broad cached context.',
      'Extended the Fact Gateway after the first iPad test: named-project counts now resolve the user-facing project server-side and preserve exact open, active, parked, or all-status scope, so “open tasks in Orb alone” cannot silently become an all-project active count.',
      'Added an app-owned create transaction: signed short-lived proposals, one confirmation boundary, authorized execution, audit logging, database read-back, and canonical receipts. Production hardening now persists proposals and confirms them through one row-locked database transaction, so replay returns the same receipt while the todo and audit event are written exactly once across server processes.',
      'Instrumented the Realtime comparison from tap to the first inbound WebRTC audio packet and through microphone return, including microphone permission, SDP/data-channel setup, transcript completion, fact/action tool boundaries, interruption, response completion, and microphone return. Browser echo cancellation/noise suppression/automatic gain control plus Realtime far-field filtering and noise-thresholded server VAD reduce ambient false interruptions, while a privacy-safe probe records whether playback interruptions produced a transcript. Provider response IDs and application turn IDs now abort or quarantine late read/proposal results so interrupted work cannot complete a replacement turn. Updated the voice architecture plan, performance matrix, and focused factual-count evaluation cases.',
      'Added failure recovery from the representative browser pass: startup failures now retain sanitized diagnostic details, and every transcribed turn is protected by a 12-second response watchdog across initial generation, response creation, and verified tool-result handoff. A stalled response is cancelled, quarantined from later turns, reported in performance telemetry, and returned to listening instead of leaving the microphone stuck indefinitely.',
      'Added the matching input-side recovery for Firefox: if voice activity starts but transcription never completes, Orb clears the stuck audio buffer, resets the microphone boundary, records a transcription timeout, and returns to listening rather than silently ceasing to hear later questions.',
      'Corrected a Firefox event-order race where the previous answer’s completion could arrive milliseconds after the next speech began and incorrectly close the new input turn. A prior response can no longer clear a turn that is still awaiting transcription.',
      'Added an exact live project-directory Fact Packet so Realtime voice can answer how many projects the user owns and name them without inferring from task context.',
      'Made task-count project scope explicit and fail-closed: Realtime must identify either one named project or an explicitly requested all-owned-project total, and the server rejects missing or inconsistent scope instead of silently widening an Orb-only question to every project.',
      'Narrowed the supported browser matrix to Safari, Chrome, and Edge after repeated Firefox Realtime sessions stopped detecting microphone input after a few turns without emitting a provider speech event. The Firefox paths remain available for investigation under ORB-330 but no longer block the voice architecture decision.',
      'Accepted the Realtime architecture for controlled production hardening. Production endpoints now require an explicit server enable flag plus an exact authenticated-email allowlist, while development retains the DEV control and the main production voice button stays on the serial fallback until capability parity or deterministic fallback is complete.',
      'Started capability parity with fresh detailed todo reads: Realtime can now read one natural todo title or code or list a bounded set of matching todos with explicit named-project/all-owned and status scope. Missing, ambiguous, or inconsistent scope fails closed rather than silently widening, and server-composed factual speech preserves codes, titles, statuses, projects, priorities, and due dates.',
      'Extended the durable Realtime transaction boundary to todo updates, deletions, and moves. Every target resolves from a natural title/code and optional project name to one fresh accessible row, every interpreted change is persisted before authorization, and one row-locked database RPC re-authorizes the user, rejects stale row versions, writes exactly one todo change plus audit event, and returns the same canonical receipt on replay. Cross-project moves lock both projects in stable order and allocate the destination code transactionally; deletes are soft. Closing remains on the full Orb workflow until resolution notes and Knowledge Repository duties can be enforced in the same transaction.',
      'Corrected receipt retention for todos created through Realtime: deleting one later from the normal list can now clear the proposal’s live todo reference while preserving its immutable executed receipt. The original constraint required both fields forever and therefore blocked hard deletion of the first durably-created Realtime todo.',
      'Removed the Realtime requirement to speak internal todo codes. Update, delete, move, and detailed reads now accept a natural todo title or code plus an optional project name; the server resolves one fresh accessible database row and rejects ambiguous matches before creating a proposal.',
      'Unified text and Realtime mutation authorization behind one shared server rule set. Realtime waits for the actual completed transcription, honors permission granted in the requesting utterance without asking again, and requires a bare affirmation for a pending proposal. The serial model is no longer offered its confirmation tool on complaints or reminders about earlier permission, and both server paths reject such calls defensively.',
      'Made the voice response watchdog a true absolute 12-second post-transcription deadline across model and tool phases instead of resetting the clock at each handoff. Tool failures now mark the complete telemetry turn unsuccessful rather than being recorded as successful after an error response.',
    ],
  },
  {
    version: 'v0.6.189',
    date: '2026-07-12',
    changes: [
      'Added detailed voice diagnostics for ORB-325 so the app can measure where a spoken turn spends its time: microphone recognition, response generation, voice synthesis, audio decoding, playback start and completion, and microphone return. These measurements establish an evidence-based quality gate for voice across Orb’s four supported browsers: Safari, Chrome, Edge, and Firefox. Firefox now records each short utterance and uses secure server transcription where native browser recognition is unavailable; recordings are not stored.',
      'Corrected the action-set resolver so ordinal requests such as “delete the first five todos” deterministically resolve the recorded set, and refined eval assertions to distinguish prohibited mutation tools from safe read-only verification.',
      'Restored the spoken greeting whenever voice mode starts, including when a text conversation already exists, and keeps the recognized user utterance visible in the voice input field until listening resumes.',
      'Replaced the generic blocked-microphone warning with browser- and platform-specific recovery instructions directly in the voice panel, so users can restore permission without external troubleshooting.',
      'Hardened revised batch confirmations after Safari testing: Orb now corrects a user undercount against the exact pending transaction instead of silently adding an extra todo, preserves that transaction for one confirmation, uses project names instead of internal project codes, avoids duplicate greeting cards, and blocks stale project-switch counts.',
      'Fixed transcript list formatting at the shared speech-sanitization boundary: repeated spaces are still normalized, but Markdown line breaks are preserved so the first confirmation target cannot be flattened onto the heading and visually disappear.',
      'Paused phrase-by-phrase voice tuning after the extended Safari session exposed a deeper orchestration problem. The next voice iteration will compare the current serial pipeline with a bounded native-realtime operator, keeping correctness in deterministic workflow and safety boundaries while allowing Orb’s actual responses to remain fluid rather than canned.',
    ]
  },
  {
    version: 'v0.6.188',
    date: '2026-07-12',
    changes: [
      'A sign-in session that can no longer be matched to your account now takes you cleanly to a fresh login instead of getting stuck bouncing between screens. Previously a rare “orphaned” session could trap you in a redirect loop that only clearing your browser’s site data would fix — now the app signs that session out and returns you to a clean login automatically.',
      'Passkey sign-in errors now always read in plain language (for example, “Passkey authentication failed — try signing in with email”) instead of occasionally showing a raw technical message from the sign-in service.',
    ]
  },
  {
    version: 'v0.6.186',
    date: '2026-07-11',
    changes: [
      'Updates now apply cleanly on their own. When a newer version of the app loads — whether you tapped Update or simply reloaded or navigated back into it — Orb automatically clears the version-specific working state that a new build can’t safely reuse from an older one (your in-progress Orb conversation, pending input, and command history). Previously this only happened when you pressed Update, so picking up a new version any other way could leave stale state behind that sometimes forced you to manually clear your browser’s site data. Your preferences are left untouched: voice settings, dismissed notices, welcome state, and your saved login email all carry over.',
    ]
  },
  {
    version: 'v0.6.184',
    date: '2026-07-11',
    changes: [
      'Fixed the Safari / iPad login loop where sign-in cycled forever and never reached the app. The cause was a corrupt session cookie the server read inconsistently, bouncing between the login and dashboard screens — previously clearable only by wiping the browser’s site data. Now, when the server sees a session cookie that no longer resolves to a valid user, it clears the auth cookies automatically and sends you to a clean login, so the loop self-heals instead of trapping you. (Root cause of the corruption is still under investigation; this makes it non-fatal.)',
    ]
  },
  {
    version: 'v0.6.183',
    date: '2026-07-10',
    changes: [
      'A user’s projects page is reachable again. In Settings → Users, each user’s name is now a link to their projects page (their project list with per-project todo counts) — that page had become unreachable after the settings reorg. The list row itself is no longer clickable; only the Edit action opens the edit modal.',
      'That user projects page also loads faster. It fired two server actions that Next.js runs one after another — each re-authenticating and separately re-checking the target user’s role — so an auth round-trip and a role lookup were paid twice. They are now a single bundled action with one auth check and one role check (same data), and the load is measured under Settings → Performance.',
    ]
  },
  {
    version: 'v0.6.182',
    date: '2026-07-09',
    changes: [
      'Fixed sign-in on Safari and Firefox, which could get stuck on "authenticating" or bounce back to the login screen in a loop. A recent optimization verified your login token locally on our server instead of checking with the auth server on each request — but that local check rejects an expired token rather than refreshing it, and Safari and Firefox refresh tokens far less aggressively than Chrome, so their sessions lapsed and locked users out. Restored the original check, which refreshes the session automatically. Chrome was unaffected. This fully unwinds the ORB-312 auth optimizations, which will return once proper session-refresh middleware is in place.',
    ]
  },
  {
    version: 'v0.6.181',
    date: '2026-07-09',
    changes: [
      'Fixed a login regression where sessions could drop — signing in and then bouncing back to the login screen, hanging on authentication, or cycling in a loop. The previous release’s dashboard-load optimization removed a client-side auth check that was also quietly refreshing your session token; with nothing else refreshing it on that path, the token could lapse mid-session and sign you out. Reverted that optimization to restore stable sign-in. It will return once proper session-refresh middleware is in place.',
    ]
  },
  {
    version: 'v0.6.179',
    date: '2026-07-09',
    changes: [
      'The dashboard loads faster after sign-in (ORB-312). It was re-authenticating and re-querying your profile on the client even though the server had already fetched both during page render and passed the data down — two redundant network round-trips on the most-loaded screen’s critical path (about 370ms typically, and 1–1.6s at the 95th percentile on Mac/iPhone, worse on iPad). The dashboard now reads that profile straight from what the server already provides, so those round-trips are gone. Measuring before/after in production via the existing dashboard-init telemetry.',
    ]
  },
  {
    version: 'v0.6.178',
    date: '2026-07-09',
    changes: [
      'Hardened Orb user-facing project speech so raw internal project code tags like [code: STOKELYFRO] are stripped from final Orb/eval speech while preserving task codes such as ORB-315. Fixed the ORB-315 eval assertion so the display name “Thunderbolt” no longer false-fails against the internal code check. Closed ORB-317 after the acceptance eval set passed.',
    ]
  },
  {
    version: 'v0.6.177',
    date: '2026-07-08',
    changes: [
      'Sped up every authenticated page. The shared auth check ran a network round-trip to the auth server (getUser) on every server action — the dominant remaining cost behind the AI Metrics load and present on all authed pages. It now verifies the login token cryptographically on our own server (local JWKS verification, enabled by the project’s asymmetric signing keys), with an automatic fallback to the network check if local verification ever isn’t available, so it cannot break sign-in.',
    ]
  },
  {
    version: 'v0.6.176',
    date: '2026-07-08',
    changes: [
      'AI Metrics cost accounting loads faster. It used to fire two server actions back-to-back, each re-authenticating with a Supabase getUser round-trip — and because Next.js runs server actions serially, that auth cost was paid twice (the bulk of a ~3–4s load; the query itself is under 200ms). They are now one combined action with a single auth check and a server-side parallel fetch, which should roughly halve the load. Measuring before/after in production.',
    ]
  },
  {
    version: 'v0.6.175',
    date: '2026-07-08',
    changes: [
      'Auth performance metrics now tell the truth. Passkey attempts the user cancels or that have no credential, plus the (now-removed) background passkey-autofill span, are classified as "expected" rather than counted as failures — previously they inflated the login flow to a ~30% failure rate and polluted its latency numbers. Settings → Performance shows a new "Expected / Benign" count alongside completed and failed events.',
      'Added an end-to-end "route to ready" measurement from sign-in to a usable dashboard. Login and the verification-code screen stamp the moment auth succeeds, and the dashboard now reports the full perceived wait across the redirect — the gap that previously fell between two separate, unlinked measurements. Also captures sidebar → dashboard navigation.',
    ]
  },
  {
    version: 'v0.6.174',
    date: '2026-07-08',
    changes: [
      'Redesigned the login screen. It now sits on the calm green Mandelbrot mural — the same living background as the dashboard and account pages — with a frosted translucent card and the breathing ambient Orb floating on the card\'s top-right corner, so signing in feels like the same world as the rest of the app rather than a plain form. The passkey button gained a key glyph, and the email button now reads "Request verification code."',
      'Removed passkey autofill (WebAuthn conditional mediation) from login. In production it never once completed a sign-in yet ran a background credential request on every login mount, and its dwell time was being logged as auth latency — which made login look intermittently slow when it was not. Passkey sign-in is now an explicit button only; that button already handles multiple passkeys and cross-device passkeys through the OS. New users and passkey-less browsers continue to get the email-only path automatically.',
      'The mural now also backs the verification-code screen so the background no longer drops between entering your email and entering the code. The login Orb is perched inside the card\'s top-right corner (rather than overhanging it) and sized down so it never obscures text.',
    ]
  },
  {
    version: 'v0.6.173',
    date: '2026-07-06',
    changes: [
      'Closed ORB-303 (Orb can now look up tickets). Made the internal approval-follow-through eval case deterministic: it had been relying on a live-backlog coincidence (a task code referenced in the test conversation happened to also exist, differently, in the real backlog), which let a correct behavior occasionally read as a false regression. The case now freezes its own backlog, so it tests exactly what it means to — a user approving a proposed change executes it — with no dependence on live data.',
    ]
  },
  {
    version: 'v0.6.172',
    date: '2026-07-06',
    changes: [
      'Fixed Orb calling delete_todo with a ticket code — TICKETS-47 isn\'t a todo, so the call failed with an unhelpful "todo not found" instead of explaining that no delete tool exists for tickets. Root cause: that fact lived only in the admin-only query_tickets tool\'s description, so a non-admin user (who never sees that tool at all) hit the same capability confusion this session already fixed once for admins. The rule now lives in the universal routing prompt instead, and a server-side guard rejects any ticket code passed to delete_todo/update_todo/move_todo with a clear reason before attempting a doomed lookup.',
    ]
  },
  {
    version: 'v0.6.171',
    date: '2026-07-06',
    changes: [
      'Found the actual cause of the intermittent voice-repeat bug: after a conversation turn completed cleanly, a second, redundant piece of code re-derived the spoken text from scratch instead of reusing what had already been correctly computed moments earlier. On most turns the two derivations happened to match and nothing was audible; when they diverged slightly, the trailing "I put the details on screen." line (always appended when a list follows, regardless of the summary content) got spoken a second time. The redundant re-derivation is removed — spoken text is now derived exactly once per turn, not twice.',
    ]
  },
  {
    version: 'v0.6.170',
    date: '2026-07-06',
    changes: [
      'Attempted fix for an intermittent voice bug: after Orb finished speaking and the mic switched over to listening, it would occasionally switch back and replay the same summary — roughly 1 in 3 runs, text-only conversations unaffected. This looks like a known browser-level speechSynthesis quirk (the browser replaying its last queued utterance after a later audio/focus change) rather than a duplicate call in our own code, so browser voice output now force-flushes the synthesis queue the instant each utterance ends instead of trusting the browser to clean up on its own. Flagged as a best-effort mitigation, not a confirmed fix — the intermittent, browser-internal nature of this one makes it hard to verify without further live testing.',
    ]
  },
  {
    version: 'v0.6.169',
    date: '2026-07-06',
    changes: [
      'Fixed Orb describing itself as "non-admin" when explaining why a ticket tool is unavailable — it was conflating its own identity with the current user\'s permission level. It now always frames this as the user\'s access ("you\'re not an admin"), never its own ("I am non-admin") — Orb has no personal admin status separate from whoever it\'s talking to.',
      'Fixed a false self-correction bug for non-admins: their only path to ticket data is the query_db fallback (query_tickets is admin-only), and query_db\'s raw ticket rows carry a bare ticket_number, not a formatted code — so citing a ticket\'s code from that result read as an unbacked "phantom code" citation and wiped a correct answer with a confusing apology. query_db now attaches a formatted code to ticket rows, matching the convention query_tickets already uses, and the code-tracking guard now recognizes it.',
    ]
  },
  {
    version: 'v0.6.168',
    date: '2026-07-06',
    changes: [
      'Added the same required, searchable category field to the create-new-todo modal, closing ORB-318. A newly created todo used to always start with category_id: null with no way to set it — now every new todo is categorized from the start, same as an edited one.',
    ]
  },
  {
    version: 'v0.6.167',
    date: '2026-07-06',
    changes: [
      'Added a required, searchable category field to the todo edit modal. The category_id relationship on todos always existed and was saved through untouched, but nothing anywhere in the app let anyone actually set it — so a category-based question could never find a match no matter how it was asked. Filed ORB-318 to track the remaining half: the create-new-todo modal still has no category field.',
      'Seeded a standard Feature/Bug/Chore/Docs/Support category set into the two projects that had none at all. Every other project keeps its own existing categories untouched — categories are per-project, and several projects (a trip-planning project especially) already have their own meaningful, unrelated category sets.',
    ]
  },
  {
    version: 'v0.6.166',
    date: '2026-07-06',
    changes: [
      'query_todos gained a category filter. Todos were always joined with their category name and shown in results, but nothing let Orb filter by it — so a "how many bugs do I have" question could never actually find category-tagged todos server-side no matter how the routing rule was worded.',
      'Fixed Orb answering ticket questions from its own truncated "10 most recent tickets" context snippet instead of actually querying the tickets table — this produced a wrong count and a wrong list (a real open ticket dropped, others that were not actually open bugs included). Any question about ticket counts or which tickets now requires a live query.',
      'Extended how much of a response Orb speaks aloud in voice mode. It was capped to the first paragraph only, so a short opening line (e.g. a bug count) could crowd out a second paragraph holding the actual answer (e.g. a ticket breakdown), dropping it from speech entirely. Voice now speaks the full narrative lead-in up to the first bulleted/numbered list, with a larger length budget.',
    ]
  },
  {
    version: 'v0.6.165',
    date: '2026-07-06',
    changes: [
      'Fixed Orb reporting "no open bugs" when open bugs existed — a general question like "how many bugs do I have" only checked engineering todos (query_todos), never the reporter-filed tickets queue (query_tickets), even though tickets are bugs too. Both surfaces are now checked for any general bug question.',
    ]
  },
  {
    version: 'v0.6.164',
    date: '2026-07-06',
    changes: [
      'Fixed a lingering voice bug where Orb\'s spoken response repeated its leading sentence — e.g. "Looking at open bugs now. Looking at open bugs now. Two open bugs: ..." The client treated any streaming update that simply omitted an isStreaming flag the same as an explicit "turn is done" signal, so a tool\'s progress update mid-turn (e.g. "Found 2 tickets") triggered an early, partial spoken reply, followed by the real one once the full answer arrived. Now only an explicit isStreaming: false ends a turn; anything else defaults to still-in-progress.',
    ]
  },
  {
    version: 'v0.6.163',
    date: '2026-07-06',
    changes: [
      'Fixed a bug where Orb could silently discard a correct answer about a ticket and replace it with a confusing "Correcting..." apology. The unverified-completion-claim guard treats any task/project/ticket code it can\'t account for as a phantom citation — but it only ever checked a single top-level `code` field on a tool\'s result, never the `returned` list every query tool (query_todos, query_projects, query_tickets) actually returns codes in, and never the static backlog/recent-tickets context Orb is allowed to answer from directly. Both gaps are now closed.',
      'Fixed Orb offering to close, update, or delete a ticket in conversation — there is no such tool, and there never was one for this admin-only, read-only capability. query_tickets\'s tool description now says so explicitly.',
      'Widened the ticket table\'s Code column and added the full ticket code to the Edit modal title, so it\'s no longer truncated out of view.',
    ]
  },
  {
    version: 'v0.6.162',
    date: '2026-07-06',
    changes: [
      'Removed a hardcoded admin/repository-access shortcut from the Orb eval endpoint\'s auth simulation. It now derives isAdmin and canInspectRepository from the resolved eval user\'s actual role, the same logic production uses, instead of two literal `true` values that happened to be correct today only because the eval user lookup already filters to admin roles.',
    ]
  },
  {
    version: 'v0.6.161',
    date: '2026-07-06',
    changes: [
      'Orb can now look up tickets (bugs, suggestions, capability gaps, workflow friction) by code or filter, for admins. Closes the sharpest gap in the object capability matrix audit: create_ticket was the only tool touching the tickets table, so Orb could log a ticket but never report its status back conversationally.',
      'Non-admins can now also ask about tickets they personally filed, through the general database fallback — scoped automatically to their own tickets, never anyone else\'s.',
    ]
  },
  {
    version: 'v0.6.160',
    date: '2026-07-06',
    changes: [
      'Started ORB-316 by adding a canonical Foundational Definitions prompt block shared by production Orb conversation and the eval endpoint.',
      'Consolidated the definitions that had drifted across scope, routing, strategic, project-health, and mutation rules: visible vs owned projects, visible/non-dormant projects vs projects with active tasks, project codes vs project names, explicit BACKLOG facts vs tool-required facts, exact vs vague references, and evidence vs judgment.',
      'Kept ORB-316 intentionally narrow after the v0.6.159 Tier 1 run passed 40/40: the new definitions clarify existing behavior without rewriting the green routing contracts.',
    ]
  },
  {
    version: 'v0.6.159',
    date: '2026-07-06',
    changes: [
      'Enabled the second Strategic Orb v1 interaction: Next-Step Read. Prompts like "what should I work on next?", "where should I focus?", and "help me prioritize" now have a bounded semantic contract for compact, evidence-labeled recommendations.',
      'Clarified ORB-317 — Strategic Orb v1 interaction-quality program — as the umbrella behind the current slices, coordinating context/eval architecture, operating-rule cleanup, capability gaps, project-health reads, next-step recommendations, and future interaction improvements.',
      'Added a per-request Next-Step Packet built from existing project-health, active task, priority, due-date, stale-work, and recent-audit data. It limits strategic recommendations to current-user-owned active task candidates and omits other-user work from the recommendation set.',
      'Added guardrails so next-step recommendations lead with one primary move, at most one alternate, and clear evidence such as in-progress status, urgency, due dates, stale active work, or recent activity instead of dumping a ranked backlog.',
      'Tightened strategic guidance against invented blocker/dependency language: sequencing can be offered as judgment, but "blocked", "must happen first", "gating", and prerequisite claims require explicit evidence.',
      'Tightened live-test follow-up guardrails: next-step reads should avoid even hypothetical blocker phrasing unless the user/evidence raises a blocker, and project-health reads must not label a project as "yours" unless ownership evidence explicitly supports it.',
      'Tightened Tier 1 regression follow-ups for tool routing: bulk project deletes should use visible BACKLOG task codes without a pre-query, missing owner/dormant project facts must call query_projects, exact quoted knowledge-entry corrections call update_knowledge directly, and vague "that entry" corrections search first.',
      'Mirrored the Next-Step contract and packet in the eval endpoint, and strengthened the existing strategic guidance eval case to guard against false completion-claim regressions plus invented blocker/gating phrasing.',
      'Improved the Orb eval CLI progress status line so terminal resizing does not smear wrapped progress-bar fragments across the screen during long eval runs.',
    ]
  },
  {
    version: 'v0.6.158',
    date: '2026-07-05',
    changes: [
      'Enabled the first Strategic Orb v1 interaction: Project-Health Summary. Broad reads like "tell me about my projects" now have a semantic contract for scope, evidence, supported interpretations, and reversible next moves.',
      'Added a per-request Project Health Packet built from existing project, task, priority, and audit data. It gives Orb neutral project-level facts and signals — counts, urgent/in-progress/stale counts, 14-day momentum, recent activity counts, and role hints from project descriptions — without adding schema or forcing a fixed project-role taxonomy.',
      'Added prompt guardrails so Orb can naturally reword project-health observations while preserving accuracy: scratchpad/reminder/holding-area interpretations require explicit support, and quiet projects should not be called stalled, neglected, forgotten, process debt, or blocked based only on inactivity.',
      'Clarified query routing and the generated query_projects tool description so broad project-health reads answer from the supplied BACKLOG when it already contains project names, owners, descriptions, counts, and dormant state, instead of reflexively calling query_projects for a "full picture."',
      'Kept project-role interpretation flexible rather than adding a brittle scratchpad-specific eval; unusual project semantics can be supplied by the user, project description, memory, or approved adaptation as the app grows beyond conventional project-manager usage.',
      'Added project-role correction handling: when the user corrects Orb\'s interpretation of a project purpose, Orb treats that correction as high-confidence for the current conversation and should offer to remember durable project semantics as an approved adaptation rather than silently persisting them.',
      'Cleaned up client-action switch narration so switch_project no longer combines generic "Navigating..." thoughts, premature "Switching to..." model speech, and post-action confirmation into a duplicated text/voice response.',
      'Refined Project Health Summary language so packet signals are treated as watch cues, not verdicts: Orb should avoid blocker/foundational/gating claims unless explicit evidence supports them, and should keep other-user projects separate from the current user\'s workload.',
      'Tuned Project Health Summary tone: quiet active work should be phrased as "quiet with active items" or "worth confirming whether intentionally parked" rather than "stalled" unless stronger evidence exists, and project-health reads should avoid cute/dramatic personification like "working hard" or "heating up."',
    ]
  },
  {
    version: 'v0.6.157',
    date: '2026-07-05',
    changes: [
      'Enabled prompt caching on the eval endpoint — 75% of all Anthropic token volume was eval traffic running with no cache marker at all (0% cached, confirmed by the request ledger and flagged by an Anthropic usage email). The eval system prompt is now split into a stable block (identical across every case in a run, cached once and read by all subsequent cases within the 5-minute window) and a per-case dynamic block, mirroring production\'s existing split. Expected to cut eval input cost by roughly 60%.',
      'Fixed a production cache leak: the confirm_mutation tool was filtered out of the tool list except while a mutation was pending, and tool definitions sit ahead of the system prompt in the cache prefix — so every propose/confirm cycle changed the tool set and voided the cached prompt twice. The tool is now always offered; the server already rejects a confirm when nothing is pending, and the eval harness has always run with it unconditionally present.',
      'The eval prompt assembly now also matches production\'s block order (it had drifted into an interleaved order), improving prompt parity between the harness and production.',
    ]
  },
  {
    version: 'v0.6.156',
    date: '2026-07-05',
    changes: [
      'Started the Strategic Orb v1 context/eval architecture workstream by adding a shared strategic context packet module with packet versioning and a single renderer for frozen strategic evaluation prompts.',
      'Updated the Orb eval endpoint to render strategic context packets through the shared builder and record the packet version in request-ledger evaluation rows.',
      'Updated the strategic eval runner to preserve context packet version/id in blinded review packet output so future strategic-quality reviews can trace answers to the exact context shape.',
    ]
  },
  {
    version: 'v0.6.155',
    date: '2026-07-04',
    changes: [
      'Added the Strategic Orb v1 plan, defining Orb’s first strategic-partner product role, strategic-answer rubric, proactivity boundaries, cost/routing posture, and phased implementation path.',
      'Folded ORB-308 into the Strategic Orb v1 context/eval architecture workstream so eval/production context-builder consolidation happens in service of the strategic product model rather than as isolated plumbing.',
      'Updated the Orb operating-rules audit to point to the Strategic Orb v1 plan as the next product direction after the ORB-314/315 cleanup.',
    ]
  },
  {
    version: 'v0.6.154',
    date: '2026-07-04',
    changes: [
      'Tightened Orb project-summary language so it distinguishes visible/non-dormant projects from projects that actually have active tasks, avoiding replies like "five active projects" when only four listed projects have active work.',
      'Added Tier 2 eval coverage for the visible-project vs active-task-project distinction, including a fixture with five visible projects, four with active tasks, and one dormant project.',
    ]
  },
  {
    version: 'v0.6.153',
    date: '2026-07-04',
    changes: [
      'Added the first doctrine-driven Orb operating rules audit, mapping Orb AI behavior rules across prompts, server guards, evals, tool contracts, preferences, memory, adaptations, Knowledge Repo entries, and model routing.',
      'Classified major Orb rule families by enforcement class: Structural, Checked, or Arbitrated, and identified the highest-priority drift risks: ORB-314 dead integrity rules, ORB-315 project-code speech leakage, duplicated SCOPE prompt text, and ORB-308 eval/production context-builder divergence.',
      'Resolved the first implementation slice from that audit: removed the dead generated ORB_INTEGRITY_RULES prompt export, reframed docs/api-spec.yaml as REST/API integration guidance rather than conversational prompt law, and centralized the duplicated dynamic SCOPE prompt in a shared buildOrbScopePrompt helper.',
      'Tightened Orb project speech rules so project codes and raw [code: ...] backlog tags remain internal routing hints, while task codes such as ORB-123 remain acceptable when identifying tasks.',
      'Added Tier 2 eval coverage for project-list answers to ensure display names are spoken without leaking internal project code tags.',
    ]
  },
  {
    version: 'v0.6.152',
    date: '2026-07-04',
    changes: [
      'Added a draft Orb Craft and Art Doctrine for Stan and multi-agent review, framing Orb as both a world-class AI-native application and a generative seed for future apps.',
      'Captured the working principle that Orb needs technical systems to enforce reliability and metaphorical systems to enforce meaning: the app generator should behave like physics, not a rigid template factory.',
      'Incorporated Claude/Gemini review into the doctrine: physics means laws and emergent forms, not simulation; every invariant needs an enforcement class; obligations scale by blast radius; and binding rule text must live in one operative place to avoid drift.',
      'Added pointer-only references from AGENTS and the design brief to the new doctrine so it is discoverable without duplicating rule text.',
    ]
  },
  {
    version: 'v0.6.151',
    date: '2026-07-04',
    changes: [
      'Closed ORB-309 after production samples confirmed the performance instrumentation foundation is working across dev and production for login, Settings, dashboard, AI Metrics, large tables, todo actions, Orb submit, and voice start.',
      'Recorded the ORB-309 baseline lesson: passkey login latency is dominated by the browser/OS credential ceremony inside navigator.credentials.get rather than Orb app initialization; OTP verification is fast, OTP request is acceptable from the collected samples, and early iPad Safari outliers were treated as stale cache/state contamination after clearing cache fixed the behavior.',
      'Documented the future performance-pass rule: start from Settings > Performance, choose one measured target, collect platform/browser baselines, make one focused change, compare before/after, and record the result instead of reopening broad performance work from feel alone.',
    ]
  },
  {
    version: 'v0.6.150',
    date: '2026-07-04',
    changes: [
      'Added ORB-309 passkey-login stage timing for the production bottleneck now visible across Mac, iPhone, and iPad. The passkey click event now records challenge start, credential option parsing, browser credential return, credential serialization, Supabase verification, and overall completion so the next pass can distinguish browser/biometric delay from Supabase round trips.',
      'Scoped the new breakdown to passkey login only; OTP remains covered by its existing request-level timing and has not been evaluated as part of this pass.',
    ]
  },
  {
    version: 'v0.6.149',
    date: '2026-07-04',
    changes: [
      'Fixed a pre-existing data-visibility bug found while live-testing the new knowledge_repo read tool: cross-project knowledge entries (product_id IS NULL, the documented convention for entries not tied to one project) were invisible to every conversational Orb read — topic search and the new precise-entry lookup alike — because the SELECT RLS policy\'s join could never match a null product_id. 8 of 234 entries were affected. They were always visible in Settings -> Knowledge (which reads via the service-role client), so this was specific to the Orb conversation surface.',
      'Widened the knowledge_repo SELECT RLS policy to also allow product_id IS NULL rows. Verified under a simulated authenticated session that all 8 previously-invisible entries are now visible, with no change to the other 226.',
      'Fixed search_knowledge\'s precise-read mode to fetch the resolved entry directly via the admin client instead of depending on the RLS-scoped conversation context list — so a correctly-resolved entry can no longer come back with empty content even in edge cases the RLS fix does not anticipate.',
    ]
  },
  {
    version: 'v0.6.148',
    date: '2026-07-04',
    changes: [
      'Reframed ORB-302 as full knowledge_repo CRUD (minus delete, which stays admin-only by design): search_knowledge is now the genuine read leg, not just a topic-search tool. Added a "title" parameter for precise single-entry lookup — "show me that entry", "show me the entry about X", verifying an update — separate from the existing "query" topic/discovery mode.',
      'Precise lookup uses the same leeway resolution as update_knowledge (exact match, then a partial reference covering most of its own words) so a user who doesn\'t recall the exact title still gets a reliable result — and any future fix to that resolution logic automatically covers both the read and update paths, since they share one implementation.',
      'Added Tier 1 eval coverage for the new precise-read routing path.',
    ]
  },
  {
    version: 'v0.6.147',
    date: '2026-07-04',
    changes: [
      'Fixed a real wrong-target mutation bug in update_knowledge found in live testing: asking to update the entry titled "Disk IO budget: auth.flow_state accumulation..." instead updated an unrelated entry, "Implementing Client-Side OTP Cooldown (ORB-159)". Root cause: title resolution used a naive one-directional substring check, so a short/generic reference like "ORB-159" matched any title containing that fragment, regardless of how little of the title it actually covered.',
      'Title resolution now requires the reference to cover most of its own significant words within a candidate title (punctuation-stripped, filler words excluded) before treating it as a confident match — a single generic fragment can no longer hijack an unrelated, much longer title. A weak/ambiguous reference now correctly falls back to not-found or asks the user to disambiguate instead of silently picking a match.',
      'The confirmation step for knowledge updates now requires the model to state the exact resolved entry title verbatim (in quotes) before asking the user to approve, so a wrong resolution is visible before execution, not just structurally prevented.',
      'The wrongly-mutated entry was restored to its original content from the audit trail; the incorrect original update and the manual restoration are both recorded in audit_log.',
    ]
  },
  {
    version: 'v0.6.146',
    date: '2026-07-04',
    changes: [
      'Fixed update_knowledge forcing an unnecessary search_knowledge round-trip on every correction, even when the exact entry title was already quoted in the request — the tool description said "search first, then call this" instead of following the update_project pattern, where the model calls the mutation directly with a title/name reference and the server resolves it (exact, then fuzzy) and reports ambiguous/not-found.',
      'update_knowledge now behaves like update_project: called directly when a title is already known, falling back to search_knowledge only when the reference is genuinely vague (e.g. "that entry" with no title anywhere in context) — verified live against both cases.',
      'Corrected two eval cases that had asserted the old, overly strict behavior; added a case for the vague-reference fallback and for the no-delete-tool response no longer claiming a specific unconfirmed next step.',
    ]
  },
  {
    version: 'v0.6.145',
    date: '2026-07-04',
    changes: [
      'Fixed two bugs found while live-testing update_knowledge: a cold-start "update the disk IO budget entry" request was routing to query_todos (searching tasks, not knowledge) instead of search_knowledge — added a vocabulary rule so "entry"/"that entry" means a Knowledge Repository entry, not a todo, even when phrased as "update" or "fix."',
      'Fixed a real relevance-ranking bug in search_knowledge itself: with 200+ knowledge entries, short queries like "disk IO budget" matched ~40% of the entire repository (any entry containing "disk" OR "budget" anywhere in a long content block), and results were never ranked — so the actual best match could be crowded out of the 10-result cap by newer, loosely-matching entries. search_knowledge now scores and sorts results by relevance (exact/title matches weighted far above incidental content matches, generic meta-words like "entry"/"issue" excluded from scoring) before capping to 10.',
      'Added a regression eval case (knowledge-entry-not-todo-cold-start) reproducing the exact failing input from live testing.',
    ]
  },
  {
    version: 'v0.6.144',
    date: '2026-07-04',
    changes: [
      'Added an update_knowledge tool so the Orb can correct or amend an existing Knowledge Repository entry by title, instead of only ever creating new entries (ORB-302).',
      'update_knowledge is held for confirmation like update_project — the Orb proposes the change and executes only after the user approves.',
      'Every successful update is signed and time-stamped by the server automatically ("[Updated: YYYY-MM-DD HH:MM UTC — Orb (Haiku 4.5)]"), never composed by the model, so it can never be skipped or malformed.',
      'Deliberately no delete_knowledge tool — deletion stays admin-only in Settings. If the Orb detects a stale or wrong entry it cannot fix with an update, it files a ticket for admin review instead of trying to remove the entry itself.',
      'Added Tier 1 and Tier 2 eval cases covering the update-vs-create distinction, the no-self-attribution rule, and the missing-delete-routes-to-a-ticket behavior. Updated the Object Capability Matrix knowledge_repo row.',
    ]
  },
  {
    version: 'v0.6.143',
    date: '2026-07-03',
    changes: [
      'query_projects now returns the owner for dormant projects, so questions like "who owns CAN26?" are answerable — live testing showed neither the backlog context nor the tool carried dormant-project ownership, leaving the Orb unable to answer without waking the project.',
    ]
  },
  {
    version: 'v0.6.142',
    date: '2026-07-03',
    changes: [
      'Added a project-fact provenance rule to the shared query-routing prompt: owner, description, and dormant state may only come from explicit backlog tags or query_projects results — the Orb must never assume the current user owns a project when the backlog shows no owner tag. Caught by the query-projects-tool eval case, where the model fabricated ownership instead of calling the tool.',
    ]
  },
  {
    version: 'v0.6.141',
    date: '2026-07-03',
    changes: [
      'Fixed query_projects routing: the rule now lives in the live QUERY ROUTING prompt shared by production and the eval harness, aligned with the existing backlog-direct-access design — the tool fires when the backlog context cannot fully answer a project question, rather than on every project mention.',
      'Rewrote the query-projects eval cases on frozen backlog fixtures (no owner or dormant data in context) so the tool call is deterministically required, matching how other project-routing cases are built.',
    ]
  },
  {
    version: 'v0.6.140',
    date: '2026-07-03',
    changes: [
      'Added a query_projects tool so the Orb can answer questions about projects themselves — what projects exist, who owns them, descriptions, active/total task counts, and dormant state — when the backlog context cannot answer (ORB-301).',
      'query_projects follows the name-first convention: it takes a project name (partial and fuzzy matches resolve), never a code, consistent with update_project and delete_project.',
      'Added Tier 1 eval cases for project listing and dormant-project queries, and updated the Object Capability Matrix projects row.',
    ]
  },
  {
    version: 'v0.6.139',
    date: '2026-07-03',
    changes: [
      'Relabeled AI Metrics cost accounting so the newer request-ledger section is clearly titled App AI Cost Accounting and calls out API TTS usage from OpenAI and ElevenLabs.',
      'Mapped the voice_tts source label to Voice TTS and clarified that the older daily metrics summary does not own API TTS provider cost accounting.',
      'Started the ORB-310 AI Metrics redesign from the top section: tightened the App AI Cost Accounting caption, populated the model filter from request-ledger models plus configured rate cards, moved the eval/day-to-day note beneath the filter controls, used one ledger-style summary card instead of duplicate card/list renderings, added an Accounting Details card, aligned top-section card widths, and restored a distinct New Rate Card form above the existing rate-card list.',
      'Removed the legacy orb_metrics daily summary from AI Metrics and replaced the visible logging table with a paginated, searchable request-level orb_model_requests ledger that keeps the shared pagination and column navigation controls.',
      'Fixed shared SettingsCrudList table controls so tables using external search modals, including AI Request Log, still render the column navigation controller when their columns overflow.',
      'Added a show/hide toggle for the AI Request Log and defaulted it collapsed on narrow/coarse-pointer screens to reduce iPhone scrolling.',
      'Kept SettingsCrudList page headers and header extras mounted during initial table loading so showing the AI Request Log on narrow screens no longer collapses the page shell and jumps to the top.',
      'Finished the visible AI Metrics redesign by restyling Provider Bill Reconciliation with an external section header, outlined inputs, editable recorded bill rows, and audited delete support.',
      'Started ORB-311 by moving AI Request Log from exact-count offset paging to cursor pagination on indexed creation time, so the growing request ledger loads like an operational log instead of recounting the table on each page.',
      'Continued ORB-311 by moving App AI Cost Accounting summary math into a service-role-only database rollup RPC, returning compact totals and breakdowns instead of fetching thousands of raw request rows during page initialization.',
      'Fixed AI Metrics page_full_load telemetry to measure the component load lifecycle directly, avoiding stale navigation timestamps that produced misleading 0ms samples.',
      'Tightened performance telemetry platform detection so iPhone/iPad analysis uses device signals before falling back to viewport width and coarse-pointer heuristics.',
      'Updated the UI catalog with the AI Metrics accounting, rate-card, and request-log patterns used by the redesign.',
      'Documented the known sandboxed network path in AGENTS so required Supabase, psql, Orb API, and Knowledge Repo reads go directly to approved network access when the current AI tool is known to be sandboxed.',
    ]
  },
  {
    version: 'v0.6.138',
    date: '2026-07-02',
    changes: [
      'Added a Performance Analysis panel to Settings -> Performance that separates completed latency samples from failed, stale, or interrupted events and highlights data coverage, completed events, failures, top bottlenecks, attention rows, and platform differences.',
      'Updated the latency summary so P50/P75/P95 are calculated from successful completed events while failures remain visible as their own reliability signal.',
      'Added a production telemetry collection checklist to Measurement Controls so the required deploy, Vercel env var, per-browser recording, focus-area selection, and production-row confirmation steps are visible where measurement is configured.',
      'Documented the new Performance analysis classes in the UI catalog.',
    ]
  },
  {
    version: 'v0.6.137',
    date: '2026-07-02',
    changes: [
      'Improved Performance Settings filters with visible captions, styled dropdown controls, narrow-width wrapping, and browser filtering/grouping in the Latency Summary.',
      'Added spacing and numeric alignment to the Latency Summary table so platform, browser, count, percentile, and max cells no longer run together.',
    ]
  },
  {
    version: 'v0.6.136',
    date: '2026-07-02',
    changes: [
      'Fixed Performance Settings narrow-width layout so the Matching Events, Slowest P95, Worst Platform, and Recording summary cards remain visible instead of being hidden by the generic metrics mobile rule.',
    ]
  },
  {
    version: 'v0.6.135',
    date: '2026-07-02',
    changes: [
      'Extended ORB-309 performance instrumentation to the main dashboard click surface: project switching now records click-to-list-settled timing, list sort/filter/view changes are measured, todo create/edit/delete/toggle/status/bulk actions record round-trip timings, project create/update/delete is timed, and Orb submit plus voice start now emit stage-level telemetry.',
      'Updated the object capability performance matrix so project switch and todo CRUD are tracked as instrumented dashboard-click flows with baselines still pending.',
    ]
  },
  {
    version: 'v0.6.134',
    date: '2026-07-02',
    changes: [
      'Clarified the Performance Settings Latency Summary copy with inline definitions for latency, Settings focus, flow, count, and P50/P75/P95 percentile timings.',
    ]
  },
  {
    version: 'v0.6.133',
    date: '2026-07-02',
    changes: [
      'Improved the Performance Settings UX: measurement controls and filters now wrap cleanly on narrow Settings layouts, the latency summary has a clear title and explanation, summary rows convert to mobile cards, event rows use the established CRUD card styling on mobile, and table column navigation uses the existing Settings column-control pattern instead of pagination controls.',
      'Updated the UI catalog with the Performance telemetry responsive classes and clarified that `crud-scroll-controls` is the existing column controller for horizontally overflowing Settings tables.',
    ]
  },
  {
    version: 'v0.6.132',
    date: '2026-07-02',
    changes: [
      'Added central SettingsCrudList performance instrumentation for initial/search/filter/sort/pagination loads plus modal open/close, add, save, delete, move, and bulk-delete actions, so Settings pages inherit ORB-309 timing coverage without one-off wiring.',
      'Updated the ORB-309 plan and object capability matrix to reflect the implemented telemetry foundation and remaining performance-measurement gaps before optimization work begins.',
    ]
  },
  {
    version: 'v0.6.131',
    date: '2026-07-02',
    changes: [
      'Added a full perceived AI Metrics page-load measurement from Settings navigation through component mount, AI accounting load, metrics table load, and provider reconciliation load, so ORB-309 captures the multi-second wait Stan sees rather than only one individual server action.',
    ]
  },
  {
    version: 'v0.6.130',
    date: '2026-07-02',
    changes: [
      'Fixed the Performance Event detail modal layout so summary fields and JSON textareas render as separated readable cards instead of overlapping labels and controls.',
    ]
  },
  {
    version: 'v0.6.129',
    date: '2026-07-02',
    changes: [
      'Restyled the Performance Settings measurement controls so browser recording state, sample rate, focus areas, and probe/flush actions are visually distinct instead of reading like plain run-on text.',
    ]
  },
  {
    version: 'v0.6.128',
    date: '2026-07-02',
    changes: [
      'Made AI Metrics and Settings navigation performance events flush immediately after measurement so short-lived page transitions cannot leave ORB-309 timings sitting in the browser queue.',
    ]
  },
  {
    version: 'v0.6.127',
    date: '2026-07-02',
    changes: [
      'Fixed an ORB-309 telemetry setup gap for existing browsers: previously saved focus-area selections now get the new Settings focus added once, and the Performance Settings page warns when Settings focus is off so Settings navigation/page-load measurements do not fail silently.',
    ]
  },
  {
    version: 'v0.6.126',
    date: '2026-07-02',
    changes: [
      'Extended ORB-309 instrumentation to Settings navigation and AI Metrics loads, including the AI accounting server actions and the paged metrics table load, lowered the browser telemetry flush delay, and made local HTTPS dev tolerate the self-signed certificate used by the dev server so Server Action responses do not fail certificate verification.',
    ]
  },
  {
    version: 'v0.6.125',
    date: '2026-07-02',
    changes: [
      'Hardened the ORB-309 performance collector after live dev testing: server-side ingestion now generates a valid correlation ID when the browser does not provide one, returns the real insert message in development, and the Performance Settings page includes probe/flush controls so collection failures are visible immediately.',
    ]
  },
  {
    version: 'v0.6.124',
    date: '2026-07-02',
    changes: [
      'Built the first ORB-309 performance instrumentation slice: performance_events migration, sanitized ingestion API, client telemetry helper with focus areas and platform metadata, admin Performance Settings page using existing SettingsCrudList/search/modal patterns, and initial auth/dashboard-init timing hooks.',
    ]
  },
  {
    version: 'v0.6.123',
    date: '2026-07-02',
    changes: [
      'Added a standing performance-instrumentation build rule to AGENTS and ORB-309: every new feature or meaningful behavior change must decide whether timing instrumentation is required, with explicit criteria covering clickable flows, initialization work, async chains, platform-dependent behavior, and Stan-reported slowness.',
    ]
  },
  {
    version: 'v0.6.122',
    date: '2026-07-02',
    changes: [
      'Refined the ORB-309 performance plan to require focus-area telemetry controls, a full Settings page for performance events using existing SettingsCrudList/search/modal patterns, and platform-specific Mac/iPad/iPhone analysis as a first-class requirement.',
    ]
  },
  {
    version: 'v0.6.121',
    date: '2026-07-02',
    changes: [
      'Added the ORB-309 initialization and interaction performance instrumentation plan, covering dev/production toggles, durable timing logs, stage-level measurements, click-surface coverage, database impact, and a phased build path before optimization.',
    ]
  },
  {
    version: 'v0.6.120',
    date: '2026-07-02',
    changes: [
      'Documented the expected Knowledge Repo sandbox DNS/network failure path for agents: retry the required read with network approval/escalation immediately instead of re-diagnosing the same roadblock each session.',
    ]
  },
  {
    version: 'v0.6.119',
    date: '2026-07-01',
    changes: [
      'Follow-up audit after the v0.6.118 fix: the eval test harness that guards Orb\'s conversational behavior was missing real voice speech-policy rules (no re-greeting, a brevity threshold, no filler phrases) and an entire capability (self-proposed behavioral adaptations) -- meaning regressions in either were structurally invisible to the automated test suite. Both are now shared with production instead of hand-duplicated, closing the drift risk rather than just re-syncing the text once more.',
    ]
  },
  {
    version: 'v0.6.118',
    date: '2026-07-01',
    changes: [
      'Fixed a real bug caught live in voice: Orb could narrate "Switching to X... Done." without ever calling the tool that actually switches projects, leaving the wrong project active while claiming success. The safeguard that would have caught this (checking for completion language with no backing tool call) existed only in the eval test harness and had silently never made it into the live app — the two copies are now one shared module so they cannot drift apart again.',
      'That same safeguard is now general — it applies to any tool-backed claim (a project switch, a navigation, a mutation), not just todo/project code citations, closing the specific gap this bug exploited.',
      'Fixed a second, related bug: the server-side project switch only matched exact names, a weaker duplicate of the fuzzy name matching shipped in v0.6.117 for the rest of the app. Both now share one resolver.',
      'client_action\'s switch_project now takes a project name, not a code, consistent with how update_project and delete_project already work — closing an inconsistency in how Orb was told to address projects internally.',
      'Extended the mutation verification protocol (present tense before a tool runs, confirm only after a real result) to cover navigation actions like switching projects, not just data mutations.',
    ]
  },
  {
    version: 'v0.6.117',
    date: '2026-07-01',
    changes: [
      'Project code is now purely an internal handle: it composes todo codes (e.g. ORB-73) and nothing else. Removed it from every place it appeared as a second user-facing label — the switch-project list, ticket/knowledge project pickers, the Settings → Projects table, printed reports, and the Orb project-switch voice/transcript message. Project names are the only thing users see or type.',
      'The Code field is gone from every project create/edit form (new project modal, Settings → Projects, admin user-detail project editor). Codes are now generated automatically and silently from the project name, with the existing collision-safe suffixing.',
      'Project references — typed commands, Orb tool calls, and conversation — now resolve by exact name, exact code, or partial/fuzzy name match, in that order, so "Switch to Mr. Stokely" resolves the same project as "Switch to Mr. Stokely from Boston."',
      'Deleted the orphaned pre-Unified-Dashboard routes (`/dashboard/classic`, `/dashboard/[productId]`) and their components (DashboardProducts, TodoView) — unreachable from any in-app link since the Unified Dashboard shipped. Any future split-view rebuild starts from UnifiedDashboard.',
      'Added an eval case for partial project-name resolution via Orb conversation.',
    ]
  },
  {
    version: 'v0.6.116',
    date: '2026-07-01',
    changes: [
      'Bulk confirmation messages now list the exact target todos (code and title) in the transcript, so "see the transcript for the exact items" actually shows them. Large sets show the first 10 plus a total count instead of an unbounded list.',
    ]
  },
  {
    version: 'v0.6.115',
    date: '2026-07-01',
    changes: [
      'Identifier provenance is now enforced as a general rule: Orb may only use task codes it has actually seen (backlog, tool results, or your own words) — never constructed by pattern or remembered from a cleared session.',
      'The server now rejects any mutation targeting a task code that never appeared in the conversation, instructing Orb to look up the real tasks instead.',
      'When a conversation starts with no history (e.g. after an update or refresh cleared the transcript), Orb is told its session record is empty, so references to earlier actions trigger a lookup instead of a guess.',
      'Added an eval case asserting that "delete the todos you created" with a cleared record performs a lookup.',
    ]
  },
  {
    version: 'v0.6.114',
    date: '2026-07-01',
    changes: [
      'Stacked or repeated affirmations ("Confirm confirm", "yes go ahead") now count as confirmation, so voice transcripts no longer trigger a second confirmation ask.',
      'Granting permission up front ("you have my permission", "no need to confirm") now executes the requested todo actions directly, with Orb acknowledging the pre-given go-ahead instead of asking again. Stop remains the escape hatch.',
      'Added eval cases for stacked affirmations and upfront permission.',
    ]
  },
  {
    version: 'v0.6.113',
    date: '2026-07-01',
    changes: [
      'Voice mode now speaks each Orb response exactly once, after the response completes, instead of speaking sentence-by-sentence while it streams. This removes the repeated/overlapping speech heard when a confirmation or correction replaced the streamed text mid-response.',
      'The speech queue was simplified to a single utterance per response: spoken-progress tracking, mid-stream recovery, and the unused status speech path were removed. Mic handback now always follows the single completed utterance.',
    ]
  },
  {
    version: 'v0.6.112',
    date: '2026-06-30',
    changes: [
      'The Orb eval endpoint now honors frozen backlog fixtures when resolving the selected project, so fixture-only project codes no longer depend on live database state.',
    ]
  },
  {
    version: 'v0.6.111',
    date: '2026-06-30',
    changes: [
      'Starting voice mode now treats existing transcript messages as display-only history, so Orb does not read old conversation text before speaking the voice intro.',
    ]
  },
  {
    version: 'v0.6.110',
    date: '2026-06-30',
    changes: [
      'Voice mode now shows a visual "Gathering data..." state before speaking summaries, with an indeterminate progress bar above the Orb state icon.',
      'The voice Orb is now slightly smaller and positioned at the top right, keeping voice featured while letting the transcript remain the primary reading surface.',
      'Documented the updated voice Orb state and placement pattern in the UI catalog.',
    ]
  },
  {
    version: 'v0.6.109',
    date: '2026-06-30',
    changes: [
      'Voice streaming now leaves the active speaking state after a partial segment drains, while still waiting for the final response before handing the mic back.',
      'Voice spoken text is concise from the start of a response instead of switching from full transcript speech to summary speech mid-stream.',
      'The speech queue now recovers when the derived spoken text becomes shorter than previously queued text, avoiding dropped speech and missed mic handoff.',
    ]
  },
  {
    version: 'v0.6.108',
    date: '2026-06-30',
    changes: [
      'Voice responses now distinguish displayed transcript text from shorter spoken text so Orb can act like an operator instead of reading long dashboard answers aloud.',
      'The speech queue now tracks per-response spoken character progress and queues only new completed speech segments, preventing the final transcript update from replaying already-spoken text.',
      'Bulk confirmation speech now points users to the transcript for exact items instead of trying to read every target aloud.',
      'Added the Voice Operator Runtime plan documenting the heard-vs-displayed contract, voice CRUD boundary, iOS rules, and migration path.',
    ]
  },
  {
    version: 'v0.6.107',
    date: '2026-06-30',
    changes: [
      'Voice startup no longer has a separate dashboard recovery timer that can start microphone recognition while the greeting is still loading or playing.',
      'Voice startup now fails visibly if current TTS settings cannot be loaded instead of silently falling back to another voice.',
      'iPhone speech recognition now guards duplicate start calls and stops rapid empty start/end cycling so browser microphone permission notices do not loop.',
      'Opening greetings have more variation while still avoiding automatic project summaries.',
    ]
  },
  {
    version: 'v0.6.106',
    date: '2026-06-30',
    changes: [
      'Orb no longer opens text mode with an automatic backlog summary; it starts with a simple greeting and waits for the user to ask for project state.',
      'Starting voice mode reuses the visible opening greeting when present, avoiding a duplicate greeting in the transcript.',
      'Added behavioral eval coverage so conversational greetings do not volunteer project summaries.',
    ]
  },
  {
    version: 'v0.6.105',
    date: '2026-06-30',
    changes: [
      'Migrated the deprecated Next.js middleware convention to proxy.ts/proxy() for Next 16.',
      'Aligned Turbopack and output file tracing roots with the current project root to remove production build warnings.',
    ]
  },
  {
    version: 'v0.6.104',
    date: '2026-06-30',
    changes: [
      'Update banner copy now distinguishes production-style version updates from local development server restarts.',
      'When a dev-only server restart is detected without a version change, the banner says "Dev only: reconnect to the restarted local server" and the action button says "Reconnect".',
    ]
  },
  {
    version: 'v0.6.103',
    date: '2026-06-30',
    changes: [
      'Version displays now show the pinned running client version until the user explicitly applies an update and reloads.',
      'What\'s New no longer presents newer release entries as installed before approval; it filters the changelog to the running client version and labels that release as Installed.',
      'Settings update checks compare the live server version against the pinned running client version and use the shared manual update path.',
    ]
  },
  {
    version: 'v0.6.102',
    date: '2026-06-30',
    changes: [
      'Retest release bump for manual update behavior on iPhone and iPad after disabling silent release recovery reloads.',
    ]
  },
  {
    version: 'v0.6.101',
    date: '2026-06-30',
    changes: [
      'Release recovery no longer applies updates silently. Version mismatches and development server restarts still surface the Update banner automatically, but the user must tap Update to reload.',
    ]
  },
  {
    version: 'v0.6.100',
    date: '2026-06-30',
    changes: [
      'Development release recovery now detects when the local Next/Turbopack server process restarts under an already-open tab, even if the Orb version string has not changed.',
      'When a dev-server restart is detected, Orb applies the same version-safe refresh path automatically so iPad and iPhone testing does not require clearing browser data, switching tabs, or manually recovering from the Next dev overlay.',
      'The update path no longer performs an extra pre-reload self-fetch, avoiding local HTTPS certificate verification races during a dev-server restart.',
      'The admin-only developer-channel poll now pauses during update/restart recovery instead of sending server actions into a rebooting dev server.',
    ]
  },
  {
    version: 'v0.6.99',
    date: '2026-06-30',
    changes: [
      'Release coherency now has a central app-shell coordinator: Orb checks the live server version every 30 seconds while the tab is visible, so long-running tabs can discover a new deployment without requiring a tab switch.',
      'The Update banner now uses the shared update path, applying service worker updates, clearing only version-sensitive Orb session state, and reloading through one canonical flow.',
      'The push-notification service worker now activates new worker code immediately with skipWaiting/clients.claim while remaining push-only and avoiding app asset caching.',
      'Conversational update commands now use the same no-cache version check and shared apply-update path as the visible Update banner.',
    ]
  },
  {
    version: 'v0.6.98',
    date: '2026-06-30',
    changes: [
      'iPhone voice mode now stores interim recognition text as the submit-ready transcript, so visible speech text can be sent even when iOS does not emit a final result.',
      'API voice playback now resumes the AudioContext before playback and uses a watchdog so a stuck or silent audio source cannot trap voice mode before the mic handoff.',
    ]
  },
  {
    version: 'v0.6.97',
    date: '2026-06-29',
    changes: [
      'Tightened the deterministic voice project-state shortcut so single-project health questions still exercise the normal operational model route.',
    ]
  },
  {
    version: 'v0.6.96',
    date: '2026-06-29',
    changes: [
      'Broadened the unsupported-commitment eval to accept honest "cannot reliably/cannot actually do that" refusals, while still rejecting false future promises.',
    ]
  },
  {
    version: 'v0.6.95',
    date: '2026-06-29',
    changes: [
      'Added a commitment-integrity rule so Orb does not promise future behavior, persistence, or capabilities unless a real tool or current system rule can honor the commitment.',
      'Added behavioral eval coverage for unsupported durable commitments so Orb answers honestly instead of claiming it will remember or always do something.',
    ]
  },
  {
    version: 'v0.6.94',
    date: '2026-06-29',
    changes: [
      'Voice recognition resume now treats duplicate SpeechRecognition starts as an already-listening state, avoiding a console InvalidStateError when Stop races the mic restart.',
    ]
  },
  {
    version: 'v0.6.93',
    date: '2026-06-29',
    changes: [
      'Voice mode now recovers from the idle "Ready" pocket after a completed response by handing the mic back when no speech, request, or manual stop is active.',
    ]
  },
  {
    version: 'v0.6.92',
    date: '2026-06-29',
    changes: [
      'Session action sets are now mirrored to sessionStorage with the conversation transcript, preserving same-tab reload recovery for references like "delete the first five".',
      'Clearing the transcript or switching projects clears the session action-set ledger to avoid stale references.',
      'Grouped transaction toasts now fire only on the final grouped result instead of once per progress update plus one extra.',
      'Documented the action ledger recovery boundary: same-tab/session durable, not a cross-device transaction journal.',
    ]
  },
  {
    version: 'v0.6.91',
    date: '2026-06-29',
    changes: [
      'Added a session-scoped action-set ledger so follow-up references like "delete them" or "delete the first five" can resolve against verified prior todo action batches without exposing every code in the spoken summary.',
      'The shared conversation path can now turn a destructive reference to a prior action set into a concise pending confirmation, preserving the approval step while avoiding stale backlog guesses.',
      'Added focused eval coverage for resolving "Delete the first five todos" against the session action ledger.',
    ]
  },
  {
    version: 'v0.6.90',
    date: '2026-06-29',
    changes: [
      'Grouped todo action confirmations now summarize all same-kind batch operations by count, including creates, updates, deletes, and moves.',
      'Grouped todo action success messages now summarize by count instead of reading every generated or affected task code aloud.',
    ]
  },
  {
    version: 'v0.6.89',
    date: '2026-06-29',
    changes: [
      'Bulk todo deletes now use the shared action transaction path: the model is instructed to call delete_todo for each matching task and let the app ask for confirmation.',
      'Multi-delete confirmations now summarize by count/project instead of reading every task code aloud.',
      'If the Orb previously produced a prompt-only delete confirmation with explicit task codes, a subsequent yes can recover deterministically and execute those listed deletes instead of asking again.',
      'Added Tier 1 coverage for bulk project-todo deletion tool calls.',
    ]
  },
  {
    version: 'v0.6.88',
    date: '2026-06-29',
    changes: [
      'Voice auto-TTS now speaks any new final Orb reply in voice mode, not only streamed replies or replies still tied to an active request, while marking the greeting as already spoken to avoid duplication.',
    ]
  },
  {
    version: 'v0.6.87',
    date: '2026-06-29',
    changes: [
      'Voice mode now speaks deterministic non-streaming Orb replies, such as app-computed project-state summaries, and then resumes listening.',
    ]
  },
  {
    version: 'v0.6.86',
    date: '2026-06-29',
    changes: [
      'Voice broad project-state questions now use a deterministic short summary from app state instead of asking the model to produce a concise spoken inventory.',
      'The voice project-state eval path mirrors that deterministic summary, reducing Tier 2 cost for that case while matching production behavior.',
      'Expanded the garbled voice-input eval synonyms to accept the actual "not catching" / "garbled" clarification phrasing.',
    ]
  },
  {
    version: 'v0.6.85',
    date: '2026-06-29',
    changes: [
      'Voice mode now suppresses ambient urgency-transition chatter after confirmed actions, avoiding extra "Orb shifted..." lines after deterministic mutation results.',
      'Deterministic todo action summaries now use a natural grouped form such as "Done — created TEST-4, TEST-5, and TEST-6."',
    ]
  },
  {
    version: 'v0.6.84',
    date: '2026-06-29',
    changes: [
      'First approximation of the Orb action transaction thesis: todo mutations from a single request are now collected into one pending action transaction shared by text and voice.',
      'Confirming a pending todo action now executes the exact stored operations deterministically before another model turn, so batch creates cannot partly execute while holding only one item.',
      'Asking whether a pending action is already set/done now gets a deterministic "not yet" answer and keeps the pending action available instead of accidentally executing it.',
      'Added eval support for expected tool-call counts plus a batch-create regression case requiring three create_todo calls for a three-todo request.',
      'Documented the action transaction thesis, first approximation, verification targets, and abandonment criteria.',
    ]
  },
  {
    version: 'v0.6.83',
    date: '2026-06-29',
    changes: [
      'Orb eval runner now prints local and ISO start/completion timestamps in Tier 1/Tier 2 runs so pasted results are easier to compare over time.',
      'Adjusted the project-health Tier 2 assertion to accept current active/in-progress phrasing while still requiring active and parked status concepts.',
    ]
  },
  {
    version: 'v0.6.82',
    date: '2026-06-29',
    changes: [
      'Voice project-state summaries are now constrained to one short plain-text paragraph with no markdown or bullets.',
      'Adjusted Tier 2 voice eval assertions to accept the actual configured provider/voice names and to guard against formatted project inventories.',
    ]
  },
  {
    version: 'v0.6.81',
    date: '2026-06-29',
    changes: [
      'Voice mode broad project-state answers are now explicitly constrained to totals plus at most one notable project or risk, avoiding spoken task inventories by default.',
      'Updated Tier 2 eval cases to match the current 0.6.x release line, voice-mode context, and the server-held mutation flow.',
    ]
  },
  {
    version: 'v0.6.80',
    date: '2026-06-29',
    changes: [
      'Voice mode is terser by default: broad summaries and analysis now target 1–3 spoken sentences and avoid automatic follow-up offers unless the user asks what to do next.',
      'Added a completed-message guard so the same final Orb response is not sent to TTS twice as voice state settles.',
    ]
  },
  {
    version: 'v0.6.79',
    date: '2026-06-29',
    changes: [
      'Voice mode now defaults to shorter spoken answers: broad summaries, task details, and analysis should use a concise 2–4 sentence shape unless the user asks for more.',
      'Voice mode transcript text is readable again instead of blurred, while keeping the existing Orb size and layout unchanged.',
    ]
  },
  {
    version: 'v0.6.78',
    date: '2026-06-29',
    changes: [
      'Voice TTS reliability: streaming responses now speak the final response once after generation completes, so the audio output matches the transcript instead of dropping earlier streamed chunks.',
    ]
  },
  {
    version: 'v0.6.77',
    date: '2026-06-29',
    changes: [
      'Voice mode speech-channel cleanup: speak, speakStatus, and speakStreaming now share one internal queue setup path while preserving their separate timing contracts.',
      'Voice settings now refresh in the mounted dashboard after a voice/provider change and again before the greeting, so voice mode uses the current TTS config without needing a reload.',
      'Removed silent API-to-browser TTS fallback. API voice failures now surface as recoverable voice errors instead of unexpectedly switching to a browser voice mid-session.',
      'Progress cues are now visual-only, so tool/thought labels no longer compete with the main spoken response.',
      'Orb behavior hardening: after project disambiguation the server now injects an explicit call-the-mutation-tool instruction for the selected target, and knowledge-topic questions are routed to search_knowledge unless recent snippets fully answer them.',
      'Added the Orb voice speech-channel plan documenting the shared CRUD requirement: voice CRUD continues to use the same server action and tool paths as text CRUD.',
    ]
  },
  {
    version: 'v0.6.76',
    date: '2026-06-28',
    changes: [
      'Project CRUD reliability rework: create/rename/delete of projects now use a server-held propose → confirm → execute flow. The Orb proposes the action; the server holds the exact intent (resolved to a concrete project, not a name) and only executes it when you confirm via a dedicated confirm step. This removes the double-confirmation, lost-state, and false-success bugs that came from the AI driving confirmation across turns.',
      'Projects are now identified by name everywhere you speak to the Orb — never by internal code. A name is resolved to one project (0/1/many): if more than one project matches, the Orb asks which one you mean (showing the code only to break the tie). The immutable project code is used only behind the scenes for tool calls.',
      'The Orb\'s backlog view now shows each project by name first, with the code as secondary metadata, so it can match what you actually say.',
      'Voice confirmations are now instant: when you confirm a project action by voice, the result is spoken immediately without an extra round-trip to the AI. In text the Orb still narrates in its own voice.',
      'Duplicate project names are caught at proposal time with a clear message instead of silently creating a second project.',
    ]
  },
  {
    version: 'v0.6.75',
    date: '2026-06-27',
    changes: [
      'Structural mutation gate: CRUD operations (create/update/delete for projects and todos) are now held by the server until the user confirms. The AI proposes the action, the server holds the tool call, and execution only happens after the user\'s next message sends back the pending mutation. This replaces prompt-only gating which the AI could ignore.',
      'Fixed project creation naming: the create_project tool description now instructs the AI to use the user\'s exact words as the project name instead of splitting into separate name and code fields.',
    ]
  },
  {
    version: 'v0.6.74',
    date: '2026-06-27',
    changes: [
      'New runtime capability detection: useCapabilities hook detects platform, browser, and speech API availability. Voice mode now warns users when their browser/platform cannot support voice input (e.g. Chrome on iOS).',
      'Voice mode config race fix: TTS config load failure now falls back to browser TTS instead of silently dropping speech. Voice mode start is blocked until config resolves.',
      'Provider switch safety: prefetched TTS audio is now tagged with the provider that generated it. Switching providers mid-session discards stale prefetch instead of playing audio from the wrong voice.',
      'Voice error recovery: TTS playback failure now immediately resets the speaking state instead of leaving the UI stuck. Added 30-second safety timeout for stuck speaking state.',
      'iOS voice recognition reliability: auto-resume now retries once on failure instead of silently giving up. Shows "Microphone lost" message if retry also fails.',
      'Tool error propagation: if a tool call fails and the AI does not acknowledge the error in its response, the error is surfaced to the client.',
      'Network error differentiation: connection failures and timeouts now show specific messages instead of generic "Something went wrong."',
      'Eliminated silent .catch(() => {}) patterns across dashboard, conversation, and voice components.',
    ]
  },
  {
    version: 'v0.6.73',
    date: '2026-06-27',
    changes: [
      'Removed the server-side approval gate — mutation confirmation is now handled entirely by the AI prompt layer. The regex-based gate caused the delete_project infinite loop and was the #1 source of CRUD bugs.',
      'Removed forced tool_choice injection on confirmation, SYSTEM message injection, and approval interception from both the server action and eval endpoint.',
      'Eval cases updated: delete-project-asks-once and create-after-hallucinated-history moved to Tier 2 (behavioral) since the AI generates its own confirmation language.',
    ]
  },
  {
    version: 'v0.6.72',
    date: '2026-06-26',
    changes: [
      'Fixed project deletion approvals by making the generic mutation approval gate the single confirmation path for delete_project.',
      'Removed the duplicate delete_project confirmed parameter from the Orb tool contract and API spec so approved deletes no longer bounce back into another confirmation request.',
      'Orb Eval: Added deterministic regression cases for delete-project approval wording and confirmed delete_project execution.',
    ]
  },
  {
    version: 'v0.6.71',
    date: '2026-06-26',
    changes: [
      'Fixed project deletion loop: removed delete_project from the approval gate since the tool already has its own confirmed boolean guard, preventing a double-confirmation cycle.',
      'Fixed duplicate voice in voice mode: when TTS config loaded async, the first speech chunk fell through to browser speechSynthesis while later chunks used API AudioContext, producing two overlapping voices. Now waits for config before speaking.',
      'Voice mode: always unlocks both AudioContext and speechSynthesis on conversation start regardless of provider, so switching providers mid-session cannot leave audio locked.',
      'Voice settings: replaced circular slider thumb with a vertical fader bar.',
    ]
  },
  {
    version: 'v0.6.70',
    date: '2026-06-26',
    changes: [
      'Voice settings: Current voice selection now loads from the database on mount instead of localStorage only, so API TTS voices (OpenAI/ElevenLabs) display correctly.',
    ]
  },
  {
    version: 'v0.6.69',
    date: '2026-06-26',
    changes: [
      'Voice settings: Switched API TTS preview from HTMLAudioElement to AudioContext, matching Orb voice mode. Fixes barely audible OpenAI/ElevenLabs previews on iPhone.',
    ]
  },
  {
    version: 'v0.6.68',
    date: '2026-06-26',
    changes: [
      'Build gate: OPENAI_API_KEY and ELEVENLABS_API_KEY are now validated at build time — deploy fails if either is missing.',
    ]
  },
  {
    version: 'v0.6.67',
    date: '2026-06-26',
    changes: [
      'Voice mode: TTS errors now surface in the voice UI instead of failing silently. When API TTS fails (e.g. missing provider API key), the error message displays in red in the transcript area.',
    ]
  },
  {
    version: 'v0.6.66',
    date: '2026-06-26',
    changes: [
      'Voice mode rewrite: Collapsed 6 TTS code paths into a 3-layer architecture (Output, Speech Queue, Recognition) — 829→600 lines, single drain loop, single playChunk function for both browser and API TTS.',
      'Voice mode: Fixed iOS/iPadOS audio playback by routing API TTS through an unlocked AudioContext instead of HTMLMediaElement, and eliminated "Microphone access allowed" toasts by reusing a single SpeechRecognition instance per session.',
      'Voice mode: Added TTS chunk prefetching — next chunk fetches while current plays, reducing inter-sentence silence.',
      'Voice mode: Lightweight auth in synthesizeSpeech (single getUser call instead of full getAuthContext DB join), fire-and-forget usage recording.',
      'Non-admin access: Orb project switch now validates target exists in user accessible list (ORB-296). AI-related settings hidden from non-admins in sidebar (ORB-297). Voice preferences stored per-user in users table instead of shared admin policy (ORB-298).',
      'Dev login bypass: One-click login buttons for Stan, Otto Owner, and Adele Admin in development mode.',
      'AGENTS.md: Documented schema constraints (product_id not project_id, valid statuses, users table), eval npm scripts, and sandbox limitations.',
    ]
  },
  {
    version: 'v0.6.65',
    date: '2026-06-25',
    changes: [
      'Dev login bypass: Added one-click login buttons for Stan, Otto Owner, and Adele Admin on the login page in development mode, skipping email OTP entirely via server-side token generation.',
      'Closed ORB-294: AI settings and metrics cost reporting confirmed complete — estimated costs from tokens × rate cards, provider bill reconciliation, and rate cards all already in AI Metrics.',
    ]
  },
  {
    version: 'v0.6.64',
    date: '2026-06-25',
    changes: [
      'Voice mode: Passed the active TTS provider, model, and voice ID into Orb context so provider questions are answered from settings rather than guesses or release notes.',
      'Voice mode: Added conservative transcript-recovery guidance so fragmentary speech asks for clarification instead of filling in missing words from prior context.',
      'Voice mode: Added delayed spoken progress cues from actual streamed work labels, plus hard audio teardown so status cues, stopped audio, and final replies cannot overlap.',
      'Orb Eval: Added focused guards for active voice-provider reporting and garbled voice transcript clarification.',
    ]
  },
  {
    version: 'v0.6.63',
    date: '2026-06-25',
    changes: [
      'Voice mode: Removed the temporary pause-bars state from the Orb face; the transient post-stop state now uses the existing listening motif so the traffic-light model remains clear.',
    ]
  },
  {
    version: 'v0.6.62',
    date: '2026-06-25',
    changes: [
      'Voice mode: Stop now behaves like an escape key for hands-free conversation: it cancels Orb, clears orphaned streaming markers, avoids idle Thinking, and automatically returns to listening.',
      'Voice mode: Invalidated in-flight API TTS requests after Stop so late audio cannot restart while the microphone is already listening.',
      'Orb grounding: Strategic dependency claims now require explicit evidence; plausible sequencing judgments must stay labeled as judgment instead of becoming invented blockers.',
    ]
  },
  {
    version: 'v0.6.61',
    date: '2026-06-25',
    changes: [
      'Voice mode: Made Stop a hard stop for the current Orb response by preventing the auto-TTS effect from restarting speech for a message the user explicitly cancelled.',
    ]
  },
  {
    version: 'v0.6.60',
    date: '2026-06-25',
    changes: [
      'Dev channel: Paused dashboard polling after a dev-server Server Action ID refresh so stale browser bundles no longer repeat noisy poll failures until the next hard refresh.',
    ]
  },
  {
    version: 'v0.6.59',
    date: '2026-06-25',
    changes: [
      'Voice mode latency: Split API TTS playback into bounded speech chunks so long or lightly punctuated responses no longer wait on a single large synthesis request before continuing aloud.',
    ]
  },
  {
    version: 'v0.6.58',
    date: '2026-06-25',
    changes: [
      'Orb accuracy: Added deterministic active, parked, and closed count summaries to each project in the Orb context so project-health answers no longer rely on model arithmetic over task lists.',
      'Orb accuracy: Tightened count-answer instructions and aligned parked-task classification with the canonical status vocabulary.',
    ]
  },
  {
    version: 'v0.6.57',
    date: '2026-06-25',
    changes: [
      'Voice mode routing: Voice conversations now use the same intent router as typed conversations, so voice changes response style without automatically forcing the strategic/no-tools route.',
      'Orb Eval: Added a Tier 1 regression case proving ordinary voice-mode status questions remain on the operational route.',
    ]
  },
  {
    version: 'v0.6.56',
    date: '2026-06-25',
    changes: [
      'Orb conversation toolbar: Renamed the inline speech-to-text control from Voice to Dictate, with matching tooltip and accessible label updates.',
      'Help and UI catalog: Clarified that Dictate inserts spoken words into the text field, while full voice sessions start through More → Talk to Orb or the Orb itself.',
      'Voice mode: Prevented More-menu commands, including Talk to Orb, from accidentally submitting the chat form while activating voice mode.',
    ]
  },
  {
    version: 'v0.6.55',
    date: '2026-06-24',
    changes: [
      'Voice TTS: Added OpenAI and ElevenLabs as text-to-speech providers alongside the free browser engine, with full cost instrumentation through the existing model request ledger.',
      'AI Settings: New Voice (TTS) section — choose provider, model, and voice; costs are tracked and reported in AI Metrics automatically.',
      'TTS rate cards seeded: OpenAI tts-1 ($15/1M chars), tts-1-hd ($30/1M chars), ElevenLabs Turbo v2.5 ($66/1M chars).',
    ]
  },
  {
    version: 'v0.6.54',
    date: '2026-06-24',
    changes: [
      'Settings navigation: Renamed the embedded-assistant cluster to AI Memory, AI Metrics, and AI Settings so Orb is no longer overloaded as app name, ambient object, and assistant label.',
      'AI Metrics: Added a filter-driven app AI cost summary powered by the request ledger and configured rate cards, with explicit requested and actual row ranges.',
      'AI Metrics: Added date and model filters for tracked AI cost, included eval traffic as real AI spend, and exposed source breakdowns so day-to-day and evaluation costs remain distinguishable.',
      'AI Metrics: Moved rate-card editing out of AI Settings and reframed manual provider bill entries as optional reconciliation or external AI operating cost context.',
      'AI budget checks: Monthly and role allowances now use Orb’s app-specific request ledger estimates; manual provider bill entries no longer override live call limits.',
    ]
  },
  {
    version: 'v0.6.53',
    date: '2026-06-24',
    changes: [
      'Orb Eval: Kept the historical completion-claim regression case focused on mutation integrity rather than accidentally invoking the separate duplicate-search policy.',
    ]
  },
  {
    version: 'v0.6.52',
    date: '2026-06-24',
    changes: [
      'Orb AI: Fixed a failed-settings-load loop that could repeatedly retry a server action and flood the UI with the same error toast. Toast context is now stable across toast renders.',
    ]
  },
  {
    version: 'v0.6.51',
    date: '2026-06-24',
    changes: [
      'ORB-265: Added a deterministic one-model strategic-route gate, proving Claude Haiku can provide a tool-free strategic read when assigned to both roles.',
    ]
  },
  {
    version: 'v0.6.50',
    date: '2026-06-24',
    changes: [
      'Orb AI: Made Model Roles clearly interactive with established select styling and visible chevrons, and marked the live budget-stop behavior with the standard amber warning notice.',
    ]
  },
  {
    version: 'v0.6.49',
    date: '2026-06-24',
    changes: [
      'ORB-265: Enforced the configurable monthly, strategic, and operational AI allowances before a provider call. Evaluation traffic is excluded from budget accounting; reconciled provider costs override the global provider total when they cover the active period.',
      'ORB-265: Replaced the fixed two-model assumption with a capability catalog. A compatible model can now serve both strategic and operational roles, while future models appear only after their adapter, telemetry, and evaluation decision are in place.',
      'ORB-265: Replaced Anthropic-only billing alerts with deduplicated provider-and-role incidents. Strategic-provider failures preserve operational help, operational-provider failures preserve manual task management, and an open ticket suppresses repeated alert storms.',
      'Orb AI: Configured rate cards now apply to future request records and budget accounting; actual provider costs remain reconciled in Orb Metrics without rewriting history.',
    ]
  },
  {
    version: 'v0.6.48',
    date: '2026-06-24',
    changes: [
      'Orb Metrics: Actual Provider Cost now supports Mistral alongside Anthropic and Google, including saved-record labels and server-side validation.',
    ]
  },
  {
    version: 'v0.6.47',
    date: '2026-06-24',
    changes: [
      'ORB-265: Activated the administrator-controlled two-model route. Direct, non-mutating strategic reads can use Gemini with the same live backlog context but no tools; operational conversations, approvals, and all mutations remain on Claude Haiku.',
      'ORB-265: Added durable request-level route records for live Haiku conversations and Gemini strategic reads, including role, provider/model, token/cache usage, latency, estimated cost, and response text.',
      'ORB-265: Added Tier 1 route-gate coverage proving an explicit strategic read selects Gemini without tools while a create request remains on the Haiku operational route.',
      'Orb AI: Clarified that saved budgets and rate cards are configuration for the upcoming budget-enforcement phase; provider-reported actual costs continue to be reconciled in Orb Metrics.',
    ]
  },
  {
    version: 'v0.6.46',
    date: '2026-06-23',
    changes: [
      'Settings navigation: documented the Orb-related group so Orb Memory, Orb Metrics, and the forthcoming Orb AI page remain adjacent across sidebar and mobile navigation.',
    ]
  },
  {
    version: 'v0.6.45',
    date: '2026-06-23',
    changes: [
      'ORB-265: Added a dev-only Mistral strategic-evaluation adapter with normalized token, cache, latency, cost, and native tool-call records.',
      'ORB-265: Hardened the strategic runner with provider-busy retries, durable per-response checkpoints, named output packets, and safe resume behavior that preserves earlier evidence.',
      'ORB-265: Raised Mistral strategic reasoning output capacity to prevent reasoning tokens from exhausting the response before a final answer is emitted; operational evaluation remains tightly capped.',
    ]
  },
  {
    version: 'v0.6.44',
    date: '2026-06-23',
    changes: [
      'ORB-265: Added the frozen-packet exploratory runner. It executes the 30-response Haiku/Gemini matrix through the dev evaluator and writes a provider-blind review packet separate from private cost and latency metrics.',
    ]
  },
  {
    version: 'v0.6.43',
    date: '2026-06-23',
    changes: [
      'ORB-265: Strategic dev evaluation can now select a sanitized frozen context packet, which replaces live dynamic evidence and is recorded as strategic-packets-v1 in the request ledger.',
    ]
  },
  {
    version: 'v0.6.42',
    date: '2026-06-23',
    changes: [
      'ORB-265: Added five sanitized, versioned strategic context packets covering urgent choice, urgency versus momentum, stale work, preference-aware advice, and uncertainty without invention.',
    ]
  },
  {
    version: 'v0.6.41',
    date: '2026-06-23',
    changes: [
      'ORB-265: Added the dated five-scenario exploratory evaluation manifest, locking the Haiku reference, Gemini challenger, three-run comparison design, rubric, and $40 feasibility envelope before packet execution.',
    ]
  },
  {
    version: 'v0.6.40',
    date: '2026-06-23',
    changes: [
      'ORB-265: Set the model-evaluation feasibility envelope at a $40 total monthly Orb AI cap, 300 strategic interactions per month, and a provisional $0.08 per accepted strategic answer.',
    ]
  },
  {
    version: 'v0.6.39',
    date: '2026-06-23',
    changes: [
      'Knowledge Repository search matches: Replaced inline snippets with an amber match notice and field-level markers. Every matching field opens a centered, scrollable read-only value view that highlights all matches and offers only X or Close.',
    ]
  },
  {
    version: 'v0.6.38',
    date: '2026-06-23',
    changes: [
      'Knowledge Repository search matches: Added clear label/value spacing, limits dense Content matches to a three-line-scale context snippet around the result, and reliably opens long Titles from their first character.',
    ]
  },
  {
    version: 'v0.6.37',
    date: '2026-06-23',
    changes: [
      'Audit Log: Replaced its bespoke read-only detail modal with the shared EditorModal shell. Audit entries retain immediate close behavior while now sharing modal focus, Escape, overlay, and settings scroll-lock behavior with every other editor.',
    ]
  },
  {
    version: 'v0.6.36',
    date: '2026-06-23',
    changes: [
      'Knowledge Repository: Opening a text-search result now shows highlighted matching Title, Content, or Tags values above the editable form, while the Title input opens at its first character instead of its end.',
    ]
  },
  {
    version: 'v0.6.31',
    date: '2026-06-23',
    changes: [
      'ORB-269: Info-only pagination controllers now keep their natural single-row height beside taller action/search controllers, eliminating the empty lower panel when a collection has only one page.',
    ]
  },
  {
    version: 'v0.6.29',
    date: '2026-06-22',
    changes: [
      'ORB-290: Added a shared EditorModal and normalized dirty-form controller for editor-style modals. Save is disabled until a real edit, returns to disabled after a successful save, and Escape/backdrop/X request a consistent Save, Discard, or Keep Editing choice.',
      'ORB-290: Shift+Return now saves and closes editor-style settings and todo modals without intercepting an ordinary Return as the first keystroke in a field. Ticket editing now uses the same save/close lifecycle instead of a custom footer path.',
      'Projects: Clarified the project-code contract and now show invalid characters or over-length codes inline instead of silently stripping them; code changes use the project-specific authorization and uniqueness action.',
      'Orb Metrics: Added cache creation/read token tracking and model-aware cost estimates. Summary cards now use full filtered totals rather than only the visible paginated page.',
      'Database: Restored replay-safe Orb Metrics migration history, added an idempotent cache-token migration constraint update, and added the get_orb_metrics_summary RPC for compact filtered aggregates.',
      'Orb evaluation: successful Tier 1 runs now exit cleanly after reporting results instead of lingering on HTTP keep-alive handles.',
      'Orb task creation: Unqualified create requests now explicitly default to the selected project instead of asking the user to restate the scope before offering the approval prompt.',
    ]
  },
  {
    version: 'v0.6.28',
    date: '2026-06-21',
    changes: [
      'Typography: Bumped all navigation bar labels from fs-version (11px) to fs-base (15px) for legibility across all pages.',
      'iPhone dashboard: Split navigation into two bars — top bar centers Change Project, +Project, Menu, and Account; second bar pins Orb (left) and List (right) so the larger label text does not crowd them off-screen.',
      'UI catalog: Added Typography & Text Styling section documenting font families, size tokens with three-tier scaling, weights, text colors with contrast ratios, line height, letter spacing, opacity, and common text patterns.',
      'Orb Metrics: Added input/output token columns and sortable headers to the metrics table. Editable $/MTok rate fields for LLM cost estimation persist in localStorage. Fixed database RPC sort alias bug (om. → f.) and removed stale function overload.',
      'Closed ORB-251 (voice conversation mode) with resolution notes and knowledge repo entry.',
    ]
  },
  {
    version: 'v0.6.27',
    date: '2026-06-21',
    changes: [
      'Orb approvals: Extended deterministic confirmed-approval execution to pending creates, updates, deletes, and moves, so an affirmative response runs the approved operation rather than relying on model interpretation.',
    ]
  },
  {
    version: 'v0.6.26',
    date: '2026-06-21',
    changes: [
      'Orb approvals: Confirmed task-code updates now force the already-approved `update_todo` tool for that turn, preventing Haiku from substituting a lookup.',
    ]
  },
  {
    version: 'v0.6.25',
    date: '2026-06-21',
    changes: [
      'Orb approvals: Propagate the pending task code into confirmed-approval instructions, making approved todo updates execute directly instead of detouring through a lookup.',
    ]
  },
  {
    version: 'v0.6.24',
    date: '2026-06-21',
    changes: [
      'Orb mutation integrity: Treat task codes named in the current user request as known to the structural guard, preventing false mutation corrections during ordinary task discussion.',
      'Orb approvals: A confirmed approval now explicitly directs the model to execute the pending mutation rather than performing a redundant lookup or requesting approval again.',
    ]
  },
  {
    version: 'v0.6.23',
    date: '2026-06-21',
    changes: [
      'Orb evaluation: corrected eval-runner pacing so the delay applies between every case, not only Tier 2 repeats, keeping full Tier 1 runs inside the endpoint rate limit.',
    ]
  },
  {
    version: 'v0.6.22',
    date: '2026-06-21',
    changes: [
      'Orb evaluation: paced the local eval runner to respect the conversation endpoint\'s 10-calls-per-minute safety limit, preventing false regression failures caused by rate limiting.',
    ]
  },
  {
    version: 'v0.6.21',
    date: '2026-06-20',
    changes: [
      'Audit Log mobile cards: Added a touch-friendly Sort menu with Date, Table, Action, and Actor ordering choices, using the same indexed server sorting as desktop headers.',
      'Audit Log mobile search: Cards now show an expanded, highlighted Matches section for every matching field, including complete Before and After record context.',
    ]
  },
  {
    version: 'v0.6.20',
    date: '2026-06-20',
    changes: [
      'Settings modals: Strengthened modal scroll locking to block both document and settings-surface scrolling while a modal is open.',
      'Audit Log: Restored immediate full entry detail and exact Rows X–Y of Z counts while retaining cursor paging for fast page retrieval.',
      'Audit Log: Added indexed Table, Action, and Actor sort paths, plus an independently loaded exact count so sorting and totals remain available without a count window in the page query.',
    ]
  },
  {
    version: 'v0.6.19',
    date: '2026-06-20',
    changes: [
      'Settings modals: Kept the centered editing model and added shared settings-scroll locking so the page cannot move underneath an open edit, detail, text-search, or date-search modal.',
      'Audit Log: Replaced count-heavy offset paging with cursor pagination, avoiding full-dataset counting during browsing and keeping older/newer navigation fast as the log grows.',
      'Audit Log: Table browsing now returns compact Before/After previews; full JSON and environment detail load only when an entry is opened.',
    ]
  },
  {
    version: 'v0.6.18',
    date: '2026-06-20',
    changes: [
      'Cost reduction: Switched the Orb\'s conversational AI model from Claude Sonnet 4.5 to Claude Haiku 4.5 — 5x cheaper on input tokens ($1 vs $5/MTok) and 3x cheaper on output ($5 vs $15/MTok). All three model references updated: main conversation, task distillation, and ambient opening.',
      'Orb Metrics: New admin-only Settings page tracking daily Orb usage — call count, speech characters, voice characters, input characters, tool calls, and ambient greeting characters. Searchable by user and filterable by date range. Summary cards show totals for the selected range with estimated TTS API costs at multiple provider price points.',
      'Prompt hardening: Explicit duplicate-search-first rule in query routing (Orb must search before asking about duplicates). Voice exit instruction strengthened for smaller models.',
    ]
  },
  {
    version: 'v0.6.17',
    date: '2026-06-19',
    changes: [
      'ORB-251: Streaming TTS — Orb now starts speaking the first complete sentence while the LLM is still generating, instead of waiting for the full response. Dramatically reduces time from end-of-speech to first audible response.',
      'ORB-251: Faster turn detection — silence timeout reduced from 2 seconds to 1.2 seconds for snappier conversation turns.',
      'ORB-251: Live interim transcripts — partial speech recognition results now display in real time as you speak, instead of waiting for each phrase to finalize.',
      'ORB-251: Prompt caching — stable system prompt blocks are now cached with Anthropic\'s ephemeral cache, reducing time-to-first-token on repeated voice turns within the same session.',
    ]
  },
  {
    version: 'v0.6.16',
    date: '2026-06-18',
    changes: [
      'ORB-251: Voice conversation with the Orb. Tap the ambient Orb to start a voice conversation — speak naturally, and the Orb responds aloud via text-to-speech. Tap again to stop recording and send. Double-tap to interrupt the Orb mid-speech.',
      'ORB-251: New Orb visual states for voice mode — teal/cyan glow while listening, warm gold glow while speaking, with a subtle voice-mode ring around the Orb sphere.',
      'ORB-251: Text input and toolbar are disabled during voice exchanges; a "Switch to text" button provides an exit path.',
      'ORB-251: Voice Settings page — choose preferred TTS voice from available system voices, adjust speech rate, preview voices with a sample phrase.',
      'ORB-251: Conversational voice control — ask the Orb "what voices do you have?" for a rundown, or "switch to Daniel" to change voices mid-conversation. Say "that\'s enough" or "let\'s stop" to exit voice mode.',
      'ORB-251: Keyboard shortcuts — Cmd+Space toggles voice listening, Cmd+Space+Space interrupts TTS.',
      'Removed tap-to-add-project behavior on the Orb — that action lives in the navigation bar.',
    ]
  },
  {
    version: 'v0.6.15',
    date: '2026-06-18',
    changes: [
      'ORB-270: Added catalog rules for responsive collections: tables remain for Mac/wide iPad scanning, while iPhone and narrow/coarse-pointer iPad render structured collections as stacked cards by default.',
      'ORB-270: Added default mobile card rendering to SettingsCrudList so table-based settings pages get a shared card presentation without one-off renderers.',
      'ORB-270: Preserved shared collection behavior across card mode, including text/date search highlighting, pagination, and explicit Select mode for bulk selection.',
      'ORB-270: Documented mobile navigation direction: large navigation sets such as Settings should move to sheet/list pickers, and Kanban should use one lane at a time on narrow touch layouts.',
      'DEV panel: Restored global development controls beyond Tables on non-dashboard routes by moving connectivity/update simulation into the global panel and clarifying when dashboard-only Orb tools are unavailable.',
      'DEV panel: Added a Move panel control with four safe-area-aware fixed positions so the DEV launcher can get out of the way of covered action buttons on iPhone.',
      'DEV panel: Restored original post-page layer order and added touch scroll containment so interacting with the fixed DEV panel does not drag the page underneath on iPhone.',
      'Settings navigation: Replaced the iPhone/narrow-touch horizontal settings strip with a compact icon + down-arrow + version trigger that opens a vertical section menu and preserves unsaved-change confirmation.',
      'Settings navigation: Added an explicit mobile menu header and close button so it is clear the icon trigger opens more settings and how to dismiss the menu.',
      'Cards: Added the missing shared medium radius token used by card components so card corners render rounded consistently.',
      'Settings navigation: Applied the strict circular button geometry contract to the mobile settings menu close button so it stays round in iOS Safari.',
    ]
  },
  {
    version: 'v0.6.8',
    date: '2026-06-18',
    changes: [
      'ORB-288: Replaced regex-based mutation guard with structural tool-output checks. The guard no longer analyzes user input — it checks whether the response cites task codes that no tool produced (phantom codes) or claims completion when no mutation tool ran.',
      'ORB-288: Fixed confirmation loop where approval prompts containing task codes (e.g., "I\'ll update ORB-288. Go ahead?") were rejected by the completion detector, preventing users from confirming mutations.',
      'ORB-288: Removed looksLikeMutationRequest entirely — eliminates false positives from conversational verbs like "make", "change", "save" in reflective discussion.',
      'Dev channel gated to admin-only — non-admin users no longer poll for or see developer tool messages.',
      'Settings CrudList: add/invite button moved into toolbar next to search, changed from btn-outline to btn-primary for consistency.',
      'Invitation email copy simplified; admin notification emails are now pure notifications with no button link.',
    ]
  },
  {
    version: 'v0.6.7',
    date: '2026-06-18',
    changes: [
      'ORB-240: Redesigned guided tour — 8 steps leading with the Orb\'s strategic value (chief of staff, pattern recognition, adaptive learning) alongside practical navigation.',
      'ORB-240: Welcome flow changed from in-conversation nudge to a centered modal with "Yes, show me around" / "Maybe later" buttons, personalized with the user\'s first name.',
      'ORB-240: Fixed tour launch from Help — poll-based wait for dashboard mount replaces unreliable 200ms timeout.',
      'ORB-289: Graduated from pre-alpha to alpha — all user-facing copy and defaults updated.',
      'Settings: CrudList add button moved into toolbar next to search and changed from btn-outline to btn-primary for consistency.',
      'Email: Invitation copy simplified (removed PWA install instructions). Admin notification emails are now pure notifications with no button link.',
      'Email: Dev/prod URL detection added to invitation emails so links point back to the sending environment.',
      'User cleanup: deleteUser now removes orb_memory, orb_preferences, orb_adaptations, and push_subscriptions. Invitation deletion now logs to audit.',
    ]
  },
  {
    version: 'v0.6.6',
    date: '2026-06-18',
    changes: [
      'ORB-266: Added server-side mutation approval enforcement so create/update/delete/move/project mutations are held for confirmation when mutation_approval is ask, rather than relying on prompt compliance alone.',
      'ORB-266: Added a no-tool false-success guard so Orb cannot claim a mutation completed or cite a new task code unless a mutation actually succeeded in the current request.',
      'ORB-266: Added structured insight streaming and conversation rendering for proactive guidance, with header-strip labels for Observation, Coaching read, and Strategic read.',
      'ORB-266: Added user-approved self-adaptation proposals, including persistent active adaptations, signed approval/rejection email links, and audit logging.',
      'ORB-266: Expanded strategic/coaching prompt behavior, proactive observations, mutation follow-through rules, and developer-channel explicit-send behavior.',
      'Eval coverage: Added mutationApproval ask-mode support to the Orb eval endpoint and Tier 1 cases for false-success history and approved mutation follow-through. Full Tier 1 passed 12/12.',
      'Created ORB-287 to track dashboard background polling overhead observed during testing.',
    ]
  },
  {
    version: 'v0.6.5',
    date: '2026-06-17',
    changes: [
      'Standardized all CrudList settings tables (Orb Memory, Projects, Users, Tickets, Knowledge Repository) to match the Audit Log\'s canonical search pattern: green btn-primary search buttons opening modal dialogs instead of inline search inputs.',
      'Extracted TextSearchModal and DateSearchModal as shared reusable components from Audit Log, eliminating ~250 lines of duplicated modal code.',
      'Added server-side pagination to Projects, Users, and Tickets tables. Pagination controls auto-hide when all items fit on one page.',
      'Tickets scope filter (Active/Open/Closed/etc.) now works server-side, enabling correct behavior with paginated results.',
      'All table subtitles now show row-range format: "Rows X–Y of Z." for consistency.',
      'Added date search capability to Orb Memory and Tickets tables.',
      'Added text search capability to Users table (previously had no search).',
    ]
  },
  {
    version: 'v0.6.4',
    date: '2026-06-17',
    changes: [
      'Settings table geometry: Shared CrudList now uses exact pixel-width math only when all configured columns are pixel widths, keeping toolbar, Prev/Next Columns controls, table frame, and pagination aligned to the rightmost cell.',
      'Converted Projects, Users, Invitations, Knowledge Repository, and Tickets settings tables from percentage column widths to explicit pixel widths so they participate in the same stable geometry model as Audit Log and Orb Memory.',
      'Removed the temporary Orb Memory table prototype after folding its successful width contract into the shared SettingsCrudList path.',
    ]
  },
  {
    version: 'v0.6.1',
    date: '2026-06-17',
    changes: [
      'Cross-session memory: The Orb now remembers work patterns, rhythms, and preferences across sessions. Two tracks — autonomous (Orb observes silently) and offered (user confirms before saving).',
      'Memory management UI at Settings > Orb Memory — view, edit, search, and delete all memories. Bulk delete supported.',
      'Voice personality with adjustable openness: one personality at three volumes — reserved (facts only), natural (default, personality present), open (humor, metaphors, emotional reads). Set via Orb preferences.',
      'New preference keys: openness (reserved/natural/open) and memory_level (off/session/full).',
      'New Orb tools: save_memory and recall_memories for cross-session memory persistence.',
      'Added hideAdd prop to SettingsCrudList for tables where only edit/delete is appropriate.',
    ]
  },
  {
    version: 'v0.6.0',
    date: '2026-06-16',
    changes: [
      'Converted audit log text search from inline field to a modal with Enter-key-submits pattern, matching the date search interaction.',
      'Redesigned audit toolbar as three primary buttons: Search by Text, Search by Date, and Reset.',
      'Subtitle now shows precise row ranges: "Rows N–M of P."',
      'Date search modal Apply button replaced with circular send button for visual consistency.',
      'Both search modals use <form onSubmit> for native Enter-key submission — a reusable pattern for future modals.',
      'Added externalSearchTerm config prop to CrudList, enabling parent-managed search state with CrudList handling the server request lifecycle.',
      'Fixed scroll navigation arrows permanently failing to detect table overflow — root cause was useEffect measuring layout before browser paint; wrapped all geometry reads in requestAnimationFrame.',
      'Restored table card borders and rounded corners after CSS containment experiments.',
      'All toolbar buttons now render as btn-primary (green) regardless of filter state.',
      'Version label now visible at the end of the horizontal settings nav on iPhone, where the sidebar is hidden.',
    ]
  },
  {
    version: 'v0.5.234',
    date: '2026-06-16',
    changes: [
      'Moved Search by Date button inline next to the Reset button for a tighter toolbar layout.',
      'Date range labels now show mm/dd/yy only (removed time component) for a cleaner, more compact display.',
      'Added en-dash separator between stacked date range labels.',
      'Fixed scroll navigation arrows not detecting table overflow after toolbar layout changes.',
    ]
  },
  {
    version: 'v0.5.233',
    date: '2026-06-16',
    changes: [
      'Audit Log search now requires explicit submit (Enter key or send button) instead of firing on every keystroke, dramatically reducing server calls.',
      'Text search and date filter work simultaneously — removed the Search by... mode switcher that forced choosing one or the other.',
      'Added a Reset button that clears all active filters (text and date) in one click.',
      'Removed frozen columns from the Audit Log table for a cleaner scrolling experience.',
      'Fixed horizontal scroll navigation arrows not detecting table overflow on the Audit Log page.',
      'Refactored CrudList data loading to use a stable load function with a single request key, eliminating cascading reloads from state changes.',
      'Corrected Orb send button tooltip from "Send (Shift+Enter)" to "Send (Enter)".',
    ]
  },
  {
    version: 'v0.5.232',
    date: '2026-06-14',
    changes: [
      'Added a development-only Table Tuning mode available to every rendered table, so column widths can be set visually by dragging instead of reasoning about pixel values.',
      'Added spreadsheet-style Freeze through and Unfreeze controls, local draft persistence, a visible frozen-column divider, and configuration export with viewport and scroll measurements.',
      'Table Tuning now detects Mac, iPad, and iPhone and stores independent width and frozen-column presets for each platform.',
      'Applied the approved Audit Log Mac table preset: 38/128/140/140/79/140/140/140/140px with no frozen columns on Mac.',
      'Standardized circular navigation controls with strict 44×44 bounds that remain circular in iOS Safari, plus clear hover and pressed feedback.',
      'Moved Audit Log Created filtering beside text search with explicit captions for text-field search and create-date search, and removed the duplicate timezone helper text from the toolbar.',
      'Added a compact standard green Search by... dropdown for Audit Log: Text fields mode shows only the text field, while Created date mode hides and clears text search, shows the Created filter button, and opens the date filter modal.',
      'Moved the Audit Log User column to the first data position and made it the single frozen data column on every platform.',
      'Moved table column navigation to the far right of the table toolbar as a borderless prev/next columns group with compact 40px circular arrow buttons and tooltips; pagination controls continue using the shared circular pattern.',
      'Restyled the New Task create modal to use the canonical centered modal system with clearer labels, grouped metadata, and a calmer footer.',
      'Polished the Audit Log Created date-time filter modal with canonical body padding, top-right close alignment, and clearer local-time copy.',
      'Strengthened the UI catalog and agent instructions with a Lego-style assembly protocol: pick the catalog family, inspect a canonical implementation, reuse the structure, ask when multiple patterns fit, and ask whether to add a missing catalog pattern before creating one.',
      'Audit text search now covers Table, Action, historical User identity, Actor, Record, Before, and After through a maintained trigram index and database search function, with no hidden result caps, literal punctuation handling, and accurate pagination counts.',
      'Added a dedicated timezone-aware Created filter with On, At or before, At or after, and Between conditions. Timestamps display in the browser timezone, while audit details retain canonical UTC.',
      'Audit entries now snapshot user name and email at event time, preserving historical identity when a user later changes either value.',
      'Audit loading failures now remain visible errors instead of being mistaken for empty search results.',
    ]
  },
  {
    version: 'v0.5.231',
    date: '2026-06-14',
    changes: [
      'ORB-256: Export conversation as markdown — downloads a .md file with speaker headings and thoughts as blockquotes. Uses native save dialog on Chrome/Edge, standard download on Safari.',
      'Renamed existing clipboard "Export" to "Copy" in the More menu to distinguish from the new file export.',
    ]
  },
  {
    version: 'v0.5.230',
    date: '2026-06-14',
    changes: [
      'Added Passkeys section to Help page — how they work, managing them, and troubleshooting stale browser credentials.',
      'Split Learn More passkey dialog into two paragraphs for readability.',
      'Fix: dismissing the passkey registration prompt no longer shows an error.',
    ]
  },
  {
    version: 'v0.5.229',
    date: '2026-06-14',
    changes: [
      'Fix: dismissing the passkey registration prompt no longer shows an error — NotAllowedError is now treated as a silent cancellation.',
    ]
  },
  {
    version: 'v0.5.228',
    date: '2026-06-14',
    changes: [
      'Account page polish: split Name, Email, and Passkeys into separate cards. Sign Out button on Account header line with green outlined styling.',
      'Modal consistency: Change Name and Learn More dialogs now match Change Email padding and structure exactly.',
      'Mural opacity: added semi-opaque backdrop to account page so mural bleeds through subtly on iPad and iPhone.',
      'Increased global border prominence (0.15 → 0.25) for better card definition.',
    ]
  },
  {
    version: 'v0.5.227',
    date: '2026-06-14',
    changes: [
      'ORB-263: Redesigned Account details as clear Name and Email rows with matching Change name and Change email dialogs, removing the ambiguous always-visible fields and Save button.',
      'Moved Sign Out beside the Account heading and added the calm mural background to the page.',
      'Replaced the passkey explanation card with a Learn more button and focused explanation dialog; passkey actions now adapt cleanly across desktop, iPad, and iPhone.',
    ]
  },
  {
    version: 'v0.5.226',
    date: '2026-06-14',
    changes: [
      'Developer-channel messages now appear promptly as blue conversation cards through a dedicated visible-tab poll, without using Supabase Realtime.',
      'The channel checks on mount, window focus, visibility return, BFCache restore, and every 15 seconds while visible; the existing in-flight guard prevents duplicate processing.',
    ]
  },
  {
    version: 'v0.5.225',
    date: '2026-06-14',
    changes: [
      'ORB-247: Prevented overlapping Orb submissions from prematurely hiding the processing indicator, re-enabling input, or replacing the red Stop button while a request is still running.',
      'Orb conversation stop and completion state is now scoped to each request, so a stopped stream cannot interfere with a newer request while it finishes unwinding.',
    ]
  },
  {
    version: 'v0.5.224',
    date: '2026-06-13',
    changes: [
      'ORB-262: Simplified email change flow — no sign-out or OTP needed. Session refreshes in place and user is taken directly to passkey registration.',
      'ORB-262: Setup-passkey page shows contextual messaging when arriving from an email change.',
    ]
  },
  {
    version: 'v0.5.223',
    date: '2026-06-13',
    changes: [
      'ORB-262: Instant email change via admin API — no confirmation email, passkeys deleted server-side, users/invitations synced automatically.',
      'ORB-262: Simplified email change modal — calls server action, signs out, redirects to guided passkey re-registration.',
      'Fixed Supabase MFA deleteFactor param name (factorId → id) in email change and auth callback.',
    ]
  },
  {
    version: 'v0.5.222',
    date: '2026-06-13',
    changes: [
      'ORB-262: Migrated passkey management from Settings to the Account page — passkeys belong to the user, not the system.',
      'ORB-262: Email change modal — guided flow with validation, current email displayed read-only, passkeys auto-deleted on change, user guided through full re-registration.',
      'ORB-262: Added "Account" page title.',
      'ORB-260: Split compound Data page into separate Backup and Archive sidebar entries — each page does one thing.',
      'ORB-260: Removed breadcrumb system (SettingsTopbar, Breadcrumbs, BreadcrumbOverridesProvider) — sidebar is now the sole Settings navigation.',
      'ORB-260: Added inline back links on admin detail sub-pages (user detail, project todos).',
    ]
  },
  {
    version: 'v0.5.219',
    date: '2026-06-13',
    changes: [
      'ORB-261: Passkey delete now signs user out and redirects to an explanation page, preventing stale browser credentials from causing confusion.',
      'ORB-261: Dedicated email-only re-registration login page — no passkey button, no conditional mediation, clear context that this is part of passkey re-registration.',
      'ORB-261: Email is pre-filled through the entire re-registration flow (delete → removed page → email login).',
      'ORB-261: Passkey delete UI uses warning (amber) styling instead of danger (red) for buttons and explanatory text.',
      'ORB-261: Fixed last-passkey delete warning to explain re-registration path instead of implying email-only forever.',
      'Removed 30-second polling from SystemStateProvider — health and version checks now only fire on mount, tab focus, visibility change, and online events.',
      'Added 60-second in-memory cache to /api/version route to reduce redundant Supabase queries.',
    ]
  },
  {
    version: 'v0.5.215',
    date: '2026-06-12',
    changes: [
      'ORB-258: Removed fixed-position version label from all pages; version now lives only in the Settings sidebar.',
      'ORB-259: Unified topbar — every page now uses the same AppNav component with a consistent Menu (Settings, Help, Print) and "Dashboard" back link.',
      'Menu items are grayed out on the page you are currently viewing.',
      'Deleted dead code: UnifiedView.tsx and AmbientDashboard.tsx (neither was routed).',
      'Orb toolbar More menu now anchors correctly on all platforms (left on iPhone, right on desktop/iPad).',
    ]
  },
  {
    version: 'v0.5.214',
    date: '2026-06-12',
    changes: [
      'ORB-248: Prev and Next input history buttons are now inline on the Orb toolbar on desktop and iPad, reducing two taps to one for high-frequency navigation.',
      'Prev and Next remain behind More on iPhone where horizontal space is constrained.',
      'AppNav top bar: replaced the "More" grid icon with a gear icon and "Menu" label to distinguish it from the Orb toolbar More button.',
    ]
  },
  {
    version: 'v0.5.213',
    date: '2026-06-12',
    changes: [
      'ORB-249: Bumped all settings table text from --fs-xs to --fs-sm so table content matches the rest of the app.',
      'Mobile card titles bumped from --fs-sm to --fs-base; card code, date, and meta bumped from --fs-xs to --fs-sm.',
    ]
  },
  {
    version: 'v0.5.212',
    date: '2026-06-12',
    changes: [
      'Orb now distinguishes unknown facts from ambiguous visual referents instead of searching source code to guess which repeated control a user means.',
      'Under-specified UI references such as "the kebab", "that button", or "this menu" trigger one concise location-based clarification before repository inspection.',
      'Added a behavioral eval requiring the ambiguous List-pane kebab question to ask which control the user means without calling a tool.',
    ]
  },
  {
    version: 'v0.5.211',
    date: '2026-06-12',
    changes: [
      'Fixed intermittent Orb conversations remaining visually stuck on Processing after a stream or tool loop ended.',
      'The Stop control now remains available whenever any Orb response is still marked as streaming, even if parent submission state has already cleared.',
      'Stop and final cleanup now settle orphaned streaming messages across both dashboard variants.',
      'Conversational model turns time out after 60 seconds, repository production requests after 15 seconds, and exhausted tool loops return an explicit retry message instead of ending silently.',
    ]
  },
  {
    version: 'v0.5.210',
    date: '2026-06-12',
    changes: [
      'ORB-252: Orb can inspect allowlisted source files with list, search, and ranged read operations.',
      'Localhost Orb can inspect both the live working tree and the source bundled with the current Vercel production deployment; production Orb reads its current deployed bundle.',
      'Repository inspection is restricted to Admin, Super Admin, and the new Developer role without granting Developer access to admin-only settings or data.',
      'Repository paths, file types, file sizes, and result sizes are constrained to prevent traversal, configuration/secret reads, and oversized responses.',
    ]
  },
  {
    version: 'v0.5.209',
    date: '2026-06-12',
    changes: [
      'ORB-255: Knowledge Repository filtering now searches the full dataset before pagination, including title, content, project, and tags.',
      'Audit Log now has global filtering by table, action, actor, or full record ID.',
      'Sortable columns on both paginated pages now sort the complete result set instead of only the visible page.',
      'Search is debounced, filtered counts are accurate, criteria changes return to page one, and stale responses cannot replace newer results.',
    ]
  },
  {
    version: 'v0.5.208',
    date: '2026-06-12',
    changes: [
      'ORB-246: Fixed markdown tables not rendering in Orb conversation view — added remark-gfm plugin to react-markdown.',
      'Added table styles for Orb messages: collapsed borders, header background, alternating row stripes.',
      'GFM extensions now active: tables, strikethrough, autolinks, and task list checkboxes.',
    ]
  },
  {
    version: 'v0.5.207',
    date: '2026-06-12',
    changes: [
      'ORB-244: Removed Priorities, Statuses, and Platforms from the settings menu — these are not user-changeable.',
      'Removed the Platforms pill selector from the todo edit panel and new todo form.',
      'Deleted SettingsPriorities, SettingsStatuses, SettingsPlatforms components and their page routes.',
    ]
  },
  {
    version: 'v0.5.206',
    date: '2026-06-12',
    changes: [
      'ORB-243: Aligned all touch-tier font sizes with the phone tier so iPad and iPhone render identically — --fs-version 13px, --fs-xs 14px, --fs-sm 17px, --fs-base 16px, --fs-input 17px, --fs-lg 20px, --fs-xl 24px.',
    ]
  },
  {
    version: 'v0.5.204',
    date: '2026-06-12',
    changes: [
      'ORB-238: Simplified the Orb conversation command toolbar so Mac, iPad, and iPhone all use the same compact More overflow model for secondary actions.',
      'Removed the viewport-specific desktop inline command group from the Orb input toolbar, leaving Cmds, Voice, Send/Stop, and More as the consistent command surface.',
    ]
  },
  {
    version: 'v0.5.203',
    date: '2026-06-11',
    changes: [
      'Build fix: Corrected FilterKebab event typing so React keyboard events and document-level DOM KeyboardEvent handlers no longer conflict during production type checking.',
    ]
  },
  {
    version: 'v0.5.202',
    date: '2026-06-11',
    changes: [
      'Accessibility hardening (ORB-239): Added named dialog semantics to the project switcher, Commands modal, Distill Knowledge modal, Settings CRUD modal, and Audit Entry modal.',
      'Form accessibility: Associated visible labels with previously weakly-named form controls in query results editing, category settings, and generic settings filters.',
      'Destructive actions: Added descriptive confirmation text wiring for todo delete, bulk todo delete, query-result delete, and settings delete confirmation flows.',
      'Filter keyboard behavior: Updated FilterKebab to use a menu/menuitemradio pattern with Arrow, Home, End, Escape, Enter, and Space keyboard support.',
    ]
  },
  {
    version: 'v0.5.201',
    date: '2026-06-11',
    changes: [
      'Interaction polish pass (ORB-196): Replaced bare loading text with animated SkeletonRows across main dashboard views and settings screens.',
      'Empty states: Added Orb-illustrated empty states to task views and query results so blank screens feel intentional.',
      'Filter presentation: Replaced native status/priority filter selects in UnifiedDashboard and TodoView with styled FilterKebab menus and close controls.',
      'Modal conformity: Standardized modal footers around btn-cancel, btn-primary, and btn-danger patterns.',
      'Copy cleanup: Standardized user-facing language to "Ask Orb" and added a clearer SearchModal header with close control.',
      'Resize handle visibility (ORB-241): Made the split-pane divider easier to discover, added active drag feedback, separator semantics, and a 40px coarse-pointer gutter for touch devices.',
      'Project switcher clarity (ORB-242): Renamed the top command bar "Search" action to "Change Project", updated its icon, and changed the project-switcher dialog title to "Change Project".',
    ]
  },
  {
    version: 'v0.5.193',
    date: '2026-06-10',
    changes: [
      'Unified toolbar (ORB-196): Merged AppNav + CommandBar two-bar chrome (~92px) into a single unified toolbar (~48px). Same layout on all screens — no desktop/mobile split.',
      'Toolbar layout: [Orb] ··· [Search][+Project] | [More][Account] ··· [List]. Spacers maintain balanced positioning at all viewport widths.',
      'Search modal: New reusable SearchModal component — auto-focus, keyboard navigation (↑↓ Enter Esc), filtered results, frosted overlay with slide-in animation.',
      'Orb/List edge buttons: Accent-colored paired toggles. Desktop labels show "Show"/"Hide" based on pane state. Mobile: grayed when current tab, active when tappable.',
      'Commands modal: Print, Help, and Settings grouped under More button. Account is standalone.',
      'Modal footer fix: Added gap between Cancel and Create buttons to prevent overlap on narrow viewports.',
    ]
  },
  {
    version: 'v0.5.192',
    date: '2026-06-10',
    changes: [
      'Text-a-Palooza (ORB-237): Complete CSS variable uniformity sweep across 40 files.',
      'Font sizes: All 51 hardcoded pixel sizes in globals.css + ~80 inline component sizes replaced with --fs-* variables. Three-tier responsive scaling: desktop, tablet (touch), phone.',
      'Font weights: Added --fw-light (300), --fw-semibold (600). Replaced ~115 hardcoded weights across CSS and components with --fw-* variables.',
      'Font families: Defined --font-mono variable. Replaced all bare "monospace" references (7 CSS + 13 components) with var(--font-mono).',
      'Line height: Added --lh-none (1) through --lh-loose (1.8). Replaced ~48 hardcoded values across CSS and components.',
      'Letter spacing: Added --ls-tight (-0.02em) through --ls-widest (0.12em). Replaced ~40 hardcoded values across CSS and components.',
      'Opacity: Added --opacity-disabled (0.7) and --opacity-muted (0.55). Normalized all 11 disabled states (previously ranging 0.3–0.7) to a uniform 0.7. Replaced ~27 hardcoded values.',
      'Tablet touch tier: iPad now gets intermediate font bumps via @media (hover: none) and (pointer: coarse) — was previously getting desktop-only sizes.',
      'Broadcast localStorage cleanup: Stale broadcast_dismissed_* keys purged when broadcast changes.',
    ]
  },
  {
    version: 'v0.5.191',
    date: '2026-06-10',
    changes: [
      'Fix mobile More kebab dropdown (ORB-236): matched Cmds button pattern — onMouseDown preventDefault + onClick with textarea refocus. Stripped failed workarounds (handleTouchOrClick, onTouchStart, document listeners, delayed blur).',
      'More menu beautified: green-bordered box matching slash menu style, group headers (Input/Transcript), label + description per item, monospace labels, 0.7 disabled opacity.',
    ]
  },
  {
    version: 'v0.5.190',
    date: '2026-06-10',
    changes: [
      'Attempted fix for mobile More kebab: replaced backdrop with document-level click-outside hook. Did not resolve the issue.',
    ]
  },
  {
    version: 'v0.5.189',
    date: '2026-06-09',
    changes: [
      'Attempted fix for mobile More kebab: delayed blur handling and handleTouchOrClick utility. Did not resolve the issue.',
    ]
  },
  {
    version: 'v0.5.188',
    date: '2026-06-09',
    changes: [
      'Broadcast message types: info (green), warning (amber), urgent (red). Full-color solid banners with white text, replacing translucent style.',
      'Broadcast admin UI: Styled toggle buttons for type selection, Enter-to-send, delete-based clear (fixes previous upsert-null failure).',
      'Help converted from modal overlay to /help route. Inherits root layout banners automatically. Back button uses router.back().',
      'Mobile toolbar declutter (ORB-235): Cmds + Voice + Send/Stop always visible. Secondary actions (Prev, Next, Copy, Log, Clear) in a More kebab overflow menu on touch devices.',
      'Orb input border permanently visible (opacity 0.28 → 0.55). Placeholder changed to "Type / or ask the Orb anything...".',
      'Body flex column layout: banners stack above pages naturally. dash-main and sl-page use flex:1 instead of height:100dvh.',
      'Broadcast banner font size corrected to var(--fs-sm). Word wrap enabled (removed nowrap/overflow clipping).',
      'Known issue: More kebab button does not activate on iPhone/iPad — handed off to Antigravity (WIP.md).',
    ]
  },
  {
    version: 'v0.5.187',
    date: '2026-06-09',
    changes: [
      'Broadcast messages: Admin can send a banner message visible to all users from Settings > Maintenance. Users can dismiss individually; new broadcasts reset dismissal.',
      'BroadcastBanner component: Blue-tinted strip below maintenance banner, dismiss persisted in localStorage keyed by broadcast ID.',
      'API billing error handling: Added "usage limits" detection to Orb error handler. Friendly user message + urgent admin email with specific reason and Anthropic console link.',
      'Send/stop button restyle: oc-action-circle base class (32×32 circular), oc-send-btn (green), oc-stop-btn (red). iOS Safari deformation fix with explicit dimension constraints.',
      'Exported getResend and ICON_URL from lib/email.ts for reuse in orb-converse.ts urgent email.',
    ]
  },
  {
    version: 'v0.5.186',
    date: '2026-06-09',
    changes: [
      'Button-paloza (ORB-235): Audited all buttons across the app and brought non-conforming ones into conformity with established CSS classes.',
      'DashboardProducts: Replaced all Tailwind utility button classes (bg-zinc, text-red, hover:text-zinc) with standard btn-primary, btn-cancel, btn-outline, btn-danger-confirm, btn-row-action classes.',
      'PrintModal: Replaced inline-styled buttons and phantom pf-btn-secondary class with btn-cancel and btn-primary. Footer uses modal-footer pattern.',
      'DeclineForm: Replaced fully inline-styled decline button with auth-submit class.',
      'MaintenanceBanner & UpdateBanner: Replaced inline-styled banner buttons (with JS hover handlers) with new btn-banner CSS class. Warning variant: btn-banner--warning.',
      'SettingsPasskeys: Removed inline fontSize/padding overrides, using btn-sm modifier. Delete button now uses btn-danger-confirm instead of btn-cancel with inline color override.',
      'SettingsTickets: Removed inline size overrides on mobile card action buttons, using btn-sm modifier.',
      'New CSS: oc-action-circle (32×32px circular button base), oc-stop-btn (red stop icon — was inline-only), oc-send-btn restyled as circle. Send and stop buttons now share consistent circular shape.',
      'New CSS: btn-banner (small uppercase pill for floating banners), btn-banner--warning (amber variant), btn-sm (compact size modifier for any button class).',
      'UnifiedDashboard: Cleaned up inline style overrides on retry link and Load More button.',
    ]
  },
  {
    version: 'v0.5.185',
    date: '2026-06-09',
    changes: [
      'Zero-project empty state: List pane shows "No projects yet." with a Create Project button instead of stuck "Loading..." spinner.',
      'Project CRUD from list pane: "+ Project" button in command bar (right of search). Kebab menu next to project title with Edit Project and Delete Project (two-step confirm, danger color).',
      'Project search dropdown scoped by role: non-admins use server-provided projects (no cross-user query), eliminating false-positive error logging for users with zero projects.',
      'New projects immediately appear in both the list pane and the project search dropdown.',
      'UI catalog rule: Kebab = action overflow on an item. Gear = navigation to a settings page.',
    ]
  },
  {
    version: 'v0.5.184',
    date: '2026-06-08',
    changes: [
      'Table headings: Green background (--btn-primary-bg) with white text, centered. Matches dashboard button styling. Applied to all tables including Audit Log and Friction.',
      'Standardized action columns: New .action-cell and .action-link CSS classes. 2 actions = both as links, 3+ = primary link + kebab. Action td uses stopPropagation so clicking empty space does not trigger row edit. Applied to Priorities, Platforms, Statuses, Projects, Users, Knowledge, Tickets, Invitations, Friction.',
      'Removed Order column and reordering arrows from Platforms and Statuses tables.',
      'Invitations: Replaced btn-primary/oc-tool-btn action buttons with action-link + kebab pattern (Resend link, Decline Link + Delete in kebab).',
      'Audit Log: Rewritten to use SettingsCrudList with server-side pagination, column resize, bulk delete, and detail modal. No longer a standalone component.',
      'SettingsCrudList: Added pagination support (config.pagination), headerExtra slot, and onRowClick override.',
      'iPad touch stability: touch-action on table and resize handles, overscroll-behavior-x: contain on scroll container.',
    ]
  },
  {
    version: 'v0.5.183',
    date: '2026-06-08',
    changes: [
      'Tickets overflow menu: Replaced inline action buttons with vertical kebab dropdown. Edit stays visible, Create todo/Dismiss/Delete in overflow menu. Actions column shrunk from 18% to 10%, left-aligned, Edit and kebab spaced apart.',
      'New .btn-overflow CSS class: 44px min hit target, 28px vertical kebab, hover state. Reusable standard for overflow menus.',
      'Column width reset: Invalidated stale localStorage widths (v2 key prefix). Added "Reset columns" link next to subtitle when custom widths are active.',
    ]
  },
  {
    version: 'v0.5.179',
    date: '2026-06-08',
    changes: [
      'Simplify Priorities settings: Removed the Order column and reordering arrows. Priorities are now a fixed sequential list (1-4). Renumbered existing priorities to close the gap from a deleted entry (1,2,4,5 → 1,2,3,4). The ON UPDATE CASCADE FK ensures all todos were updated automatically. Redistrubuted column widths across the remaining 4 columns.',
    ]
  },
  {
    version: 'v0.5.178',
    date: '2026-06-08',
    changes: [
      'Fix single-column resize (ORB-223): Only the dragged column now changes width during resize. Other columns stay at their exact pixel widths via min-width/max-width locking. Table width tracks the actual sum of column widths — shrinks when columns are narrower, grows when wider. When columns exceed the viewport, horizontal scroll activates and nav arrows appear. Fixed TypeScript errors in spacer cell logic.',
    ]
  },
  {
    version: 'v0.5.176',
    date: '2026-06-08',
    changes: [
      'Table Column Resizing Clamps and Ellipsis (ORB-233): Clamped the minimum column width to 60px to prevent columns from being collapsed out of view. Added text-overflow ellipsis to table header labels to prevent wrapping and layout shift when columns are resized to be small. Removed the hardcoded max-width: 280px constraint from audit cells to allow text in wider columns to fully expand. Added minWidth: \'100%\' to the table to eliminate empty right-side gaps when column widths are narrow. Integrated localStorage state persistence for column widths and refactored measurements to occur exclusively on drag start rather than header click, ensuring header clicks for sorting remain responsive without locking widths prematurely.',
    ]
  },
  {
    version: 'v0.5.175',
    date: '2026-06-08',
    changes: [
      'Assisted Ticket Lifecycle Progression Bugfixes (ORB-190): Fixed mapping of linked_todo in the settings tickets load query to correctly populate the Linked todo column, show the Todo Closed warning badge, and hide the Create todo action when a linked todo is in progress.',
      'Email Message Override Saving: Fixed the Edit Ticket modal to correctly save custom email message overrides into the resolution_notes database column.',
      'Bi-directional Link Resetting: Configured updateTicket and updateTicketStatus to bi-directionally sever the connection between a ticket and its associated todo (by setting todo_id and ticket_id to null) when the status is changed back to Open.',
      'Table Column Resizing: Omitted the column resize handle on the last column (Actions) of SettingsCrudList to prevent layout instability.',
    ]
  },
  {
    version: 'v0.5.174',
    date: '2026-06-08',
    changes: [
      'Assisted Ticket Lifecycle Progression (ORB-190): When a linked todo is closed, the system now prompts the developer/admin to decide the ticket\'s status and review reporter notifications rather than closing the ticket automatically.',
      'Warning badges and alert banners: Added a visual amber warning badge (Todo Closed) in the tickets list rows and mobile card views, and an alert banner at the top of the Edit Modal form when a linked todo is completed.',
      'Conversational Orb context and prompts: Updated backlog query to fetch and format linked tickets (e.g. [Linked: TICKETS-N]), return linked_ticket status updates from update_todo, and inject a custom verification prompt instructing the Orb to prompt the user to transition the ticket.',
    ]
  },
  {
    version: 'v0.5.173',
    date: '2026-06-08',
    changes: [
      'Service error UX: Human-readable error messages for API failures (overloaded, rate limit, billing, network) replace opaque "System error." Amber card styling for service errors. Admin email + auto-ticket on billing/credit exhaustion. DEV panel: simulate billing and overloaded errors, toggle anchored at bottom.',
      'Server-enforced mutation verification (ORB-225): Try/catch per tool handler, _verification signals in mutation tool results, tightened prompt, code-fabrication eval case.',
    ]
  },
  {
    version: 'v0.5.171',
    date: '2026-06-07',
    changes: [
      'Two-Turn Mutation Verification: Rewrote ORB_MUTATION_VERIFICATION protocol prompt in lib/orb-prompt.ts to explicitly structure all database mutations and ticket creations as strict two-turn processes, ensuring the first turn only proposes the action using future tense and prohibits any past-tense success claims or guessed ID codes.',
    ]
  },
  {
    version: 'v0.5.170',
    date: '2026-06-07',
    changes: [
      'Refine Ticket Code Verification: Updated ORB_MUTATION_VERIFICATION protocol prompt in lib/orb-prompt.ts to explicitly mandate that the Orb report the generated ticket code (e.g. TICKETS-xxx) in its second-turn confirmation response for both proactive and user-requested ticket creations.',
    ]
  },
  {
    version: 'v0.5.169',
    date: '2026-06-07',
    changes: [
      'Fix Ticket Code Propagation: Modified the create_ticket tool result handler inside app/actions/orb-converse.ts to return the generated ticket code (e.g., TICKETS-xxx) in the tool output object and streamed thought updates, enabling the Orb to successfully state the specific ticket code to the user after verification.',
    ]
  },
  {
    version: 'v0.5.168',
    date: '2026-06-07',
    changes: [
      'Verify Tickets and Mutation Success (ORB-225): Appended ORB_MUTATION_VERIFICATION guidelines to the system prompt in both app/actions/orb-converse.ts and app/api/orb-eval/route.ts. This protocol prohibits the Orb from claiming success or reporting code/ID values before mutation tools run (first turn), and mandates verifying the tool results and explicitly reporting failures on error (second turn).',
      'Added Mutation Verification Eval Cases: Appended Tier 2 regression cases (mutation-no-premature-success and ticket-no-premature-success) to scripts/eval-cases.ts to verify the Orb does not output premature success claims or cite codes in the initial tool execution turn.',
    ]
  },
  {
    version: 'v0.5.167',
    date: '2026-06-07',
    changes: [
      'Fix Ticket Edit Modal Todo Pollution: Decoupled editing state from create-todo state in SettingsTickets. Defined a new editingTicketId state variable specifically for tracking the ticket being modified inside the Edit modal, preventing the row from rendering the inline "Create todo" form upon opening or closing the Edit modal.',
      'Add onClose Callback Support: Extended SettingsCrudList component configuration (CrudConfig) with an onClose callback, invoked inside closeModal, to clean up editing state in parent views cleanly.',
    ]
  },
  {
    version: 'v0.5.166',
    date: '2026-06-07',
    changes: [
      'Standardize Edit Modals (ORB-222): Unified all edit modals to use modal-center with width modifiers (modal-sm, modal-lg, modal-compose). Close button enlarged to 28px/44px hit target. Form fields now use --fs-input on phone for consistent legibility.',
      'New compose modal pattern (modal-compose): 920px two-column layout for form + live preview, stacks on narrow viewports. Used by SettingsTickets edit form.',
      'Migrated AddProductModal (apm-*) and DistillModal (dm-*) to standard modal-center. Removed all custom modal CSS classes.',
      'Deleted dead prototype code: SettingsCrudListV2, SettingsTicketsPrototype, /settings/tickets-prototype route.',
      'Stripped all inline fontSize overrides from SettingsTickets edit form — now uses pf-* classes throughout.',
    ]
  },
  {
    version: 'v0.5.165',
    date: '2026-06-07',
    changes: [
      'Judgment-Driven Resolution (ORB-205): Added ORB_RESOLUTION_LAWS prompt block enforcing three epistemic laws — Resolve Before Escalating, Name Your Uncertainty, No Lazy Escalation. The Orb must now search with its tools before presenting options for factual questions, and only escalate to the user when genuine intent ambiguity remains.',
      'Added eval cases: resolve-duplicate-searches-first (Tier 1) and no-lazy-escalation-on-lookup (Tier 2) to catch regressions.',
    ]
  },
  {
    version: 'v0.5.164',
    date: '2026-06-07',
    changes: [
      'Admin Zero-Task Project Display Fix: Conditionally disabled the created_by owner filter on visibleProjectsQuery inside dashboard pages (dashboard, prototype) and components (AmbientDashboard, UnifiedDashboard) if the user is an admin. This ensures that switching to another user\'s project (which may have 0 tasks) properly resolves the project metadata and displays the name on the Orb face and list headers.',
    ]
  },
  {
    version: 'v0.5.163',
    date: '2026-06-07',
    changes: [
      'Orb Face Project Name Clamping (ORB-223): Updated the Orb face to render the uppercase project name instead of its code, dynamically clamping the string based on DM Sans 11px font metrics to ensure it fits within half the circumference (182px).',
    ]
  },
  {
    version: 'v0.5.162',
    date: '2026-06-06',
    changes: [
      'Dev Button Standardization: Updated the DEV button (.btn-dev) to use the standard primary button CSS variables for its background, border, hover, and active states.',
    ]
  },
  {
    version: 'v0.5.161',
    date: '2026-06-06',
    changes: [
      'Button Color Calibration: Adjusted standard button variables to be slightly lighter (#408040 default, #2d5a2d hover, and #204020 active) for improved overall visual balance and readability across the app.',
    ]
  },
  {
    version: 'v0.5.160',
    date: '2026-06-06',
    changes: [
      'Task List Toolbar Buttons Standardization: Changed Sort, Filter, and Views from outline style to standard solid green buttons (using --btn-primary-bg) by default, and dark green (using --btn-primary-active-bg) when active/pressed, with a permanent white background for the Filter badge for high legibility.',
    ]
  },
  {
    version: 'v0.5.159',
    date: '2026-06-06',
    changes: [
      'Task List Toolbar Buttons Restyling: Standardized Sort, Filter, Views, and New buttons using standard primary button CSS variables. Redesigned Filter badge (.tv-badge) to invert colors (white background, green text) when the Filter button is active (pressed) for clean visual contrast.',
    ]
  },
  {
    version: 'v0.5.158',
    date: '2026-06-06',
    changes: [
      'Button CSS Variables Refactor: Introduced global --btn-primary variables (--btn-primary-bg, --btn-primary-hover-bg, --btn-primary-active-bg) in globals.css root so that both primary buttons (.btn-primary) and conversation toolbar buttons (.oc-tool-btn) share the same design-system tokens for consistent propagation.',
    ]
  },
  {
    version: 'v0.5.157',
    date: '2026-06-06',
    changes: [
      'Orb Conversation Toolbar Buttons styling: Lightened the default unhovered background and border color to #387038 to provide clearer visual contrast with the hover and active states.',
    ]
  },
  {
    version: 'v0.5.156',
    date: '2026-06-06',
    changes: [
      'Orb Conversation Toolbar Buttons styling: Updated button states (non-hovered, hovered, active, disabled) to a darker forest green theme to match the Enable Push Notifications button aesthetic.',
    ]
  },
  {
    version: 'v0.5.155',
    date: '2026-06-06',
    changes: [
      'Responsive CRUD tables (ORB-221): scope filters with >5 options now render as a dropdown instead of pills, reducing visual clutter on all viewports.',
      'Mobile card layout: Tickets page renders as tappable cards on iPhone (<768px) instead of a cramped horizontal-scroll table.',
      'Header word-wrap: table column headers wrap text instead of truncating, keeping all columns visible without horizontal scroll.',
      'Added "Filters" label above scope pills and dropdowns for clarity.',
      'Dev server gotcha: expanded AGENTS.md to explicitly prohibit AI tools from starting, stopping, or killing the dev server.',
    ]
  },
  {
    version: 'v0.5.154',
    date: '2026-06-06',
    changes: [
      'Fix column resizing: merged duplicate .audit-table CSS rules so table-layout: fixed takes effect, enabling drag-to-resize column widths.',
      'Fix column resizing: changed border-collapse to separate so position: relative works on th elements (required for the resize handle).',
      'Column resize is now desktop-only: hidden on touch devices via pointer: fine media query. Touch devices keep sensible fixed-width columns with horizontal scroll.',
      'Added visible hover indicator on resize handle (vertical bar appears on hover).',
    ]
  },
  {
    version: 'v0.5.153',
    date: '2026-06-06',
    changes: [
      'Tickets Crud Migration: Refactored the tickets dashboard page to use the generic SettingsCrudList component layout.',
      'Interactive Column Resizing: Implemented interactive click-and-drag handles on table headers in SettingsCrudList to support custom column stretching.',
      'Reporter Bugfix: Restored reporter details mappings inside the database load result converter.',
    ]
  },
  {
    version: 'v0.5.151',
    date: '2026-06-06',
    changes: [
      'Ticket Filters: Added status filter tabs (Active, All, Open, In Progress, Pending, Awaiting Input, Pending Release, Pending Verification, On Hold, Deferred, Closed, Dismissed) on the Tickets dashboard page.',
      'Ticket Deletion Actions: Added individual delete actions with inline prompt confirmations and bulk delete buttons to support ticket removal.',
      'Email Explanation Formatting: Formatted email dismiss/decline reason notifications with a clear "Explanation:" section header.',
    ]
  },
  {
    version: 'v0.5.149',
    date: '2026-06-06',
    changes: [
      'Tickets Manual Progression: Decoupled ticket states from todo actions so closing a todo does not automatically close its linked ticket.',
      'Multiple Ticket States: Added support for pending, awaiting input, pending release, pending verification, on hold, and deferred ticket statuses.',
      'Manual Email Preview and overrides: Added a live-updating email notification preview in the ticket edit modal, allowing admins to view the dynamically generated email and customize it prior to sending.',
    ]
  },
  {
    version: 'v0.5.148',
    date: '2026-06-05',
    changes: [
      'Tickets Edit Rework: Changed the Edit Ticket modal summary field from a single-line input to a multiline textarea to accommodate longer feedback.',
      'Tickets Detail Bugfix: Fixed a bug where getTickets selected fields omitted the detail and conversation_snippet columns, preventing details from showing in the UI.',
      'Tickets UI Layout: Placed Status and Type select dropdowns side-by-side in a two-column grid, giving the multiline Summary field full width at the top.',
    ]
  },
  {
    version: 'v0.5.147',
    date: '2026-06-05',
    changes: [
      'ORB-213: Reporter now receives an acknowledgment email when they submit feedback via the Orb ("We received your feedback").',
      'ORB-213: Fixed createTodoFromTicket to move ticket to in_progress (not closed) — reporter gets "We\'re working on your feedback" at the right time.',
      'ORB-213: Resolution email now includes the version number when a linked todo is closed ("This change is included in version vX.X.X").',
      'ORB-213: New declined email sent to reporter when a ticket is dismissed with a reason. Dismissing without a reason is silent (no notification).',
      'Eval suite reliability: Added retry with exponential backoff and 300ms cool-off delay between runs to prevent socket exhaustion on full suite runs.',
    ]
  },
  {
    version: 'v0.5.146',
    date: '2026-06-05',
    changes: [
      'ORB-176: Implemented custom global TooltipProvider with a fast 200ms trigger delay to replace slow native browser tooltips.',
      'ORB-176: Updated desktop navigation AppNav buttons (Dashboard, Print, Help, Settings, Account, Commands) to use the new custom tooltip pattern.',
      'ORB-176: Added .global-tooltip styling in globals.css matching the project\'s visual aesthetic and documented the new pattern in ui-catalog.md.',
    ]
  },
  {
    version: 'v0.5.145',
    date: '2026-06-05',
    changes: [
      'ORB-212: Restricted strategic guidance and workload task recommendations (answering "what should I do next?" or "what should I work on?") to only recommend active tasks from projects owned/created by the current user.',
      'ORB-212: Expanded current user query in buildContext and eval router to fetch first and last names, ensuring proper attribution in user lookup maps.',
      'ORB-212: Added a Tier 2 evaluation case strategic-guidance-scoping to ensure that strategic recommendations exclude other users\' projects.',
    ]
  },
  {
    version: 'v0.5.144',
    date: '2026-06-04',
    changes: [
      'ORB-208: Excluded Claude Code worktree directories (.claude/**) from ESLint scanning to prevent duplicate error reports.',
      'ORB-208: Discarded typescript no-explicit-any checking globally to maintain clean build diagnostics.',
      'ORB-208: Fixed React Compiler and React Hook render-time warnings (memoization dependencies and ref modifications) in useVisibilityRefetch and HScrollNav.',
      'ORB-208: Resolved unescaped quotes inside JSX layout text across multiple settings views.',
    ]
  },
  {
    version: 'v0.5.143',
    date: '2026-06-04',
    changes: [
      'ORB-207: Filtered proactive observations (such as overdue and stale task highlights in the greeting prompt) to only analyze and surface tasks belonging to projects owned/created by the current user.',
    ]
  },
  {
    version: 'v0.5.142',
    date: '2026-06-04',
    changes: [
      'ORB-211: Made the conversation input field more prominent by increasing default border thickness, using a higher-contrast border color, adding a subtle shadow, and implementing premium hover and focus ring glow effects in CSS.',
      'ORB-211: Added visual separation spacing between the conversation thread and the input field to clearly differentiate the message flow from the input container.',
    ]
  },
  {
    version: 'v0.5.141',
    date: '2026-06-04',
    changes: [
      'ORB-210: Updated the Pre-Alpha Testing help page in the Help sidebar to remove references to the deleted onboarding seed projects (WELCOME, ECO) and replaced them with general project task scenarios.',
    ]
  },
  {
    version: 'v0.5.140',
    date: '2026-06-04',
    changes: [
      'Conditional mediation: returning users with a passkey see it in the email field\'s autofill. Tap it, biometric fires, signed in — no email or OTP needed.',
      'Uses Supabase\'s two-step passkey API (startAuthentication + verifyAuthentication) with navigator.credentials.get({ mediation: "conditional" }).',
      'Progressive enhancement: if the browser doesn\'t support conditional mediation, the page falls back to email/OTP silently. All failure paths are silent.',
    ]
  },
  {
    version: 'v0.5.139',
    date: '2026-06-04',
    changes: [
      'Passkey registration is now mandatory: after OTP login, users are redirected to set up a passkey if their device supports it. No skip option.',
      'Removed passkey button from login page — all users start with email/OTP. Passkeys are used automatically by the OS on subsequent logins.',
      'Removed Settings > Passkeys page from navigation — passkey management is handled by the mandatory gate and the OS.',
      'Passkeys settings page is now accessible to all users (not admin-only) if accessed by direct URL.',
    ]
  },
  {
    version: 'v0.5.138',
    date: '2026-06-04',
    changes: [
      'ORB-209: Removed onboarding sample projects and tasks (WELCOME, HOME, ECO) so new users start in zero-project state.',
      'ORB-209: Configured Orb click/tap in zero-project state to open project creation modal, and disabled task "+ New" button on zero-projects with a friendly toast reminder.',
      'ORB-209: Updated Guided Tour steps and descriptions to follow the new 7-step sequence.',
    ]
  },
  {
    version: 'v0.5.137',
    date: '2026-06-04',
    changes: [
      'Clarified Comprehension Check instructions in AGENTS.md to explicitly allow read-only tool usage on the first turn to gather check answers.',
    ]
  },
  {
    version: 'v0.5.136',
    date: '2026-06-03',
    changes: [
      'Closed ORB-173 (Pre-Alpha Checklist): all 5 gates met — core loop reliable, multi-user works, infrastructure holds, first impression competent, operator can manage.',
      'Closed ORB-197 (Onboarding for Testers): driver.js guided tour shipped in v0.5.135.',
    ]
  },
  {
    version: 'v0.5.135',
    date: '2026-06-03',
    changes: [
      'ORB-197: Replaced the text-list onboarding with a driver.js guided tour — 6 observational steps that highlight real UI elements (Orb, conversation input, views, help). No step requires an action, so the tour is correct from any app state.',
      'ORB-197: Tour launch via one-line nudge in first conversation (not auto-start). Also accessible from Help panel. Mobile-aware with per-step pane switching for tabbed layout.',
      'ORB-197: WELCOME seed tasks retitled to clean, prefix-free titles.',
      'Codified the Orb eval suite as a mandatory rule in AGENTS.md — new capabilities must include matching eval cases, Tier 1 must be green before any production push.',
      'ORB-197 onboarding plan: invite-email feedback wording improvements.',
    ]
  },
  {
    version: 'v0.5.132',
    date: '2026-06-02',
    changes: [
      'Scope transparency prompt fix: restructured the SCOPE instruction as a bullet list with an explicit mandatory rule — the Orb must name the project(s) in every response that mentions task counts or summaries.',
      'Orb eval framework: new /api/orb-eval endpoint (dev-only) and scripts/orb-eval.ts test runner. Tier 1 tests verify tool call correctness (deterministic). Tier 2 tests verify behavioral properties (statistical, 3 runs, 2/3 pass). 11 initial test cases covering tool routing, scope transparency, cross-project awareness, mutation approval, and feature disclosure.',
      'Orb prompt: added backlog direct access rule (answer simple counts from static context without tool calls) and tool query transparency rule (state lookup scope before calling query tools).',
    ]
  },
  {
    version: 'v0.5.131',
    date: '2026-06-02',
    changes: [
      'ORB-206: Clean up stale invitations (accepted/declined) when sending a new user invite to prevent duplicate records and resend confusion.',
      'ORB-206: Clean up the auth.users record when a pending invitation is deleted from the system if the user has not registered yet.',
    ]
  },
  {
    version: 'v0.5.130',
    date: '2026-06-02',
    changes: [
      'ORB-206: Clean up associated invitations when a user is deleted from the system, preventing stale status conflicts when the email is reused for new invitations.',
    ]
  },
  {
    version: 'v0.5.129',
    date: '2026-06-02',
    changes: [
      'ORB-198: Provided the Orb conversational AI with precise UI navigation knowledge by dynamically loading docs/ui-catalog.md at runtime.',
      'ORB-198: Enriched docs/ui-catalog.md with exact button labels, panel toggles, mobile menu behaviors, settings updates, and corrected version badge interactivity.',
      'Enforced UI Catalog updates by introducing scripts/verify-ui-catalog.js (run in npm run lint) which fails if UI files are modified without updating the documentation.',
      'Audited database RLS policies and confirmed all 43 policies are correctly optimized; corrected the check query pattern in AGENTS.md to prevent false positives.',
    ]
  },
  {
    version: 'v0.5.128',
    date: '2026-06-02',
    changes: [
      'ORB-202: Tickets now auto-close when a todo is created from them. The reporter is notified that their feedback has been addressed.',
      'ORB-203: Decoupled query scope from mutation scope — the Orb now sees all projects in every conversation (global query), while mutations (create/update) default to the currently selected project. Removes the "All/Scope" toggle button from the Orb toolbar.',
      'ORB-203: Admins can now ask "how many open tasks in Helm?" while viewing the Orb project without toggling scope. Cross-project queries work naturally.',
    ]
  },
  {
    version: 'v0.5.127',
    date: '2026-06-02',
    changes: [
      'Fixed database project seeding failure for new users during onboarding: updated projects table check constraint (projects_view_mode_check) to allow the "kanban" view mode, preventing silent seeding failures and subsequent project search errors.',
      'Upgraded invitation link generation in invite-user and invitation-actions to robustly use HTTPS for localhost in development, resolving empty response errors caused by http:// dev links.',
      'Resolved the invitation bypass issue where invited users skip the create-account onboarding screen and land directly on the dashboard. Integrated project and task seeding directly into resolveUser via a new shared onboarding seeding utility (lib/onboarding-seeding.ts) to guarantee their default projects are seeded before they reach the dashboard.',
    ]
  },
  {
    version: 'v0.5.126',
    date: '2026-06-02',
    changes: [
      'Fixed user invitation modal error handling: added return statement to handleAdd catch block in SettingsCrudList to ensure error messages are displayed rather than closing the modal silently.',
      'Enhanced user invitation checks to be case-insensitive and trimmed to prevent duplicate registrations via casing differences.',
    ]
  },
  {
    version: 'v0.5.125',
    date: '2026-06-02',
    changes: [
      'Implemented onboarding seeding (WELCOME, HOME, ECO projects with realistic demo tasks) to demonstrate strategic planning and ambient states for pre-alpha testers.',
      'Added a 7-day survey check-in where the Orb queries active users on Ambient Orb utility, Strategic Guidance utility, and Friction/Bugs, automatically logging feedback as tickets.',
      'Added a Pre-Alpha Testing guide to the Help panel detailing testing goals and how to report bugs or suggestions.',
      'Fixed layout bugs: added vertically centered text labels under top-right nav icons on desktop, and resolved mobile layout pane isolation issues.',
      'Cleaned up ESLint unescaped entities and synchronous state update warnings in OrbHelp.',
    ]
  },
  {
    version: 'v0.5.124',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Prevented horizontal column scrolling from reclaiming touch gestures by default-preventing early touchmove events immediately once the long-press drag gesture becomes ready.',
    ]
  },
  {
    version: 'v0.5.123',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Disabled text selection on Kanban cards and columns to prevent accidental highlighting and magnifying glass popups during drag-and-drop actions on mobile.',
    ]
  },
  {
    version: 'v0.5.122',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Removed temporary debug drop coordinate check alert and related tracking variables.',
    ]
  },
  {
    version: 'v0.5.121',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Disabled HTML5 draggable behavior on touch devices to prevent mobile browser native drag hijacking.',
    ]
  },
  {
    version: 'v0.5.120',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Configured touch-action: pan-y on Kanban cards to prevent browser horizontal scrolling from cancelling the drag gesture.',
    ]
  },
  {
    version: 'v0.5.119',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Extended drop diagnostic alerts with viewport coordinates and column boundary boxes mapping.',
    ]
  },
  {
    version: 'v0.5.118',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Extended drop diagnostic alerts with active column tracking history.',
    ]
  },
  {
    version: 'v0.5.117',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Added temporary diagnostic alerts for touch drop debugging.',
    ]
  },
  {
    version: 'v0.5.116',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Refactored touch event handling to register native document-level listeners with { passive: false } on touch start to prevent native scrolling interference.',
      'Kanban touch drag: Resolved stale closure bugs during drag-and-drop by using refs for tracking active drop targets and props status-change callback functions.',
      'Kanban touch drag: Cleaned up JSX by removing unused React synthetic touch listeners on Kanban cards.',
    ]
  },
  {
    version: 'v0.5.110',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: fixed drops failing after the first successful drag on iPhone. Root cause: iOS Safari scroll containers (-webkit-overflow-scrolling) intercepted touch events before React\'s delegated handlers could call preventDefault(), causing column positions to shift mid-drag and drop target hit-testing to fail.',
      'Touch handlers now use native document-level listeners with { passive: false } instead of React synthetic events, guaranteeing preventDefault() is respected regardless of scroll container nesting.',
      'Removed deprecated -webkit-overflow-scrolling: touch from kanban CSS (unnecessary since iOS 13+).',
      'Kanban touch drag: fixed ghost card images persisting on iPhone. Orphaned clones cleaned up on touchcancel, unmount, and before new drags.',
      'Kanban touch drag: long-press activation model (300ms hold + movement) replaces instant 10px threshold. Scrolling no longer accidentally triggers drag.',
    ]
  },
  {
    version: 'v0.5.108',
    date: '2026-06-01',
    changes: [
      'Standardized project backlog search placeholder inside TodoView to "Type to select project or user..." to keep it consistent with the main dashboard.',
      'Designed and added text labels below each icon button in the Orb conversation bottom toolbar.',
      'Refactored the Orb conversation toolbar to be a horizontally scrollable container on smaller screen viewports to prevent wrapping and layout breakage.',
    ]
  },
  {
    version: 'v0.5.107',
    date: '2026-06-01',
    changes: [
      'Standardized placeholder text sizes in search inputs and textareas to use var(--fs-sm) instead of hardcoded pixel sizes.',
      'Standardized font sizes for slash command headers and item descriptions in the Orb conversation view to use var(--fs-version) instead of hardcoded pixel sizes.',
    ]
  },
  {
    version: 'v0.5.106',
    date: '2026-06-01',
    changes: [
      'Grayed out / disabled active tab buttons on mobile viewports so user knows only the other button can be selected.',
      'Enlarged button label font sizes by 2px on mobile viewports for better readability and accessibility.',
      'Updated the project search input placeholder to always say "Type to select project or user...".',
    ]
  },
  {
    version: 'v0.5.105',
    date: '2026-06-01',
    changes: [
      'Fixed layout bug where hiding one of the panes on desktop results in the remaining pane (specifically the Orb) staying stuck at 50% width.',
    ]
  },
  {
    version: 'v0.5.104',
    date: '2026-06-01',
    changes: [
      'Eliminated mobile bottom tab switcher and repositioned tab controls to the top command bar.',
      'Adapted top header toggles on mobile to act as view switchers ("Orb" and "List") instead of pane toggles, keeping desktop layout side-by-side toggles completely unchanged.',
      'Added mobile-only CSS styles for active toggle highlights in the command bar.',
    ]
  },
  {
    version: 'v0.5.103',
    date: '2026-06-01',
    changes: [
      'Corrected mobile breakpoint threshold to < 768px (down from < 1024px) to ensure tablet/iPad views and resized desktop browser viewports remain in side-by-side split screen mode.',
      'Restored original panel toggle handlers and DragDivider layouts on desktop screens.',
    ]
  },
  {
    version: 'v0.5.102',
    date: '2026-06-01',
    changes: [
      'Implemented Adaptive Viewport layout for Unified Dashboard, enabling full-screen tab switching on viewports < 1024px and side-by-side split screen on viewports >= 1024px.',
      'Designed and added mobile-only bottom navigation bar utilizing existing SVG icons for Orb Assistant and Task Backlog.',
      'Applied CSS-driven visibility: hidden toggling on inactive mobile tabs to preserve scroll positions, cursor focus, and DOM state without unmounting.',
    ]
  },
  {
    version: 'v0.5.101',
    date: '2026-06-01',
    changes: [
      'Updated the mobile layout proposal (docs/mobile_dashboard_layout_proposal.md) to address separate screens on mobile vs. split-screen on desktop.',
    ]
  },
  {
    version: 'v0.5.100',
    date: '2026-06-01',
    changes: [
      'Added the conceptual paper "The Speed Illusion: Why AI-Assisted Software Engineering Still Takes Months" to project documentation.',
    ]
  },
  {
    version: 'v0.5.99',
    date: '2026-06-01',
    changes: [
      'Consolidated health and version polling into a unified SystemStateProvider to eliminate duplicate API requests.',
      'Reduced database connection overhead from maintenance checks by centralizing intervals.',
      'Added a 500ms trailing debounce on window focus/visibility changes to prevent back-to-back fetching.',
      'Optimized polling by relaxing the health check interval to 30s and pausing polling entirely when the document tab is hidden.',
    ]
  },
  {
    version: 'v0.5.98',
    date: '2026-06-01',
    changes: [
      'Kanban view empty column text period fix ("No tasks displayed, check filters.").',
    ]
  },
  {
    version: 'v0.5.97',
    date: '2026-06-01',
    changes: [
      'Kanban view empty column text updated to prompt checking active filters when empty ("No tasks displayed, check filters").',
    ]
  },
  {
    version: 'v0.5.96',
    date: '2026-06-01',
    changes: [
      'Mutation approval protocol: Orb now proposes mutations and waits for user confirmation before executing. Supports multi-action parsing from natural language.',
      'Capability check: Orb now discloses unsupported features (recurring tasks, dependencies, etc.) before proposing — never silently degrades a request.',
      'Fuzzy search for knowledge repo: typo-tolerant matching (edit distance ≤ 2) and word-level matching. "smirtles" now finds "smirttles".',
      'Contextual coaching: Orb weaves relevant observations into mid-conversation responses at natural moments.',
      'UI self-awareness: Orb knows what view, filters, and device the user is on.',
    ]
  },
  {
    version: 'v0.5.95',
    date: '2026-05-31',
    changes: [
      'Kanban drag-and-drop: drag tasks between columns to change status. Works on desktop (HTML5 drag) and mobile (touch drag with floating card clone).',
      'Drop target highlighting: columns glow green when a card is dragged over them. Empty columns show "Drop here" prompt.',
      'Status changes via drag trigger audit logging, ticket propagation, and distill modal on close.',
    ]
  },
  {
    version: 'v0.5.94',
    date: '2026-05-31',
    changes: [
      'Behavioral persistence: Orb now enforces cross-session behavioral rules stored in the knowledge repo (tagged orb-behavior). Agreements made during conversations survive across sessions.',
      'Dev channel message retention: processed/delivered messages purged after 7 days. Pending messages kept indefinitely. Knowledge repo is the permanent record.',
    ]
  },
  {
    version: 'v0.5.93',
    date: '2026-05-31',
    changes: [
      'Developer Channel v2: Orb can now send messages TO developer tools via send_to_developer tool — bidirectional communication complete.',
      'Orb uses send_to_developer for actionable observations: bugs spotted, schema clarifications, verification feedback, task context for implementation.',
      'Developer tools poll GET /api/dev-channel?direction=orb_to_dev to receive Orb messages.',
    ]
  },
  {
    version: 'v0.5.92',
    date: '2026-05-31',
    changes: [
      'Developer Channel: New bidirectional communication channel between external AI developer tools (Claude Code, Gemini CLI) and the Orb conversational AI.',
      'REST API endpoint POST/GET /api/dev-channel — developer tools send messages to the Orb and poll for responses, authenticated via ORB_API_SECRET.',
      'Dev messages appear inline in the Orb conversation UI with a distinct blue-tinted card style and sender label (e.g. "Claude Code (Opus 4.6)").',
      'Restricted tool mode: Orb processes developer messages with read-only tools only — no mutations without Stan\'s approval.',
      'Tab-focus polling: pending dev messages auto-load and process when the Orb UI regains focus.',
      'Knowledge repo integration: all developer-Orb exchanges auto-logged with dev-channel tags.',
    ]
  },
  {
    version: 'v0.5.91',
    date: '2026-05-30',
    changes: [
      'Disk IO fix: Replaced 60-second server-polling urgency check with client-side computation. Eliminates 4 DB queries/minute per open tab.',
      'ORB-188 Phase 1: Extracted view components from UnifiedDashboard monolith — TaskListView, TaskChecklistView, ViewSwitcher now standalone reusable components.',
      'ORB-188 Phase 2: Kanban board view — tasks displayed in columns by status (Open → In Progress → Closed → Deferred → On Hold). Click any card to edit.',
      'Views toolbar: List, Checklist, and Kanban view switching. View preference persists per project.',
      'Urgency transition messages debounced — suppresses duplicate "Orb shifted busy" notifications from transient re-render flicker.',
      'Views button in toolbar now horizontal text, consistent with Sort and Filter buttons.',
      'AmbientDashboard: removed all server urgency polling.',
    ]
  },
  {
    version: 'v0.5.90',
    date: '2026-05-30',
    changes: [
      'ORB-186 Phase 6: Changelog awareness — Orb can answer "what\'s new?" conversationally from the latest 3 releases. Changelog injected into system prompt.',
      'ORB-186 Phase 5: Feedback loop closure — recent tickets loaded into Orb context. Orb references resolved issues and avoids filing duplicates.',
      'ORB-186 Phase 4: Self-diagnostics — diagnose protocol, query_capabilities tool ("what can you do?"), ticket deduplication.',
      'ORB-186 Phase 3: Proactive guidance — context-aware greeting, observations (overdue/stale/closures/workload), respects guidance_level preference.',
      'ORB-186 Phase 2: Adaptive Orb identity — session adaptation, per-user preferences (guidance_level, verbosity, scope_reminders), get/set_preference tools.',
      'ORB-186 Phase 1: Prompt architecture — monolithic system prompt split into Principles, Domain Knowledge, and Behavioral Guidelines layers.',
      'Orb responses render markdown — headers, bold, lists, horizontal rules displayed as formatted text. Copy preserves raw markdown.',
      'Tickets: floating modal for viewing/editing ticket details. Edit button added to Actions column.',
      'Max response tokens increased from 1024 to 4096. Truncated tool calls now return a clear diagnostic error.',
      'Current date injected into system prompt. query_db guards against SQL subquery injection in filter values.',
    ]
  },
  {
    version: 'v0.5.82',
    date: '2026-05-30',
    changes: [
      'Account initial displayed in a circle (nav-avatar) across desktop nav bar and mobile commands modal.',
      'Commands label shown below icon on mobile with vertically centered layout in 44px nav bar.',
      'All icon label text unified to nav-btn-label at 11px — removed duplicate ud-toggle-label class. Single source of truth for icon label sizing.',
      'Check for Update button in Settings > What\'s New. Also available via the Orb ("is there an update?").',
      'Orb now understands urgency rules: knows that overdue due dates AND urgent priorities both trigger the urgent state independently.',
      'Knowledge Repository and Audit Log promoted to their own settings pages with sidebar entries (admin-only).',
      'Data Management page simplified — Backup & Recovery and Task Archival only.',
      'Commands modal close button moved to far right for consistency with other modals.',
      'Staging environment removed from development workflow — two-tier: localhost to production.',
    ]
  },
  {
    version: 'v0.5.81',
    date: '2026-05-30',
    changes: [
      'Table conformity rework: all settings tables now share the same design via SettingsCrudList — consistent headers, row styling, sort indicators, and bulk actions.',
      'Floating modal for all Add/Edit forms — replaces inline row editing across Priorities, Statuses, Platforms, Projects, Knowledge, and Users.',
      'Migrated Users and Invitations to SettingsCrudList — reduced ~1000 lines to consistent config-driven components.',
      'Clickable table rows: tapping any row opens the edit modal (buttons and checkboxes excluded from triggering).',
      'Horizontal scroll arrows on desktop (flanking the table) and mobile (above the table) for all settings tables, Tickets, and Audit Log.',
      'Bulk actions: Tickets now support bulk dismiss with checkboxes. Audit Log now supports bulk delete scoped to the current page.',
      'Audit Log: click any row to view full entry details in a modal. Checkbox select-all resets on page change.',
      'Responsive grid: two-column form layouts collapse to single column on iPhone.',
    ]
  },
  {
    version: 'v0.5.80',
    date: '2026-05-29',
    changes: [
      'Passkey UI is now hidden on non-production domains (localhost, staging) where the WebAuthn RP ID is not configured. Prevents users from hitting an "invalid domain" error when attempting passkey sign-in or registration.',
      'Login page, OTP verification flow, passkey setup prompt, settings sidebar, and passkey settings page all respect the domain check.',
    ]
  },
  {
    version: 'v0.5.79',
    date: '2026-05-29',
    changes: [
      'UnifiedDashboard is now the main dashboard: split-pane Orb + task list with draggable divider replaces the previous ambient-only view. Vertical stack on iPhone, side-by-side on desktop.',
      'Global navigation bar (AppNav): Print, Help, Settings, and Account are now accessible from every page — dashboard, settings, and account. Mobile uses a compact commands button; desktop shows icon buttons in a slim bar.',
      'Orphaned old views: AmbientDashboard and standalone TodoView routes remain available but are no longer the default.',
    ]
  },
  {
    version: 'v0.5.78',
    date: '2026-05-28',
    changes: [
      'Eliminated background polling: removed 60-second interval timer that generated ~15-20 database queries per minute while idle. Data now refreshes only on tab-focus and page-show (wake from sleep). Dramatically reduces Supabase Disk IO usage.',
      'Purged 285 stale auth.flow_state rows (oldest from April) and vacuumed bloated tables.',
    ]
  },
  {
    version: 'v0.5.77',
    date: '2026-05-28',
    changes: [
      'Passkey authentication (admin-only): sign in with Face ID, Touch ID, or device biometric instead of email codes. Passkey-first button on login page, Settings > Passkeys for management, post-OTP enrollment prompt.',
      'Mobile list view (iPhone): todo actions (Edit, Done) now display on the same line as the title instead of wrapping below. Title clamped to 1 line with ellipsis.',
      'Staging environment: orb-staging-azure.vercel.app deploys from staging branch for pre-production testing on any device.',
    ]
  },
  {
    version: 'v0.5.76',
    date: '2026-05-28',
    changes: [
      'Added route loading indicator (app/loading.tsx): breathing orb animation centered on screen during route transitions and initial page load. Uses inline styles for instant render before stylesheets load.',
    ]
  },
  {
    version: 'v0.5.75',
    date: '2026-05-28',
    changes: [
      'Removed quick edit (InlineEditPopover) from list view — full edit modal is the sole edit path.',
      'Fixed OTP cooldown warning flashing briefly during login by deferring cooldown calculation until after hydration, suppressing during loading state, and returning early on success before setLoading(false).',
      'Fixed false-positive maintenance lockout on wake from sleep — middleware, /api/version, and MaintenanceOverlay no longer assume maintenance when network requests fail.',
      'Middleware auth resilience: getUser() retries once after 500ms on failure. Transient auth errors skip login redirect instead of forcing re-authentication.',
    ]
  },
  {
    version: 'v0.5.74',
    date: '2026-05-28',
    changes: [
      'Prototype command bar: Orb toggle now uses the favicon orb icon (radial gradient circle), List toggle uses the grid-table icon from DashboardView. Toggle labels (Show/Hide Orb, Show/Hide List) now visible on all screen sizes.',
      'New todo form now matches the full edit modal — added Description and URLs fields, wired into the database insert.',
      'Edit modal: Description field moved from hidden Details toggle to always-visible, directly below Title.',
      'Next.js dev indicator hidden in production only (preserved in dev for debugging).',
      'Error boundaries: added app/error.tsx (route-level) and app/global-error.tsx (root-level) with Try Again and Refresh buttons.',
      'Error handling audit: added .catch() to all fire-and-forget async calls (push notifications, audit logging, notification dispatch), fixed unchecked Supabase DELETE/SELECT errors in push API and manage-project, fixed unsafe nested await in get-user-detail, added .catch() to all clipboard operations.',
      'DEV panel: added Error Boundaries section with Throw Client Error button for testing error boundaries.',
    ]
  },
  {
    version: 'v0.5.73',
    date: '2026-05-27',
    changes: [
      'Fixed todo list rows not extending full width on iPhone — Actions column header was missing tv-th-actions class, leaving a hidden empty column.',
      'Swapped List toggle and Commands button positions — List is now far right in the command bar.',
      'Project search resilience: retries 2× on empty results, falls back to server-provided projects, shows error with Refresh link, and auto-creates a ticket.',
      'Added close button (×) to the Views bar for discoverability.',
      'List card goes edge-to-edge inside unified dashboard (no border-radius or borders).',
    ]
  },
  {
    version: 'v0.5.72',
    date: '2026-05-27',
    changes: [
      'iPhone command bar redesign: panel toggles (Show/Hide Orb, Show/Hide List) now visible on mobile with centered labels below icons.',
      'Replaced small ⋮ dropdown with a "Commands" button (grid icon + label) that opens a full modal-center floating modal containing Print, Help, Settings, Account.',
      'Project search input centered and wider on mobile (flex: 1 fills available space between toggles).',
      'All mobile command bar button labels (toggles, commands) unified at 10px to match desktop nav-btn-label sizing.',
    ]
  },
  {
    version: 'v0.5.71',
    date: '2026-05-27',
    changes: [
      'Fixed iPhone command bar wrapping: items were stacking vertically instead of staying in a single row. Added flex-wrap: nowrap and restructured for mobile.',
      'Mobile "more" menu: Print, Help, Settings, Account hidden behind a ⋮ menu button on iPhone. Desktop shows them inline as before.',
      'Removed panel toggle buttons on mobile — sidebar toggles are a desktop concept that does not apply to vertical stacking.',
      'Project search input fills available width on mobile instead of being cramped at 120px.',
      'UI Component Catalog: created docs/ui-catalog.md documenting all existing patterns. AGENTS.md updated to enforce catalog-first building.',
    ]
  },
  {
    version: 'v0.5.70',
    date: '2026-05-27',
    changes: [
      'iPhone mobile layout fixes: capped and separated mobile and desktop split-pane size saving in localStorage (using unique key per viewport size).',
      'Hided text labels on panel toggle buttons on mobile screen widths to prevent overcrowding/wrapping.',
      'Designed a responsive thread spacer (.oc-thread-spacer) that shrinks to 60px on mobile to give messages more room.',
      'Compacted command bar padding and gap spacing on mobile viewports.',
      'Restricted search input width on mobile to 120px (140px on focus) to prevent row overflow.',
      'Implemented bottom safe area insets (home indicator bar clearance) on mobile for both conversation panel and task lists.',
    ]
  },
  {
    version: 'v0.5.69',
    date: '2026-05-27',
    changes: [
      'Prototype dashboard: replaced dynamic split-pane toggle icons with static VS Code-style sidebar SVGs.',
      'Added dynamic vertical "Show Orb" / "Hide Orb" and "Show List" / "Hide List" text labels under the layout toggle buttons.',
    ]
  },
  {
    version: 'v0.5.68',
    date: '2026-05-27',
    changes: [
      'Updated AGENTS.md instructions to allow the AI to propose and execute git commit and push commands upon requesting user permission, instead of requiring manual execution.',
    ]
  },
  {
    version: 'v0.5.67',
    date: '2026-05-27',
    changes: [
      'Allowed Super Admins and Admins to insert, update, and delete todos across all projects, and to update and delete projects of other users in Postgres RLS policies.',
      'Ensures both the conversational Orb update_todo tool and the web dashboard UI can successfully edit, close, and delete tasks in other users\' projects without RLS permission constraints.',
    ]
  },
  {
    version: 'v0.5.66',
    date: '2026-05-27',
    changes: [
      'Explicit database grants migration: tightened table permissions — anon gets SELECT only on lookup tables (priorities, statuses, roles, system_settings), authenticated and service_role get CRUD on all user data tables.',
      'Future-proofed with ALTER DEFAULT PRIVILEGES so any new table created via psql automatically gets correct grants without manual intervention.',
      'Prepares for Supabase breaking change (Oct 30, 2026) where new public tables will no longer auto-expose to the Data API.',
    ]
  },
  {
    version: 'v0.5.65',
    date: '2026-05-27',
    changes: [
      'Wrapped all client-side Supabase database queries executing inside useEffect blocks (in AmbientDashboard, UnifiedDashboard, and TodoView) in try/catch and .catch() blocks.',
      'Prevents unhandled runtime errors and uncaught promise rejections from failing network calls on wake-up, ensuring the app handles offline transitions smoothly rather than displaying Next.js developer crash overlays.',
    ]
  },
  {
    version: 'v0.5.64',
    date: '2026-05-27',
    changes: [
      'Added visibilitychange and focus event listeners to the useOnlineStatus hook to trigger immediate connection verification when waking up or focusing the tab.',
      'Prevents stale online status state during sleep/wake transitions, ensuring the custom offline screen displays immediately before browser-level requests occur.',
    ]
  },
  {
    version: 'v0.5.63',
    date: '2026-05-27',
    changes: [
      'Added client-side try/catch wrappers to Server Actions (getUrgencySnapshot, orbGreeting, and notifyIfEscalated) in background loops, mount effects, and click/bulk action handlers.',
      'Prevents unhandled promise rejections when network drops during sleep or wake, allowing the custom OfflinePage overlay to show and recover gracefully.',
      'Fixed a pre-existing React Hook order violation in OfflinePage.tsx by moving the conditional isOnline check after all hook declarations, preventing client-side crashes during offline transitions.',
    ]
  },
  {
    version: 'v0.5.61',
    date: '2026-05-26',
    changes: [
      'Removed project strip from Orb conversation — project selection is now in the command bar search dropdown.',
      'Panel toggle buttons: sidebar icons on command bar edges to show/hide Orb or List pane independently.',
      'Floating edit modal: converted TodoPanel from slide-in panel to centered modal (modal-center).',
      'Admin project search: admins see all projects with owner names in the dropdown; users see only theirs.',
      'Fixed project name font in command bar to use the app font (font-ui) instead of display font.',
    ]
  },
  {
    version: 'v0.5.60',
    date: '2026-05-26',
    changes: [
      'Unified Dashboard (Phase 1): built UnifiedDashboard component merging Orb conversation and task list into a single split-pane view with draggable divider.',
      'DragDivider component: pointer-event-based resizable split with snap points (30/70, 50/50, 70/30), localStorage persistence, and touch-friendly hit targets.',
      'Split layout: vertical stack on iPhone (drag up/down), side-by-side on desktop (drag left/right). Fractal background visible through both panes.',
      'Widened OrbConversation max-width from 420px to 600px so the Orb feels less cramped in the unified layout.',
    ]
  },
  {
    version: 'v0.5.59',
    date: '2026-05-26',
    changes: [
      'Prototype panels layout: integrated app-wide commands (List, Print, Help, Settings, Account) into the desktop topbar.',
      'Zero-Row Project Switcher: replaced the horizontal project pill bar with a project name dropdown trigger directly in the topbar, saving ~48px of vertical screen real estate.',
      'Sleek Switcher UI: implemented a searchable desktop dropdown menu and a responsive touch-first bottom drawer switcher for mobile (iPhone/iPad).',
    ]
  },
  {
    version: 'v0.5.58',
    date: '2026-05-26',
    changes: [
      'Implemented an OTP request cooldown of 60 seconds on the login page to prevent rapid re-requests.',
      'Persisted OTP cooldown state via localStorage, preventing bypasses from page refreshes, tab closures, or back-and-forth navigation.',
      'Replaced state-based countdown polling in render with dynamic time calculation based on a reactive time state to satisfy React Compiler purity and avoid cascading render warnings.',
      'Resolved pre-existing ESLint warnings in the login page (deferred searchParams error checks to avoid cascading renders, and correctly typed standard exceptions).',
    ]
  },
  {
    version: 'v0.5.57',
    date: '2026-05-25',
    changes: [
      'Emergency fix: removed surviving Realtime subscription from AmbientDashboard — postgres_changes WAL reader was consuming excessive disk IO (same root cause as ORB-132, missed in that component).',
      'Reduced background poll interval from 30s to 60s to halve query volume against the database.',
      'Ran VACUUM ANALYZE on bloated tables (projects, todos, knowledge_repo).',
    ]
  },
  {
    version: 'v0.5.56',
    date: '2026-05-25',
    changes: [
      'Prototype: /prototype route — unified command surface with task list and Orb conversation panel side by side.',
      'Desktop: 60/40 split layout — task list on the left, Orb panel with mini Orb sphere on the right.',
      'Mini Orb: breathing gradient sphere with project code arc text and active task count — restores the Orb presence in the panel.',
      'iPhone: full-width task list with a collapsible bottom panel for the Orb (slide-up sheet, 60% height).',
      'Orb panel: streaming conversation, thought indicators, auto-refetch on mutations.',
      'Project selector pill bar for switching between projects without navigation.',
    ]
  },
  {
    version: 'v0.5.54',
    date: '2026-05-25',
    changes: [
      'TodoView list mode: proper HTML table with column headers, select-all checkbox, labeled action buttons (Edit, Quick, Done) with bordered pill styling.',
      'iPhone-first responsive layout: on mobile, actions collapse below the title inside each row — no horizontal scrolling needed. On desktop, actions stay in their own column at the far right.',
      'Title clamped to 2 lines with ellipsis overflow.',
      'Removed status pills and priority from list rows — redundant with filters.',
      'Darkened table header with uppercase labels. Increased row padding for readability.',
      'Project name centered in its own row above the table.',
      'Checklist view rebuilt as a clean table — done-circle and title only, no bulk edits (use list view for bulk operations).',
      'Fixed constant screen refreshing — background poll no longer flashes loading state.',
      'Fixed Safari iOS row borders — uses box-shadow instead of border-bottom for reliable rendering.',
      'Update banner: centered button with "An application update is available" message to its right, replacing the toast notification.',
    ]
  },
  {
    version: 'v0.5.47',
    date: '2026-05-25',
    changes: [
      'Consolidated concurrent `supabase.auth.getUser()` calls in AmbientDashboard on mount to resolve lock acquisition and Navigator LockManager token collisions.',
    ]
  },
  {
    version: 'v0.5.46',
    date: '2026-05-25',
    changes: [
      'Placed the All platform pill first and distinguished it visually using bold text, a dashed border, and a symbol prefix.',
      'Implemented mutual-exclusion selection behavior: selecting All clears other platform selections; selecting any other platform deselects All.',
      'Replaced the toggle Checklist view button with a List Views toggle button that displays a dedicated single-selection views panel below the toolbar.',
    ]
  },
  {
    version: 'v0.5.45',
    date: '2026-05-25',
    changes: [
      'Moved Platforms configuration to Settings using a standardized CRUD list with todo count tracking.',
      'Hooked platform association pills into Todo view/edit panels, updating the todo_platforms join table.',
      'Added a vertical text label under the list/checklist toggle button for clear navigation on mobile/iOS.',
      'Streamlined bulk actions: eliminated the Select button, showing checkboxes permanently on the left of each row.',
      'Rendered the bulk edit bar inline at the top of the todo list card whenever items are selected.',
    ]
  },
  {
    version: 'v0.5.44',
    date: '2026-05-25',
    changes: [
      'Widen desktop search input base width to 300px so "Search projects or owners..." placeholder is fully visible without clipping before click.',
      'Render mobile search input permanently as a full-width row on iPhone above other buttons to display complete search context.',
      'Context-aware search placeholders: Owner (non-admin) placeholder changed to "Search projects..." since they only see their own projects.',
      'Eliminated collapsible completions panel (down arrow completed section) — completed items are now accessed via the status filter.',
      'Implemented database-level pagination (40 tasks per page) for all statuses to optimize DB query and render performance.',
    ]
  },
  {
    version: 'v0.5.43',
    date: '2026-05-25',
    changes: [
      'Fix mobile duplicated search bar and dual scroll toolbars by using client-side isMobile state filtering rather than rendering both and relying on CSS hidden states.',
      'Fix desktop vertical wrapping and alignment bug in TodoView by rendering search input and toolbar as flat siblings in a single flexbox row inside the topbar, aligned via a flex-grow spacer.',
    ]
  },
  {
    version: 'v0.5.42',
    date: '2026-05-25',
    changes: [
      'Separate Mac/desktop actions from mobile HScrollNav wrapping — resolves alignment bugs and search dropdown clipping on desktop.',
      'Maintain optimized horizontal scroll navigation and full-width active search dropdowns on mobile (iPhone).',
    ]
  },
  {
    version: 'v0.5.41',
    date: '2026-05-25',
    changes: [
      'Safari mobile layout fixes for iPhone in TodoView.',
      'Pin the Back link so it is outside of the horizontal scrolling action bar.',
      'Prevent checkbox select buttons from stretching into vertical ovals on multi-line items.',
      'Fix search input dropdowns for projects/owners not opening or rendering on focus by using full-width active overlay on mobile.',
    ]
  },
  {
    version: 'v0.5.38',
    date: '2026-05-25',
    changes: [
      'Settings sidebar now scrolls independently below the version/toggle header — all nav items reachable regardless of viewport height.',
      'Sidebar toggle icon replaced with the standard panel-left icon (vertical bar + three lines) — no longer confused with the back arrow.',
      'Checklist view: removed the todo ID sub-label (e.g. ORB-155) from each row for a cleaner, less cluttered list.',
    ]
  },
  {
    version: 'v0.5.37',
    date: '2026-05-25',
    changes: [
      'Dedicated Ticketing System (ORB-148): Replaced todos-in-TICKETS-project with a proper two-layer model.',
      'New tickets table: ticket_number, type, source, summary, reported_by, status (open/in_progress/closed/dismissed), linked todo_id FK, notification dedup flags.',
      'ticket_id FK added to todos — links engineer work back to the originating ticket.',
      'Status propagation: when a linked todo changes status, the ticket updates automatically and the reporter receives a push + email notification (deduplicated).',
      'Admin UI at Settings → Tickets: table of all tickets, inline Create Todo form, Dismiss with reason.',
      'Welcome email sent on new user onboarding.',
      'One-time migration: 2 historical TICKETS todos moved to tickets table; TICKETS project marked dormant.',
      'RLS: admins have full access; reporters can read their own tickets. All policies use (SELECT auth.uid()) per ORB-131 rules.',
    ]
  },
  {
    version: 'v0.5.36',
    date: '2026-05-25',
    changes: [
      'Performance: Removed Supabase Realtime postgres_changes subscription from TodoView — it was consuming 80% of all database query time (1M+ WAL reads). Tab-focus refetch via useVisibilityRefetch is sufficient for a single-user app.',
    ]
  },
  {
    version: 'v0.5.35',
    date: '2026-05-25',
    changes: [
      'Performance: Added 5 missing indexes to eliminate sequential scans driving Supabase disk I/O budget depletion (ORB-132).',
      'idx_todos_product_status_deleted: partial composite index on (product_id, status) for the standard todo fetch pattern.',
      'idx_todos_status_deleted: partial index on status for admin all-projects queries.',
      'idx_projects_created_by: partial index on created_by to speed up the RLS correlated subquery on todos (was causing 94k seq scans on projects).',
      'idx_audit_log_user_id and idx_audit_log_created_at: indexes for RLS and settings audit view ordering.',
      'Ran VACUUM ANALYZE on 7 bloated tables (system_settings was at 1200% dead rows, projects 270%, public.users 300%).',
    ]
  },
  {
    version: 'v0.5.34',
    date: '2026-05-25',
    changes: [
      'Smooth Orb Transition (ORB-156): Switching between ambient and dialogue mode now fades the orb out briefly before repositioning, then fades back in — eliminating the jarring snap caused by the transform-origin change.',
    ]
  },
  {
    version: 'v0.5.33',
    date: '2026-05-25',
    changes: [
      'Checklist Mode (ORB-155): Projects can now toggle between list view and checklist view. Checklist skin renders todos as a minimal checkbox list — tap to complete/reopen, tap the label to open the detail panel. View mode persists to the database. Toggle appears in the toolbar for all non-global project views.',
    ]
  },
  {
    version: 'v0.5.32',
    date: '2026-05-24',
    changes: [
      'Session Restoration Fix (ORB-154): Restored conversation transcript and state from sessionStorage on mount instead of clearing it, preventing the Orb from starting a new session and re-firing the greeting when navigating back and forth from the dashboard to TodoView.',
    ]
  },
  {
    version: 'v0.5.31',
    date: '2026-05-24',
    changes: [
      'New query_db tool: Orb can now execute read-only database queries via Supabase query builder, eliminating hallucination caused by post-processing large result sets with missing server-side filters.',
      'Supports 8 allowed tables (todos, projects, knowledge_repo, audit_log, statuses, priorities, categories, groups) with declarative JSON filters, ordering, and joins.',
      'Security: table allowlist, column name validation, RLS-scoped for regular users, admin bypass for admins, 200-row cap with truncation flag, auto-filters soft-deleted rows.',
      'Query routing: system prompt now guides Orb to use query_todos for simple lookups and query_db for complex/structural questions (URLs, date ranges, cross-table).',
      'Removed has_urls, has_group, has_category from query_todos — superseded by query_db.',
    ]
  },
  {
    version: 'v0.5.30',
    date: '2026-05-24',
    changes: [
      'UI Alignment Fix (ORB-150): Shifted the top-right navigation bar (.dash-nav) to the left dynamically when the conversation is active (data-mode="dialogue") to prevent it from overlapping with the scaled-down Orb. Added a matching smooth transition curve.',
    ]
  },
  {
    version: 'v0.5.29',
    date: '2026-05-24',
    changes: [
      'Manual Maintenance Mode (ORB-141): Implemented a manual toggle in settings to enable system maintenance.',
      'Ethereal visuals: Designed the Undergoing Maintenance page featuring shooting meteors, a starfield, and the calm pulsing Moonlight Orb with the centered ORB wordmark.',
      'Bypass and Lockouts: Non-admin users are locked out from logging in or using the dashboard when maintenance is active. Admins (role_id 1 or 3) are allowed to bypass the lockout to verify migrations and updates.',
      'Active Sessions Handling: Active sessions show a fullscreen blocking overlay dynamically without logging users out or destroying their session state.',
      'Database integration: Created system_settings database table with composite RLS policies for global configuration.',
      'Optimized checks: Implemented in-memory caching (15-second TTL) in Next.js middleware to check maintenance state without impacting performance.',
      'Audit Trail integration: Added audit trail logging when maintenance mode is enabled or disabled.',
      'Admin notification: Added a top warning banner for logged-in admins to notify them when maintenance mode is active, with a direct shortcut to settings.',
    ]
  },
  {
    version: 'v0.5.28',
    date: '2026-05-24',
    changes: [
      'Fixed PWA navigation: moved back links further to the right in standalone mode on iPad/iPhone (avoiding overlap with window control traffic lights).',
      'Handled safe area insets: updated .tv-topbar padding to support left safe area insets dynamically.',
      'AI search improvements: updated query_todos tool to return all statuses by default and include task owners, category, group, and attached URLs count in the search results.',
      'AI query strategy: injected query strategy rules in system prompts to ensure consistent backlog scoping and verification.',
      'Enriched knowledge context: knowledge repo items shown in the assistant system prompt now link back to their originating tasks where applicable.',
    ]
  },
  {
    version: 'v0.5.24',
    date: '2026-05-24',
    changes: [
      'AI context audit: Orb now maps project owners to user names — can answer "who owns this project?" and match users to their projects.',
      'Todos now include group, category, and URL count in AI context for richer answers.',
      'Priority urgency flags visible to AI — Orb knows which priority levels trigger the urgent state.',
      'Knowledge repo tags and audit log actor field now included in AI context.',
    ]
  },
  {
    version: 'v0.5.23',
    date: '2026-05-24',
    changes: [
      'Eliminated the tickets system — feedback (bugs, suggestions, capability gaps, workflow friction) is now stored as todos in a dedicated Tickets project instead of a separate tickets table. Simplifies the data model and makes feedback visible alongside regular project work.',
      'Removed Settings → Tickets page and sidebar link. Friction log "Create Todo" now generates todos directly.',
      'Expanded AI context (ORB-146): Orb now sees categories, groups, roles, platforms, friction logs, invitations, and users. Truncated data shows "X of Y" counts for transparency.',
      'Removed the inline query results mini-list from conversation responses — all task data is now presented conversationally for consistent, deterministic output.',
    ]
  },
  {
    version: 'v0.5.22',
    date: '2026-05-23',
    changes: [
      'Project codes are now unique per user instead of globally unique — multiple users can create projects with common codes like TEST or WORK without naming collisions (ORB-144).',
      'REST API now supports X-User-Id and X-User-Email headers to scope project lookups when codes are shared across users.',
      'Orb AI project operations (update, delete, dormancy, move) now resolve projects within the current user\'s scope.',
    ]
  },
  {
    version: 'v0.5.21',
    date: '2026-05-23',
    changes: [
      'Conversational project name referencing: updated the conversational Orb system prompt to enforce referring to projects by their display names (e.g. "Orb") rather than system codes (e.g. "ORB") in responses to the user, while preserving tool parameters requirements.',
    ]
  },
  {
    version: 'v0.5.20',
    date: '2026-05-23',
    changes: [
      'Optional project code with auto-generation: project code is now optional when creating a project. If omitted, a unique uppercase alphanumeric code is automatically generated from the project name, resolving code conflicts by appending a unique counter (ORB-143).',
    ]
  },
  {
    version: 'v0.5.19',
    date: '2026-05-23',
    changes: [
      'Smart project default for ticket conversion: ticket todo generation now defaults to the ORB project if available in the projects list (preventing auto-creating tickets in the first alphabetically sorted project).',
    ]
  },
  {
    version: 'v0.5.18',
    date: '2026-05-23',
    changes: [
      'Admin project search: admins can now search and navigate to any user\'s project from the TodoView topbar (ORB-138).',
      'Login speed improvements: OTP reduced from 8 to 6 digits, added "Signing in…" feedback after verification, optimized TodoView to only fetch active todos by default — closed todos load on demand (ORB-139).',
      'Dashboard nav labels: all icon buttons now show visible text labels (List, Print, Help, Settings, Account). Tooltips restored (ORB-140).',
    ]
  },
  {
    version: 'v0.5.17',
    date: '2026-05-23',
    changes: [
      'New: Print / Export PDF — generate a complete printable backlog export from the dashboard. Supports All Projects or Current Project scope. Includes all todos (active, parked, closed) with full descriptions, resolution notes, and dates.',
      'Fixed: Creating a project then immediately adding a todo in the same Orb conversation turn no longer fails with "product not found" (ORB-136).',
    ]
  },
  {
    version: 'v0.5.16',
    date: '2026-05-22',
    changes: [
      'Fixed settings topbar overlap with iPad Stage Manager window controls (safe-area left inset).',
      'Added viewport-fit: cover for proper safe-area support on all devices.',
      'Auth resilience: stale sessions now show a toast and redirect to login instead of failing silently.',
    ]
  },
  {
    version: 'v0.5.15',
    date: '2026-05-22',
    changes: [
      'Replaced three-dot quick-edit trigger with a lightning bolt icon for clarity.',
      'Added pencil icon button to open the full detail panel — row tap action is now visually discoverable.',
      'All row action buttons (edit, quick edit, close) are now always visible instead of hover-only.',
      'Strengthened the close/done toggle visibility — thicker border and tooltip added.',
      'Fixed RLS initplan policies across all tables to reduce Supabase disk I/O usage.',
    ]
  },
  {
    version: 'v0.5.14',
    date: '2026-05-21',
    changes: [
      'Added inline task metadata editing in list view — right-click or tap the three-dot icon to quick-edit status, priority, and due date without opening the detail panel.',
      'Auto-saves each field change immediately with audit logging and urgency checks.',
      'Responsive popover positioning: anchored to the row on desktop, bottom sheet on narrow screens (iPhone).',
      'Touch-friendly: three-dot trigger always visible on touch devices, 36px minimum hit targets on chips.',
    ]
  },
  {
    version: 'v0.5.13',
    date: '2026-05-21',
    changes: [
      'Relocated all toast notifications to the top of the viewport globally, sliding down from top-center.'
    ]
  },
  {
    version: 'v0.5.12',
    date: '2026-05-21',
    changes: [
      'Implemented auto-refreshing version update banner with notification toast.',
      'Added the "What\'s New" settings screen to show release history.',
      'Integrated manual version update simulation to the developer panel.',
      'Removed obsolete offline banner, consolidating offline checks directly into the breathing Julia fractal page.'
    ]
  },
  {
    version: 'v0.5.11',
    date: '2026-05-21',
    changes: [
      'Aligned urgency notification thresholds with custom user database-backed values.',
      'Added periodic re-evaluation for time-based due dates in the dashboard (every 60s).',
      'Refactored server action urgency escalation checks.'
    ]
  },
  {
    version: 'v0.5.10',
    date: '2026-05-18',
    changes: [
      'Implemented dashboard service worker registration and push client.',
      'Fixed state rendering transitions for offline indicators.'
    ]
  }
]
