import type { Metadata } from 'next'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import { VERSION } from '@/lib/version'
import { VERSION_VOLATILE_SESSION_KEYS, LAST_APPLIED_VERSION_KEY } from '@/lib/client-state'
import Providers from '@/components/Providers'
import OfflinePage from '@/components/ui/OfflinePage'
import MaintenanceOverlay from '@/components/MaintenanceOverlay'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import UpdateBanner from '@/components/UpdateBanner'
import BroadcastBanner from '@/components/BroadcastBanner'
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

// ORB-322: clear version-volatile client state before React hydrates.
// Runs synchronously during HTML parse — ahead of any consumer (e.g.
// UnifiedDashboard) that hydrates the Orb transcript from sessionStorage —
// so a bundle picked up by a plain reload/navigation (not just the Update
// button) still transitions cleanly. Fires once per version transition.
const versionResetScript = `(function(){try{var v=${JSON.stringify(VERSION)};var k=${JSON.stringify(LAST_APPLIED_VERSION_KEY)};if(localStorage.getItem(k)!==v){var s=${JSON.stringify(VERSION_VOLATILE_SESSION_KEYS)};for(var i=0;i<s.length;i++){try{sessionStorage.removeItem(s[i])}catch(e){}}localStorage.setItem(k,v)}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: versionResetScript }} />
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ServiceWorkerRegistrar />
        <Providers>
          <OfflinePage />
          <MaintenanceOverlay />
          <UpdateBanner />
          <MaintenanceBanner />
          <BroadcastBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}


