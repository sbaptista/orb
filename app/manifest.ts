import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orb',
    short_name: 'Orb',
    description: 'Personal project tracker — your backlog has a pulse',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8f6f3',
    theme_color: '#d4e4d4',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
