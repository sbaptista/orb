import { ANTHROPIC_HAIKU_REFERENCE_MODEL } from './anthropic'

// Database and unavailable-policy fallback for the independently configured
// Evaluation role. Routine runs resolve the persisted selection in AI Settings;
// EVAL_PROVIDER/EVAL_MODEL remains an explicit paired override for one run.
export const ORB_EVAL_DEFAULT_PROVIDER = 'anthropic' as const
export const ORB_EVAL_DEFAULT_MODEL = ANTHROPIC_HAIKU_REFERENCE_MODEL
