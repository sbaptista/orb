export type OrbRouteRole = 'operational' | 'strategic'

// This boundary is intentionally conservative. Gemini is an adviser, not an
// invisible catch-all: it is selected only for a direct request to think
// strategically, never for a request that could change the backlog.
const STRATEGIC_READ = /\b(?:strategic (?:read|advice|guidance)|what should i (?:do|work on|focus on)|what(?:'s| is) (?:the )?(?:best|right) (?:next )?(?:step|priority)|prioriti[sz]e|workload balance|trade[- ]?off|plan my (?:day|week)|help me decide)\b/i
const MUTATION_INTENT = /\b(?:create|add|file|log|update|change|rename|close|complete|delete|remove|move|archive|defer|park|wake|sleep)\b/i

export function isExplicitStrategicRead(input: string): boolean {
  return STRATEGIC_READ.test(input) && !MUTATION_INTENT.test(input)
}

export function routeOrbRequest(input: string, routingEnabled: boolean, strategicReadsEnabled: boolean): OrbRouteRole {
  return routingEnabled && strategicReadsEnabled && isExplicitStrategicRead(input)
    ? 'strategic'
    : 'operational'
}
