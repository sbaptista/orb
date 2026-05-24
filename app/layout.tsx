import type { Metadata } from 'next'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import Providers from '@/components/Providers'
import OfflinePage from '@/components/ui/OfflinePage'
import MaintenanceOverlay from '@/components/MaintenanceOverlay'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import UpdateBanner from '@/components/UpdateBanner'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-ui',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Orb',
}

export const viewport = {
  themeColor: '#d4e4d4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <OfflinePage />
        <MaintenanceOverlay />
        <ServiceWorkerRegistrar />
        <Providers>
          <UpdateBanner />
          <MaintenanceBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}


