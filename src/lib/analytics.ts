import { getCurrentUser } from './auth'

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '')

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>

export function trackEvent(event: string, properties: AnalyticsProps = {}) {
  void sendEvent(event, properties)
}

export function trackDuration(event: string, startedAt: number, properties: AnalyticsProps = {}) {
  trackEvent(event, { ...properties, duration_ms: Date.now() - startedAt })
}

async function sendEvent(event: string, properties: AnalyticsProps) {
  try {
    const user = await getCurrentUser()
    if (!user?.idToken) return
    await fetch(`${API_BASE}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.idToken}`,
      },
      body: JSON.stringify({ event, properties }),
    })
  } catch {
    // Analytics must never interrupt practice.
  }
}
