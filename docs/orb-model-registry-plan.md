# Runtime Model Registry — follow-on plan

**Status:** Proposed follow-on to ORB-373. No runtime activation code is included in ORB-373.

## Verified current state

- AI Settings cannot register or activate a model. Its two role selectors are generated from the hard-coded `ORB_MODEL_CATALOG`.
- Saving a role assignment is rejected unless the provider/model/role combination already exists in that catalog.
- Adding a Rate Card in AI Metrics adds accounting metadata only. It does not add an adapter, credentials, model capability, or role option.
- Serial Orb has one production Anthropic execution path and one special no-tools Gemini strategic path. The Mistral adapter is evaluation-only and is not in the production catalog.
- Realtime voice is a separate OpenAI session path with its model and `marin` voice currently fixed server-side.
- OpenAI TTS and ElevenLabs remain available to the legacy serial voice/TTS path and Settings previews. The main Orb tap starts Realtime and bypasses that TTS selection. Nothing is removed by this plan.

### Verified usage evidence, 2026-07-31

The request ledger showed current production activity for Anthropic conversation (827 requests,
last used July 31), OpenAI Realtime (243, July 30), Anthropic eval (3,167, July 30), Google eval
(281, July 30), OpenAI speech-to-text (36, July 24), ElevenLabs TTS (538, July 20), OpenAI
`tts-1` (664, July 19), and Google strategic (33, July 13). Mistral showed 73 evaluation
requests, last used June 24, and no production-runtime role. Saved legacy TTS preferences still
referenced ElevenLabs for two users and OpenAI for one. These counts are audit evidence, not
authorization to remove any path.

## Product boundary

“Import a model” means **register a reachable inference endpoint and qualify one of its model identifiers**. Orb will not upload or host model weights.

- Cloud or hosted open-source model: register an HTTPS endpoint.
- OpenAI-compatible service: first provider-neutral target because many commercial and open-source hosts expose that contract.
- Ollama or LM Studio on one Mac: development-only unless production Orb receives a secure route to that machine. Vercel cannot call a private localhost endpoint.

## Proposed Settings flow

Add **Model Registry** to AI Settings, separate from AI Metrics financial providers.

1. **New Model** opens the canonical `EditorModal`.
2. Choose adapter type: Anthropic, Gemini, OpenAI-compatible, or OpenAI Realtime.
3. Enter display name, model identifier, endpoint where applicable, and a server-side credential reference.
4. Test connection.
5. Run compatibility checks appropriate to the intended role:
   - basic completion and streaming
   - structured tool call and tool-result continuation for Operational
   - tool-free strategic response for Strategic
   - usage/token normalization
   - timeout, cancellation, and error classification
6. Run the relevant Orb eval subset. A model cannot become Active until the gate is recorded as passing.
7. Assign an Active model to Operational, Strategic, or Voice. Preserve the prior assignment for one-click rollback.

The list uses the canonical Settings CRUD/mobile-card and `EditorModal` patterns: New, Edit, Test, Activate/Deactivate, and a visible qualification state. Rate information is linked from the model but remains financial metadata in AI Metrics.

## Data model

### `orb_model_connections`

- adapter type
- base URL where applicable
- credential reference, never the plaintext secret
- enabled state and last connection-test result

### `orb_model_registry`

- connection, provider, model identifier, display name
- supported roles
- tool-capable flag and normalized capabilities
- context/output limits when known
- lifecycle state: draft, tested, qualified, active, retired
- latest qualification/eval record
- optional linked rate-card model key

### `orb_model_role_assignments`

- one active assignment per role
- previous registry entry for rollback
- activation actor and timestamp

No Realtime database subscription is needed. Reads occur during Settings load and policy resolution; writes occur only during explicit registration, test-result recording, and activation.

## Runtime refactor required

The serial runtime must stop treating “not Gemini strategic” as “Anthropic.” It needs a provider-neutral execution interface covering streaming text, tool calls, usage, cancellation, and classified failures. Each registry adapter implements that interface. Realtime remains a distinct adapter because session audio and voice choice are not ordinary chat-completion behavior.

Activation must fail closed if the model is unqualified, its connection is disabled, required credentials are unavailable, or its declared capability does not satisfy the role.

## Evaluation requirement

This changes Orb conversation routing and model capability, so its implementation must add/update matching cases in `scripts/eval-cases.ts`. Operational qualification should run the reduced tool-coverage suite plus provider-specific contract checks; Strategic should run the strategic route subset; Realtime should use its voice capability checks. One passing request is not qualification.

## Retirement audit before removal

Before retiring Mistral, OpenAI TTS, or ElevenLabs:

1. Query actual request-ledger use by model/source and last-use date.
2. Identify every remaining UI and fallback call site.
3. Decide whether Settings previews and the legacy serial voice path remain supported.
4. Remove only with Stan's explicit approval, migration/cleanup instructions, catalog updates, and matching regression coverage.
