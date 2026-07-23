import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ORB_AI_POLICY, type OrbAiPolicy } from './policy'
import { mapPolicy } from './ai-settings-core'

/**
 * Read the control-plane policy on every conversation. This is a single
 * primary-key lookup, and immediate application matters more than caching a
 * toggle that an administrator may have just changed.
 */
export async function getRuntimeOrbAiPolicy(): Promise<OrbAiPolicy> {
  const { data, error } = await createAdminClient()
    .from('orb_ai_policy')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[orbModel] Could not load routing policy; retaining operational-only routing:', error.message)
    return DEFAULT_ORB_AI_POLICY
  }

  return mapPolicy(data)
}
