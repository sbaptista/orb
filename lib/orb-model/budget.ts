import 'server-only'

import type { OrbAiPolicy } from './policy'
import type { OrbModelRole } from './catalog'

type BudgetScope = 'monthly' | OrbModelRole

export type OrbBudgetCheck = {
  allowed: boolean
  scope?: BudgetScope
  role: OrbModelRole
  spentUsd: number
  limitUsd: number
  totalSpentUsd: number
  totalLimitUsd: number
  totalSource: 'ledger'
}

function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    today: now.toISOString().slice(0, 10),
  }
}

function asAmount(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

/**
 * Budget enforcement uses Orb's app-specific request ledger. Provider bill
 * reconciliation is reporting context only; it can include external AI tools
 * and cannot safely be attributed to a role after the fact.
 */
export async function checkOrbBudget(admin: any, policy: OrbAiPolicy, role: OrbModelRole): Promise<OrbBudgetCheck> {
  const window = monthWindow()
  const { data: requests, error: requestsError } = await admin
    .from('orb_model_requests')
    .select('route_role, estimated_cost_usd')
    .eq('success', true)
    .neq('source', 'eval')
    .is('evaluation_case_id', null)
    .gte('created_at', window.start)
    .lt('created_at', window.end)

  if (requestsError) throw requestsError

  const ledgerByRole = new Map<OrbModelRole, number>([
    ['operational', 0],
    ['strategic', 0],
  ])
  let totalSpentUsd = 0
  for (const request of requests ?? []) {
    const amount = asAmount(request.estimated_cost_usd)
    totalSpentUsd += amount
    const requestRole = request.route_role === 'strategic' ? 'strategic' : 'operational'
    ledgerByRole.set(requestRole, (ledgerByRole.get(requestRole) ?? 0) + amount)
  }

  const roleSpentUsd = ledgerByRole.get(role) ?? 0
  const roleLimitUsd = role === 'strategic' ? policy.strategicBudgetUsd : policy.operationalBudgetUsd

  if (totalSpentUsd >= policy.monthlyBudgetUsd) {
    return { allowed: false, scope: 'monthly', role, spentUsd: totalSpentUsd, limitUsd: policy.monthlyBudgetUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource: 'ledger' }
  }
  if (roleSpentUsd >= roleLimitUsd) {
    return { allowed: false, scope: role, role, spentUsd: roleSpentUsd, limitUsd: roleLimitUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource: 'ledger' }
  }
  return { allowed: true, role, spentUsd: roleSpentUsd, limitUsd: roleLimitUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource: 'ledger' }
}

export function budgetBlockMessage(check: OrbBudgetCheck): string {
  if (check.scope === 'strategic') {
    return 'Strategic reads have reached this month\'s allowance. Everyday task help remains available.'
  }
  if (check.scope === 'operational') {
    return 'Orb\'s operational AI allowance has been reached. You can still manage tasks directly in the list.'
  }
  return 'Orb\'s monthly AI budget has been reached. The task list remains available while the budget is adjusted or the next period begins.'
}
