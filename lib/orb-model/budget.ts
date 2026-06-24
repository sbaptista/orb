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
  totalSource: 'ledger' | 'reconciled' | 'mixed'
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
 * Uses actual provider reconciliation only when it covers the current month
 * through today. Role budgets always retain ledger attribution: a single
 * provider may intentionally serve both roles, so an invoice cannot safely be
 * split between them after the fact.
 */
export async function checkOrbBudget(admin: any, policy: OrbAiPolicy, role: OrbModelRole): Promise<OrbBudgetCheck> {
  const window = monthWindow()
  const [{ data: requests, error: requestsError }, { data: reconciliations, error: reconciliationsError }] = await Promise.all([
    admin
      .from('orb_model_requests')
      .select('provider, route_role, estimated_cost_usd')
      .eq('success', true)
      .neq('source', 'eval')
      .is('evaluation_case_id', null)
      .gte('created_at', window.start)
      .lt('created_at', window.end),
    admin
      .from('orb_cost_reconciliations')
      .select('provider, period_start, period_end, actual_orb_cost_usd, created_at')
      .lte('period_start', window.startDate)
      .gte('period_end', window.today)
      .order('created_at', { ascending: false }),
  ])

  if (requestsError) throw requestsError
  if (reconciliationsError) throw reconciliationsError

  const ledgerByProvider = new Map<string, number>()
  const ledgerByRole = new Map<OrbModelRole, number>([
    ['operational', 0],
    ['strategic', 0],
  ])
  for (const request of requests ?? []) {
    const amount = asAmount(request.estimated_cost_usd)
    ledgerByProvider.set(request.provider, (ledgerByProvider.get(request.provider) ?? 0) + amount)
    const requestRole = request.route_role === 'strategic' ? 'strategic' : 'operational'
    ledgerByRole.set(requestRole, (ledgerByRole.get(requestRole) ?? 0) + amount)
  }

  const reconciliationByProvider = new Map<string, number>()
  for (const reconciliation of reconciliations ?? []) {
    if (!reconciliationByProvider.has(reconciliation.provider)) {
      reconciliationByProvider.set(reconciliation.provider, asAmount(reconciliation.actual_orb_cost_usd))
    }
  }

  let totalSpentUsd = 0
  let hasLedger = false
  let hasReconciled = false
  const providers = new Set([...ledgerByProvider.keys(), ...reconciliationByProvider.keys()])
  for (const provider of providers) {
    if (reconciliationByProvider.has(provider)) {
      totalSpentUsd += reconciliationByProvider.get(provider) ?? 0
      hasReconciled = true
    } else {
      totalSpentUsd += ledgerByProvider.get(provider) ?? 0
      hasLedger = true
    }
  }

  const totalSource = hasLedger && hasReconciled ? 'mixed' : hasReconciled ? 'reconciled' : 'ledger'
  const roleSpentUsd = ledgerByRole.get(role) ?? 0
  const roleLimitUsd = role === 'strategic' ? policy.strategicBudgetUsd : policy.operationalBudgetUsd

  if (totalSpentUsd >= policy.monthlyBudgetUsd) {
    return { allowed: false, scope: 'monthly', role, spentUsd: totalSpentUsd, limitUsd: policy.monthlyBudgetUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource }
  }
  if (roleSpentUsd >= roleLimitUsd) {
    return { allowed: false, scope: role, role, spentUsd: roleSpentUsd, limitUsd: roleLimitUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource }
  }
  return { allowed: true, role, spentUsd: roleSpentUsd, limitUsd: roleLimitUsd, totalSpentUsd, totalLimitUsd: policy.monthlyBudgetUsd, totalSource }
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
