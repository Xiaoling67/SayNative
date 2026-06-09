import { Translation, TranslationMode } from '../types'

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 70000

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || 'API error')
    }
    const json = await res.json()
    console.log(`Timing client ${path}: ${Date.now() - startedAt}ms`)
    return json
  } catch (error) {
    console.log(`Timing client ${path} failed: ${Date.now() - startedAt}ms`)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function transcribeSpeech(
  audioBase64: string,
  language: 'chinese' | 'english',
  mimeType = 'audio/wav'
): Promise<string> {
  const data = await post<{ text: string }>('/api/transcribe', {
    audioBase64,
    language,
    mimeType,
  })
  return data.text
}

export async function synthesizeSpeech(text: string): Promise<string> {
  const data = await post<{ audioBase64: string }>('/api/tts', { text })
  return data.audioBase64
}

export async function translateChinese(
  chinese: string,
  scene?: string,
  mode: TranslationMode = 'fast'
): Promise<Translation[]> {
  const data = await post<{ translations: Translation[] }>('/api/translate', { chinese, scene, mode })
  return data.translations
}

export async function evaluateSpeech(
  target: string,
  userSpeech: string
): Promise<{ correct: boolean; feedback: string }> {
  return post('/api/evaluate', { target, userSpeech })
}

export function apiBaseUrl(): string {
  return API_BASE
}
