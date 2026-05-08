import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TODOS',
    short_name: 'TODOS',
    description: 'Personal project issue tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f6f3',
    theme_color: '#d4e4d4',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
