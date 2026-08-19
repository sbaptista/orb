'use server'

import { createHash, randomUUID } from 'node:crypto'
import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { getOrbModelDefinition, ORB_MODEL_CATALOG } from '@/lib/orb-model/catalog'

const FINANCIAL_KINDS = ['top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration'] as const
export type FinancialKind = typeof FINANCIAL_KINDS[number]
export type ImportDisposition = 'include' | 'exclude' | 'review'

export type FinancialPoolOption = {
  id: string
  poolKey: string
  provider: string
  displayName: string
  fundingMode: 'prepaid_credit' | 'subscription_quota' | 'subscription_cash'
  recurringCostUsd: number | null
  active: boolean
}

export type FinancialModelOption = {
  key: string
  provider: string
  model: string
  label: string
  poolKey: string
  poolAvailable: boolean
  experimental: boolean
}

export type FinancialImportSourceRow = {
  rowNumber: number
  date: string
  company: string
  amountUsd: number
  type: string
  model?: string
  notes?: string
  externalReference?: string
}

export type FinancialImportPreviewRow = FinancialImportSourceRow & {
  modelKey: string | null
  kind: FinancialKind | null
  poolKey: string | null
  disposition: ImportDisposition
  recognized: boolean
  duplicate: boolean
  duplicateReason: 'fingerprint' | 'external_reference' | null
  occurrence: number
  fingerprint: string
  rememberDecision: boolean
  allowDuplicate: boolean
}

function financialModelKey(provider: string, model: string) {
  return `${provider}:${model}`
}

function resolveFinancialModel(model: string | undefined, poolKey: string | null) {
  const normalized = model?.trim().toLowerCase()
  if (normalized) {
    const exact = ORB_MODEL_CATALOG.find(option =>
      option.model.toLowerCase() === normalized
      || option.label.toLowerCase() === normalized
      || financialModelKey(option.provider, option.model).toLowerCase() === normalized)
    if (exact) return exact
  }
  const poolModels = ORB_MODEL_CATALOG.filter(option => option.fundingPoolKey === poolKey)
  return poolModels.length === 1 ? poolModels[0] : undefined
}

export type FinancialTransaction = {
  id: string
  transactionDate: string
  company: string
  amountUsd: number
  kind: FinancialKind
  poolKey: string
  poolName: string
  model: string | null
  notes: string | null
  imported: boolean
  createdAt: string
}

