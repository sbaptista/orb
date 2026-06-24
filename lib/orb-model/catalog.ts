import type { OrbModelProviderId } from './types'

export type OrbModelRole = 'operational' | 'strategic'

export type OrbModelDefinition = {
  provider: OrbModelProviderId
  model: string
  label: string
  roles: readonly OrbModelRole[]
  toolCapable: boolean
}

// This is a catalog of models that have a production adapter, normalized
// telemetry, and a completed evaluation decision. Additions belong here only
// after those three conditions are true; Settings must never expose a model
// that Orb cannot safely run.
export const ORB_MODEL_CATALOG: readonly OrbModelDefinition[] = [
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    roles: ['operational', 'strategic'],
    toolCapable: true,
  },
  {
    provider: 'google',
    model: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    roles: ['strategic'],
    toolCapable: false,
  },
]

export function getOrbModelOptions(role: OrbModelRole): readonly OrbModelDefinition[] {
  return ORB_MODEL_CATALOG.filter(model => model.roles.includes(role))
}

export function getOrbModelDefinition(provider: string, model: string): OrbModelDefinition | undefined {
  return ORB_MODEL_CATALOG.find(candidate => candidate.provider === provider && candidate.model === model)
}

export function supportsOrbRole(provider: string, model: string, role: OrbModelRole): boolean {
  return getOrbModelDefinition(provider, model)?.roles.includes(role) ?? false
}
