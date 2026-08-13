'use client'

import { ToastProvider } from './ui/Toast'
import { SystemStateProvider } from './SystemStateProvider'
import { TooltipProvider } from './ui/Tooltip'
import TableTuner from './dev/TableTuner'
import GlobalDevPanel from './dev/GlobalDevPanel'
import ModalDragController from './ui/ModalDragController'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SystemStateProvider>
      <ToastProvider>
        <TooltipProvider>
          {children}
          <ModalDragController />
          <TableTuner />
          <GlobalDevPanel />
        </TooltipProvider>
      </ToastProvider>
    </SystemStateProvider>
  )
}