function normalizeDescriptor(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeKind(value: string): FinancialKind | null {
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  if (['credit', 'credit invoice', 'top up', 'topup', 'auto charge', 'autocharge', 'one off credit', 'prepaid funding'].includes(normalized)) return 'top_up'
  if (['subscription', 'monthly', 'monthly invoice', 'yearly', 'yearly invoice', 'annual', 'annual invoice'].includes(normalized)) return 'subscription'
  if (['grant', 'credit grant', 'free credit'].includes(normalized)) return 'grant'
  if (normalized === 'refund') return 'refund'
  if (['adjustment', 'manual adjustment'].includes(normalized)) return 'adjustment'
  if (['expiration', 'expired credit', 'credit expiration'].includes(normalized)) return 'expiration'
  return null
}

function fingerprintRow(row: FinancialImportSourceRow) {
  const canonical = [
    row.date,
    normalizeDescriptor(row.company),
    Number(row.amountUsd).toFixed(2),
    row.type.trim().toLowerCase(),
    row.model?.trim().toLowerCase() ?? '',
    row.notes?.trim().toLowerCase() ?? '',
    row.externalReference?.trim().toLowerCase() ?? '',
  ].join('|')
  return createHash('sha256').update(canonical).digest('hex')
}

function validateSourceRow(row: FinancialImportSourceRow) {
  if (!Number.isInteger(row.rowNumber) || row.rowNumber < 1) throw new Error('Every import row needs its source row number.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Row ${row.rowNumber}: date must be YYYY-MM-DD.`)
  if (!row.company?.trim()) throw new Error(`Row ${row.rowNumber}: company is required.`)
  if (!Number.isFinite(Number(row.amountUsd)) || Number(row.amountUsd) === 0) throw new Error(`Row ${row.rowNumber}: cost must be a non-zero number.`)
  if (!row.type?.trim()) throw new Error(`Row ${row.rowNumber}: type is required.`)
}

export async function getFinancialImportSetup(): Promise<{ pools: FinancialPoolOption[]; models: FinancialModelOption[] }> {
  const ctx = await requireAdmin()
  const { data, error } = await ctx.admin
    .from('orb_ai_funding_pools')
    .select('id, pool_key, provider, display_name, funding_mode, recurring_cost_usd, active')
    .order('active', { ascending: false })
    .order('sort_order')
  if (error) throw error
  const pools = (data ?? []).map(row => ({
      id: row.id,
      poolKey: row.pool_key,
      provider: row.provider,
      displayName: row.display_name,
      fundingMode: row.funding_mode,
      recurringCostUsd: row.recurring_cost_usd == null ? null : Number(row.recurring_cost_usd),
      active: row.active,
    }))
  const poolKeys = new Set(pools.map(pool => pool.poolKey))
  return {
    pools,
    models: ORB_MODEL_CATALOG.map(option => ({
      key: financialModelKey(option.provider, option.model),
      provider: option.provider,
      model: option.model,
      label: option.label,
      poolKey: option.fundingPoolKey,
      poolAvailable: poolKeys.has(option.fundingPoolKey),
      experimental: Boolean(option.experimental),
    })).sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export async function previewFinancialImport(rows: FinancialImportSourceRow[]): Promise<FinancialImportPreviewRow[]> {
  const ctx = await requireAdmin()
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 2000) throw new Error('Choose a CSV containing between 1 and 2,000 data rows.')
  rows.forEach(validateSourceRow)

  const prepared = rows.map(row => ({ ...row, kind: normalizeKind(row.type), fingerprint: fingerprintRow(row) }))
  const descriptors = Array.from(new Set(prepared.map(row => normalizeDescriptor(row.company))))
  const { data: rules, error: rulesError } = await ctx.admin
    .from('orb_financial_descriptor_rules')
    .select('normalized_descriptor, match_kind, disposition, pool_key, transaction_kind')
    .in('normalized_descriptor', descriptors)
  if (rulesError) throw rulesError

  const ruleMap = new Map((rules ?? []).map(rule => [`${rule.normalized_descriptor}|${rule.match_kind}`, rule]))
  const existingPairs = new Set<string>()
  const existingReferences = new Set<string>()
  const fingerprints = Array.from(new Set(prepared.map(row => row.fingerprint)))
  for (let start = 0; start < fingerprints.length; start += 100) {
    const { data, error } = await ctx.admin
      .from('orb_financial_transactions')
      .select('source_fingerprint, source_occurrence, external_reference')
      .in('source_fingerprint', fingerprints.slice(start, start + 100))
    if (error) throw error
    for (const item of data ?? []) {
      if (item.source_fingerprint) existingPairs.add(`${item.source_fingerprint}|${item.source_occurrence}`)
      if (item.external_reference) existingReferences.add(item.external_reference)
    }
  }

  const references = Array.from(new Set(prepared
    .map(row => row.externalReference?.trim())
    .filter((reference): reference is string => Boolean(reference))))
  for (let start = 0; start < references.length; start += 100) {
    const { data, error } = await ctx.admin
      .from('orb_financial_transactions')
      .select('external_reference')
      .in('external_reference', references.slice(start, start + 100))
    if (error) throw error
    for (const item of data ?? []) {
      if (item.external_reference) existingReferences.add(item.external_reference)
    }
  }

  const occurrenceCounts = new Map<string, number>()
  const seenReferences = new Set<string>()
  return prepared.map(row => {
    const occurrence = (occurrenceCounts.get(row.fingerprint) ?? 0) + 1
    occurrenceCounts.set(row.fingerprint, occurrence)
    const rule = row.kind ? ruleMap.get(`${normalizeDescriptor(row.company)}|${row.kind}`) : undefined
    const reference = row.externalReference?.trim() || null
    const referenceDuplicate = Boolean(reference && (existingReferences.has(reference) || seenReferences.has(reference)))
    if (reference) seenReferences.add(reference)
    const fingerprintDuplicate = existingPairs.has(`${row.fingerprint}|${occurrence}`)
    const duplicateReason = referenceDuplicate ? 'external_reference' : fingerprintDuplicate ? 'fingerprint' : null
    const duplicate = duplicateReason !== null
    const catalogModel = resolveFinancialModel(row.model, rule?.pool_key ?? null)
    const poolKey = rule?.pool_key ?? catalogModel?.fundingPoolKey ?? null
    const kind = (rule?.transaction_kind as FinancialKind | null | undefined) ?? row.kind
    return {
      ...row,
      model: catalogModel?.model ?? row.model,
      modelKey: catalogModel ? financialModelKey(catalogModel.provider, catalogModel.model) : null,
      kind,
      poolKey,
      disposition: duplicate ? 'exclude' : (rule?.disposition as ImportDisposition | undefined) ?? (catalogModel && poolKey && kind ? 'include' : 'review'),
      recognized: Boolean(rule || catalogModel),
      duplicate,
      duplicateReason,
      occurrence,
      rememberDecision: !rule && !duplicate,
      allowDuplicate: false,
    }
  })
}

export async function confirmFinancialImport(input: {
  fileName: string
  statementKey?: string
  rows: FinancialImportPreviewRow[]
}) {
  const ctx = await requireAdmin()
  if (!input.fileName?.trim()) throw new Error('The import file name is required.')
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 2000) throw new Error('The import contains no rows.')

  for (const row of input.rows) {
    validateSourceRow(row)
    if (row.disposition === 'review') throw new Error(`Row ${row.rowNumber}: choose a model or service, or exclude it.`)
    if (row.disposition === 'include' && (!row.kind || !FINANCIAL_KINDS.includes(row.kind))) throw new Error(`Row ${row.rowNumber}: choose a transaction type.`)
    if (row.disposition === 'include' && !row.poolKey) throw new Error(`Row ${row.rowNumber}: choose a model or service.`)
    if (row.modelKey) {
      const [provider, ...modelParts] = row.modelKey.split(':')
      const definition = getOrbModelDefinition(provider, modelParts.join(':'))
      if (!definition || row.model !== definition.model || row.poolKey !== definition.fundingPoolKey) {
        throw new Error(`Row ${row.rowNumber}: choose a current model from the list.`)
      }
    }
    if (row.duplicateReason === 'external_reference' && row.disposition === 'include') throw new Error(`Row ${row.rowNumber}: that transaction/reference ID has already been imported.`)
    if (row.duplicateReason === 'fingerprint' && row.disposition === 'include' && !row.allowDuplicate) throw new Error(`Row ${row.rowNumber}: confirm that the apparent duplicate should be imported.`)
  }

  const requestedPoolKeys = Array.from(new Set(input.rows
    .filter(row => row.disposition === 'include' && row.poolKey)
    .map(row => row.poolKey as string)))
  const { data: availablePools, error: poolError } = await ctx.admin
    .from('orb_ai_funding_pools')
    .select('pool_key')
    .in('pool_key', requestedPoolKeys)
  if (poolError) throw poolError
  const availablePoolKeys = new Set((availablePools ?? []).map(pool => pool.pool_key))
  const unavailableRow = input.rows.find(row => row.disposition === 'include' && row.poolKey && !availablePoolKeys.has(row.poolKey))
  if (unavailableRow) throw new Error(`Row ${unavailableRow.rowNumber}: that model's accounting pool is not available.`)

  const rows = input.rows.map(row => row.disposition === 'exclude' && !row.kind
    ? { ...row, rememberDecision: false }
    : row)
  const { data: batchId, error } = await ctx.admin.rpc('import_ai_financial_rows', {
    p_file_name: input.fileName.trim(),
    p_statement_key: input.statementKey?.trim() || null,
    p_rows: rows,
    p_user_id: ctx.user.id,
  })
  if (error) throw error

  await logAuditEvent({
    action: 'orb_ai_financial_statement_import',
    table_name: 'orb_financial_import_batches',
    record_id: batchId,
    before: null,
    after: {
      file_name: input.fileName.trim(),
      row_count: input.rows.length,
      imported_count: input.rows.filter(row => row.disposition === 'include').length,
      excluded_count: input.rows.filter(row => row.disposition === 'exclude').length,
    },
    actor: 'web-ui',
    user_id: ctx.user.id,
  })
  return { ok: true, batchId }
}

export async function getFinancialTransactions(): Promise<FinancialTransaction[]> {
  const ctx = await requireAdmin()
  const { data, error } = await ctx.admin
    .from('orb_financial_transactions')
    .select('id, transaction_date, company, amount_usd, transaction_kind, pool_key, model, notes, import_batch_id, created_at, orb_ai_funding_pools(display_name)')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    transactionDate: row.transaction_date,
    company: row.company,
    amountUsd: Number(row.amount_usd),
    kind: row.transaction_kind,
    poolKey: row.pool_key,
    poolName: row.orb_ai_funding_pools?.[0]?.display_name ?? row.pool_key,
    model: row.model ?? null,
    notes: row.notes ?? null,
    imported: Boolean(row.import_batch_id),
    createdAt: row.created_at,
  }))
}

