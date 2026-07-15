// Single source of truth for project code generation.
//
// A project code is auto-generated from the name, immutable, and internal-only
// (it exists to prefix todo codes like ORB-73). It must be generated the same
// way no matter who creates the project — the web UI, the serial Orb, or the
// Realtime operator — so this logic deliberately lives here rather than inside
// any one caller. It is NOT in app/actions/manage-project.ts because that file
// is 'use server': every export there becomes a callable server-action
// endpoint, and a code generator has no business being one.

import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

const MAX_CODE_LENGTH = 10

export async function checkCodeConflict(
  admin: Admin,
  code: string,
  userId: string,
  excludeId?: string,
): Promise<boolean> {
  const query = admin
    .from('projects')
    .select('id')
    .ilike('code', code)
    .eq('created_by', userId)
    .is('deleted_at', null)
  if (excludeId) query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  return !!data
}

export function normalizeProjectCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function generateUniqueCode(admin: Admin, name: string, userId: string): Promise<string> {
  let baseCode = normalizeProjectCode(name)
  if (!baseCode) baseCode = 'PROJ'
  if (baseCode.length > MAX_CODE_LENGTH) baseCode = baseCode.substring(0, MAX_CODE_LENGTH)

  let code = baseCode
  let counter = 1
  while (await checkCodeConflict(admin, code, userId)) {
    counter++
    const suffix = counter.toString()
    const maxBaseLen = MAX_CODE_LENGTH - suffix.length
    code = baseCode.substring(0, maxBaseLen) + suffix
  }
  return code
}
