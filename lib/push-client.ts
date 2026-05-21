/**
 * Client-side push notification helpers.
 * Handles service worker registration, subscription management, and permission flow.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('[push] SW registration failed:', err)
    return null
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, error: 'Permission denied' }
    }

    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })

    const json = subscription.toJSON()
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      return { ok: false, error: data.error ?? 'Server error' }
    }

    return { ok: true }
  } catch (err: any) {
    console.error('[push] Subscribe failed:', err)
    return { ok: false, error: err.message }
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const subscription = await getExistingSubscription()
    if (!subscription) return { ok: true }

    // Unsubscribe from browser
    await subscription.unsubscribe()

    // Remove from server
    await fetch('/api/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[push] Unsubscribe failed:', err)
    return { ok: false, error: err.message }
  }
}
