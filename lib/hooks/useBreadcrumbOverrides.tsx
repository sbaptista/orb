'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type Overrides = Record<string, string>

type BreadcrumbOverridesContextType = {
  overrides: Overrides
  setOverride: (segment: string, href: string) => void
}

const BreadcrumbOverridesContext = createContext<BreadcrumbOverridesContextType>({
  overrides: {},
  setOverride: () => {},
})

export function BreadcrumbOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({})

  const setOverride = useCallback((segment: string, href: string) => {
    setOverrides(prev => prev[segment] === href ? prev : { ...prev, [segment]: href })
  }, [])

  return (
    <BreadcrumbOverridesContext.Provider value={{ overrides, setOverride }}>
      {children}
    </BreadcrumbOverridesContext.Provider>
  )
}

export function useBreadcrumbOverrides() {
  return useContext(BreadcrumbOverridesContext)
}
