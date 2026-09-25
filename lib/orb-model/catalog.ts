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
}

// Role membership means the model has an Orb adapter for that execution
// contract. Qualification evidence belongs in the request/eval ledgers rather
// than a catalog flag that silently hides a model by environment.
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
    roles: ['operational', 'strategic', 'evaluation'],
    toolCapable: true,
    fundingPoolKey: 'google_cloud_historical',
  },
  {
    provider: 'moonshot',
    model: 'kimi-k3',
    label: 'Kimi K3',
    roles: ['operational', 'strategic', 'evaluation'],
    toolCapable: true,
    fundingPoolKey: 'moonshot_api',
  },
  {
    provider: 'openai',
    model: 'gpt-realtime-2.1-mini',
    label: 'GPT Realtime 2.1 Mini',
    roles: ['voice'],
    toolCapable: false,
    fundingPoolKey: 'openai_api',
  },
  {
    provider: 'openai',
    model: 'gpt-realtime-2.1',
    label: 'GPT Realtime 2.1',
    roles: ['voice'],
    toolCapable: false,
    fundingPoolKey: 'openai_api',
  },
]

export function getOrbModelOptions(role: OrbModelCatalogRole): readonly OrbModelDefinition[] {
  return ORB_MODEL_CATALOG.filter(model => model.roles.includes(role))
}

export function getOrbModelDefinition(provider: string, model: string): OrbModelDefinition | undefined {
  return ORB_MODEL_CATALOG.find(candidate => candidate.provider === provider && candidate.model === model)
}

export function supportsOrbRole(provider: string, model: string, role: OrbModelCatalogRole): boolean {
  const definition = getOrbModelDefinition(provider, model)
  return definition ? definition.roles.includes(role) : false
}
