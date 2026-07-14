# Browser Support Policy

Orb's required support and release-verification matrix covers three modern browser families:

- **Safari** — Apple/WebKit
- **Chrome** — Google/Chromium
- **Edge** — Microsoft/Chromium

Core application workflows must function on all three. Platform-specific browser APIs may differ, so support does not mean pretending every browser exposes the same native capability. Features must use capability detection and provide an honest fallback when a supported browser lacks a required API.

**Firefox is temporarily outside the supported matrix.** Its standards-compatible text workflows may continue to work, and Orb retains the existing experimental voice fallback, but Firefox voice is not a release gate. Repeated Realtime/WebRTC tests stopped detecting microphone input after a few exchanges without emitting a provider speech event, leaving application watchdogs unable to recover. Follow-up is tracked by ORB-330; Firefox returns to this list only after sustained multi-turn acceptance.

Examples:

- Passkeys and push notifications may present their established email or in-app fallback when the browser/OS combination lacks the native API.
- Full voice conversation must work on Safari, Chrome, and Edge. Native `SpeechRecognition` is used where available.
- A feature must not silently disappear or claim success when its underlying capability is unavailable. The UI should explain the limitation and offer the supported alternative.

Browser-specific quality work is tested on applicable Mac, iPad, and iPhone combinations. Browsers outside this list may work through standards-compatible behavior but are not part of the required verification matrix.
