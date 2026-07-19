/**
 * ORB-337 post-migration verification.
 *
 * Runs destructive checks only against two disposable projects, then removes
 * them in finally. Run during the maintenance window after applying the
 * migration and before releasing the aligned application.
 */

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function counter(projectId: string): Promise<number> {
  const { data, error } = await admin
    .from('project_todo_number_counters')
    .select('last_issued_number')
    .eq('project_id', projectId)
    .single()
  if (error) throw error
  return data.last_issued_number
}

async function insertTodo(projectId: string, title: string, suppliedNumber?: number) {
  const { data, error } = await admin
    .from('todos')
    .insert({
      product_id: projectId,
      title,
      status: 'open',
      ...(suppliedNumber === undefined ? {} : { todo_number: suppliedNumber }),
    })
    .select('id, product_id, todo_number, title')
    .single()
  if (error) throw error
  return data
}

async function main() {
  const marker = Date.now().toString(36).toUpperCase()
  const projectIds: string[] = []

  try {
    const { data: owner, error: ownerError } = await admin
      .from('users')
      .select('id')
      .in('role_id', [1, 3])
      .limit(1)
      .single()
    if (ownerError) throw ownerError

    const { data: projects, error: projectError } = await admin
      .from('projects')
      .insert([
        {
          name: `ORB-337 verification A ${marker}`,
          code: `V${marker}A`,
          created_by: owner.id,
          sort_order: 0,
        },
        {
          name: `ORB-337 verification B ${marker}`,
          code: `V${marker}B`,
          created_by: owner.id,
          sort_order: 0,
        },
      ])
      .select('id')
    if (projectError) throw projectError
    assert(projects?.length === 2, 'Expected two disposable projects')
    projectIds.push(...projects.map(project => project.id))
    const [projectA, projectB] = projectIds

    // Parallel HTTP requests exercise separate database transactions. Supplying
    // the same bogus number also proves ordinary callers cannot choose it.
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        insertTodo(projectA, `ORB-337 concurrent ${index + 1}`, 1),
      ),
    )
    const concurrentNumbers = concurrent
      .map(todo => todo.todo_number)
      .sort((a, b) => a - b)
    assert(
      new Set(concurrentNumbers).size === concurrent.length,
      'Concurrent inserts produced duplicate numbers',
    )
    assert(
      concurrentNumbers.every((number, index) => number === index + 1),
      `Concurrent allocation was not contiguous from 1: ${concurrentNumbers.join(', ')}`,
    )
    assert(await counter(projectA) === 12, 'Counter did not advance once per committed insert')

    const beforeFailedInsert = await counter(projectA)
    const { error: failedInsertError } = await admin.from('todos').insert({
      product_id: projectA,
      title: 'ORB-337 expected failure',
      status: '__invalid_status__',
    })
    assert(failedInsertError, 'Invalid insert unexpectedly succeeded')
    assert(
      await counter(projectA) === beforeFailedInsert,
      'Failed insert advanced the committed counter',
    )

    const retired = concurrent[concurrent.length - 1]
    const { error: deleteError } = await admin.from('todos').delete().eq('id', retired.id)
    if (deleteError) throw deleteError
    const afterDelete = await insertTodo(projectA, 'ORB-337 after hard delete')
    assert(afterDelete.todo_number === 13, 'Hard delete recycled a retired number')

    const moving = concurrent[0]
    const { data: movedToB, error: moveBError } = await admin
      .from('todos')
      .update({ product_id: projectB })
      .eq('id', moving.id)
      .select('id, todo_number')
      .single()
    if (moveBError) throw moveBError
    assert(movedToB.todo_number === 1, 'First destination move did not allocate B-1')

    const { data: movedBack, error: moveAError } = await admin
      .from('todos')
      .update({ product_id: projectA })
      .eq('id', moving.id)
      .select('id, todo_number')
      .single()
    if (moveAError) throw moveAError
    assert(movedBack.todo_number === 14, 'Move back recycled the todo’s retired A address')

    const beforeRewrite = await counter(projectA)
    const { error: rewriteError } = await admin
      .from('todos')
      .update({ todo_number: 2 })
      .eq('id', moving.id)
    assert(rewriteError, 'Direct todo_number rewrite unexpectedly succeeded')
    assert(
      await counter(projectA) === beforeRewrite,
      'Rejected address rewrite advanced the counter',
    )

    const restoredId = randomUUID()
    const restoredNumber = beforeRewrite + 25
    const timestamp = new Date().toISOString()
    const archiveRow = {
      id: restoredId,
      product_id: projectA,
      title: 'ORB-337 restored address',
      status: 'open',
      urls: [],
      sort_order: 0,
      created_at: timestamp,
      updated_at: timestamp,
      todo_number: restoredNumber,
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await admin.rpc('restore_todos_from_archive', {
        p_rows: [archiveRow],
      })
      if (error) throw error
    }

    const { data: restored, error: restoredError } = await admin
      .from('todos')
      .select('id, product_id, todo_number')
      .eq('id', restoredId)
      .single()
    if (restoredError) throw restoredError
    assert(restored.product_id === projectA, 'Restore changed the exported project')
    assert(restored.todo_number === restoredNumber, 'Restore changed the exported todo number')
    assert(
      await counter(projectA) === restoredNumber,
      'Restore did not advance the project high-water',
    )

    const { error: collisionError } = await admin.rpc('restore_todos_from_archive', {
      p_rows: [{ ...archiveRow, id: randomUUID() }],
    })
    assert(collisionError, 'Restore allowed a different UUID to claim an occupied address')

    const afterRestore = await insertTodo(projectA, 'ORB-337 after restore')
    assert(
      afterRestore.todo_number === restoredNumber + 1,
      'Normal allocation did not continue above the restored high-water',
    )

    console.log('ORB-337 verification passed: concurrency, rollback, delete/move non-reuse, immutability, and restore integrity.')
  } finally {
    if (projectIds.length > 0) {
      const { error: todoCleanupError } = await admin
        .from('todos')
        .delete()
        .in('product_id', projectIds)
      if (todoCleanupError) console.error('Todo cleanup failed:', todoCleanupError.message)

      const { error: projectCleanupError } = await admin
        .from('projects')
        .delete()
        .in('id', projectIds)
      if (projectCleanupError) console.error('Project cleanup failed:', projectCleanupError.message)
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
