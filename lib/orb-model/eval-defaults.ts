import { ANTHROPIC_HAIKU_REFERENCE_MODEL } from './anthropic'

// The routine eval suite is the production gate, so by default it must exercise
// the model production actually runs (app/actions/orb-converse.ts →
// claude-haiku-4-5). Gating Haiku's behavior on another model's tool choices
// proves nothing in either direction.
//
// Gemini/Mistral remain fully available for deliberate strategic-quality or
// token-cost comparisons via EVAL_PROVIDER/EVAL_MODEL or a per-case
// provider/model override (ORB-334). These defaults are provider-neutral and
// deliberately do not live in any one provider's module.
export const ORB_EVAL_DEFAULT_PROVIDER = 'anthropic' as const
export const ORB_EVAL_DEFAULT_MODEL = ANTHROPIC_HAIKU_REFERENCE_MODEL
