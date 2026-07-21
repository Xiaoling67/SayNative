import { getCurrentUser } from './auth'

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '')

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>

export function trackEvent(event: string, properties: AnalyticsProps = {}) {
  void sendEvent(event, properties)
}

export function trackDuration(event: string, startedAt: number, properties: AnalyticsProps = {}) {
  trackEvent(event, { ...properties, duration_ms: Date.now() - startedAt })
}

async function sendEvent(event: string, properties: AnalyticsProps) {
  try {
    if (!POSTHOG_KEY) return

    const user = await getCurrentUser()
    if (!user?.uid) return

    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: user.uid,
        properties: {
          ...properties,
          app: 'saynative',
        },
      }),
    })
  } catch {
    // Analytics must never interrupt practice.
  }
}
