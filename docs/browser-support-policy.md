# Browser Support Policy

Orb supports four representative modern browser families:

- **Safari** — Apple/WebKit
- **Chrome** — Google/Chromium
- **Edge** — Microsoft/Chromium
- **Firefox** — Mozilla/open source

Core application workflows must function on all four. Platform-specific browser APIs may differ, so support does not mean pretending every browser exposes the same native capability. Features must use capability detection and provide an honest fallback when a supported browser lacks a required API.

Examples:

- Passkeys and push notifications may present their established email or in-app fallback when the browser/OS combination lacks the native API.
- Full voice conversation must work on all four supported browsers. Native `SpeechRecognition` is used where available; Firefox records each utterance locally and sends it to Orb's authenticated server-transcription endpoint. Recordings are processed in memory and are not stored.
- A feature must not silently disappear or claim success when its underlying capability is unavailable. The UI should explain the limitation and offer the supported alternative.

Browser-specific quality work is tested on applicable Mac, iPad, and iPhone combinations. Browsers outside this list may work through standards-compatible behavior but are not part of the required verification matrix.
