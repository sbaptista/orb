import { getOrbModelDefinition } from './catalog'
import type { OrbRouteRole } from './routing'
import type { OrbModelProviderId } from './types'

const PROVIDER_DISPLAY_NAMES: Record<OrbModelProviderId, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  moonshot: 'Moonshot',
  openai: 'OpenAI',
  elevenlabs: 'ElevenLabs',
  local: 'the local runtime',
}

/**
 * Keep this intentionally narrow. Questions about model recommendations or
 * capabilities still belong to the conversational model; only direct requests
 * for Orb's currently selected identity are server-stamped.
 */
export function isActiveModelIdentityQuestion(input: string): boolean {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/g, '')
    .replace(/\s+/g, ' ')

  return /^(?:what|which) (?:ai )?model (?:are you|are you using|are you running|do you use|is orb using|is orb running|is active|is selected)$/.test(normalized)
}

export function activeModelIdentitySpeech(options: {
  provider: OrbModelProviderId
  model: string
  role: OrbRouteRole
  environment: 'development' | 'production'
}): string {
  const definition = getOrbModelDefinition(options.provider, options.model)
  const modelName = definition?.label.replace(/\s+—\s+Experimental$/i, '') ?? options.model
  const providerName = PROVIDER_DISPLAY_NAMES[options.provider]
  const roleName = options.role === 'strategic' ? 'Strategic' : 'Operational'
  const environmentName = options.environment === 'production' ? 'production' : 'development'

  return `In this ${environmentName} environment, Orb's ${roleName} model is currently ${modelName} from ${providerName}. This status answer is generated directly by Orb so it always reflects this environment's active setting.`
}