export async function saveFinancialTransaction(input: Omit<FinancialTransaction, 'id' | 'poolName' | 'imported' | 'createdAt'> & { id?: string }) {
  const ctx = await requireAdmin()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) throw new Error('A valid transaction date is required.')
  if (!input.company?.trim()) throw new Error('Company is required.')
  if (!Number.isFinite(input.amountUsd) || input.amountUsd === 0) throw new Error('Amount must be non-zero.')
  if (!FINANCIAL_KINDS.includes(input.kind)) throw new Error('Choose a valid transaction type.')
  if (!input.poolKey) throw new Error('Choose a destination.')

  const payload = {
    transaction_date: input.transactionDate,
    company: input.company.trim(),
    amount_usd: input.amountUsd,
    transaction_kind: input.kind,
    pool_key: input.poolKey,
    model: input.model?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
    ...(!input.id ? { created_by: ctx.user.id } : {}),
  }
  const { data: before } = input.id
    ? await ctx.admin.from('orb_financial_transactions').select('*').eq('id', input.id).maybeSingle()
    : { data: null }
  const query = input.id
    ? ctx.admin.from('orb_financial_transactions').update(payload).eq('id', input.id)
    : ctx.admin.from('orb_financial_transactions').insert(payload)
  const { error } = await query
  if (error) throw error
  await logAuditEvent({ action: input.id ? 'orb_ai_financial_transaction_update' : 'orb_ai_financial_transaction_create', table_name: 'orb_financial_transactions', record_id: input.id, before, after: payload, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function deleteFinancialTransaction(id: string) {
  const ctx = await requireAdmin()
  const { data: before, error: beforeError } = await ctx.admin.from('orb_financial_transactions').select('*').eq('id', id).maybeSingle()
  if (beforeError) throw beforeError
  if (!before) throw new Error('Financial entry not found.')
  const { error } = await ctx.admin.from('orb_financial_transactions').delete().eq('id', id)
  if (error) throw error
  await logAuditEvent({ action: 'orb_ai_financial_transaction_delete', table_name: 'orb_financial_transactions', record_id: id, before, after: null, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function saveSubscription(input: { id?: string; displayName: string; provider: string; recurringCostUsd: number | null }) {
  const ctx = await requireAdmin()
  if (!input.displayName?.trim()) throw new Error('Subscription name is required.')
  if (!input.provider?.trim()) throw new Error('Provider is required.')
  if (input.recurringCostUsd !== null && (!Number.isFinite(input.recurringCostUsd) || input.recurringCostUsd < 0)) throw new Error('Monthly cost must be non-negative.')

  const { data: before } = input.id
    ? await ctx.admin.from('orb_ai_funding_pools').select('*').eq('id', input.id).maybeSingle()
    : { data: null }
  if (input.id && before?.funding_mode !== 'subscription_cash') throw new Error('Subscription not found.')
  const payload = {
    provider: input.provider.trim().toLowerCase(),
    display_name: input.displayName.trim(),
    funding_mode: 'subscription_cash',
    recurring_cost_usd: input.recurringCostUsd,
    active: true,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
    ...(!input.id ? { pool_key: `subscription_${input.displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)}_${randomUUID().slice(0, 8)}`, sort_order: 150 } : {}),
  }
  const query = input.id
    ? ctx.admin.from('orb_ai_funding_pools').update(payload).eq('id', input.id).eq('funding_mode', 'subscription_cash')
    : ctx.admin.from('orb_ai_funding_pools').insert(payload)
  const { error } = await query
  if (error) throw error
  await logAuditEvent({ action: input.id ? 'orb_ai_subscription_update' : 'orb_ai_subscription_create', table_name: 'orb_ai_funding_pools', record_id: input.id, before, after: payload, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function deleteSubscription(id: string) {
  const ctx = await requireAdmin()
  const { data: before, error: beforeError } = await ctx.admin.from('orb_ai_funding_pools').select('*').eq('id', id).eq('funding_mode', 'subscription_cash').maybeSingle()
  if (beforeError) throw beforeError
  if (!before) throw new Error('Subscription not found.')
  const { error } = await ctx.admin.from('orb_ai_funding_pools').update({ active: false, updated_at: new Date().toISOString(), updated_by: ctx.user.id }).eq('id', id)
  if (error) throw error
  await logAuditEvent({ action: 'orb_ai_subscription_delete', table_name: 'orb_ai_funding_pools', record_id: id, before, after: { active: false }, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}
