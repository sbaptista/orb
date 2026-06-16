'use client'

import { ToastProvider } from './ui/Toast'
import { SystemStateProvider } from './SystemStateProvider'
import { TooltipProvider } from './ui/Tooltip'
import TableTuner from './dev/TableTuner'
import GlobalDevPanel from './dev/GlobalDevPanel'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SystemStateProvider>
      <ToastProvider>
        <TooltipProvider>
          {children}
          <TableTuner />
          <GlobalDevPanel />
        </TooltipProvider>
      </ToastProvider>
    </SystemStateProvider>
  )
}
