/**
 * Client-side utility for handling server action results.
 * Detects auth failures and provides a consistent response.
 */

const AUTH_KEYWORDS = ['Not authenticated', 'Auth session missing', 'JWT expired', 'Invalid Refresh Token']

/**
 * Check if a server action error indicates an expired auth session.
 */
export function isAuthError(error: string | undefined | null): boolean {
  if (!error) return false
  return AUTH_KEYWORDS.some(kw => error.includes(kw))
}

/**
 * Handle an auth error by showing a toast and redirecting to login.
 * Call this in components after detecting `isAuthError(result.error)`.
 *
 * @param toast - the toast instance from useToast()
 * @param router - optional Next.js router for programmatic redirect
 */
export function handleSessionExpired(
  toast: { error: (msg: string) => void },
  router?: { push: (url: string) => void }
): void {
  toast.error('Your session has expired. Redirecting to login…')
  setTimeout(() => {
    if (router) {
      router.push('/auth/login')
    } else {
      window.location.href = '/auth/login'
    }
  }, 1500)
}
