'use client'

import { ToastProvider } from './ui/Toast'
import { SystemStateProvider } from './SystemStateProvider'
import { TooltipProvider } from './ui/Tooltip'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SystemStateProvider>
      <ToastProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ToastProvider>
    </SystemStateProvider>
  )
}

