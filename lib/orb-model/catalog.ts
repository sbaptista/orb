import type { OrbModelProviderId } from './types'

export type OrbModelRole = 'operational' | 'strategic' | 'voice'
export type OrbModelCatalogRole = OrbModelRole | 'evaluation'

export type OrbModelDefinition = {
  provider: OrbModelProviderId
  model: string
  label: string
  roles: readonly OrbModelCatalogRole[]
  toolCapable: boolean
  /** Accounting pool used when a provider statement row is assigned to this model. */
  fundingPoolKey: string
  experimental?: boolean
}

// Production entries have a production adapter, normalized telemetry, and a
// completed evaluation decision. An explicitly experimental entry may appear
// in local development while those gates are being run, but is filtered out of
// production Settings and policy validation until promoted.
export const ORB_MODEL_CATALOG: readonly OrbModelDefinition[] = [
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    roles: ['operational', 'strategic', 'evaluation'],
    toolCapable: true,
    fundingPoolKey: 'anthropic_api',
  },
  {
    provider: 'google',
    model: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    roles: ['strategic'],
    toolCapable: false,
    fundingPoolKey: 'google_cloud_historical',
  },
  {
    provider: 'moonshot',
    model: 'kimi-k3',
    label: 'Kimi K3 — Experimental',
    roles: ['operational', 'strategic', 'evaluation'],
    toolCapable: true,
    fundingPoolKey: 'moonshot_api',
    experimental: true,
  },
]

function isAvailable(model: OrbModelDefinition): boolean {
  return !model.experimental || process.env.NODE_ENV !== 'production'
}

export function getOrbModelOptions(role: OrbModelCatalogRole): readonly OrbModelDefinition[] {
  return ORB_MODEL_CATALOG.filter(model => isAvailable(model) && model.roles.includes(role))
}

export function getOrbModelDefinition(provider: string, model: string): OrbModelDefinition | undefined {
  return ORB_MODEL_CATALOG.find(candidate => candidate.provider === provider && candidate.model === model)
}

export function supportsOrbRole(provider: string, model: string, role: OrbModelCatalogRole): boolean {
  const definition = getOrbModelDefinition(provider, model)
  return definition ? isAvailable(definition) && definition.roles.includes(role) : false
}
