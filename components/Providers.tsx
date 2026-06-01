'use client'

import { ToastProvider } from './ui/Toast'
import { SystemStateProvider } from './SystemStateProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SystemStateProvider>
      <ToastProvider>{children}</ToastProvider>
    </SystemStateProvider>
  )
}
