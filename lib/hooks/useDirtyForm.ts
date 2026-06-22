'use client'

import { useCallback, useMemo, useState } from 'react'

type Normalize<T> = (value: T) => unknown

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Keeps an editor's live value and saved baseline together. Forms in Orb are
 * serializable records, so comparison happens against a normalized snapshot.
 */
export function useDirtyForm<T>(initialValue: T, normalize: Normalize<T> = value => value) {
  const [form, setForm] = useState<T>(() => snapshot(initialValue))
  const [baseline, setBaseline] = useState<T>(() => snapshot(initialValue))

  const isDirty = useMemo(
    () => JSON.stringify(normalize(form)) !== JSON.stringify(normalize(baseline)),
    [baseline, form, normalize],
  )

  const begin = useCallback((value: T) => {
    const next = snapshot(value)
    setForm(next)
    setBaseline(snapshot(next))
  }, [])

  const markSaved = useCallback((value?: T) => {
    const next = snapshot(value ?? form)
    setForm(next)
    setBaseline(snapshot(next))
  }, [form])

  return { form, setForm, baseline, begin, markSaved, isDirty }
}
