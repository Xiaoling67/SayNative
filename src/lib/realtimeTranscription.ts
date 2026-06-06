import { apiBaseUrl } from './api'

type Language = 'chinese' | 'english'
type RealtimeMode = 'vad' | 'manual'
const SOFT_FINISH_TIMEOUT_MS = 3500
const HARD_FINISH_TIMEOUT_MS = 12000
const OPEN_TIMEOUT_MS = 6000
const MAX_PENDING_AUDIO_CHUNKS = 200

interface RealtimeCallbacks {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: Error) => void
}

export interface RealtimeTranscriptionSession {
  sendAudio: (audioBase64: string) => void
  finish: (options?: { softTimeoutMs?: number; hardTimeoutMs?: number }) => Promise<string>
  close: () => void
}

export function startRealtimeTranscription(
  language: Language,
  mode: RealtimeMode,
  callbacks: RealtimeCallbacks
): Promise<RealtimeTranscriptionSession> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(realtimeUrl())
    const pendingAudio: string[] = []
    let opened = false
    let settled = false
    let finalText = ''
    let lastText = ''
    let finishSettled = false
    let finishResolve: ((text: string) => void) | null = null
    let finishReject: ((error: Error) => void) | null = null
    let softFinishTimeout: ReturnType<typeof setTimeout> | null = null
    let hardFinishTimeout: ReturnType<typeof setTimeout> | null = null
    const openTimeout = setTimeout(() => {
      if (!opened) fail(new Error('Realtime transcription connection timed out'))
      close()
    }, OPEN_TIMEOUT_MS)

    function fail(error: Error) {
      if (settled && !finishReject) return
      callbacks.onError(error)
      if (finishResolve && lastText.trim()) {
        resolveFinish(lastText)
      } else if (finishReject) {
        rejectFinish(error)
      }
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    function send(data: unknown) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
    }

    ws.onopen = () => {
      opened = true
      clearTimeout(openTimeout)
      send({ type: 'start', language, mode })
      while (pendingAudio.length) send({ type: 'audio', audio: pendingAudio.shift() })
      if (!settled) {
        settled = true
        resolve(session)
      }
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(String(event.data))
      if (data.type === 'partial' && typeof data.text === 'string') {
        lastText = data.text
        callbacks.onPartial(data.text)
        return
      }
      if (data.type === 'final' && typeof data.text === 'string') {
        finalText = data.text
        lastText = data.text
        callbacks.onFinal(data.text)
        return
      }
      if (data.type === 'done') {
        const text = typeof data.text === 'string' ? data.text : finalText || lastText
        resolveFinish(text)
        return
      }
      if (data.type === 'error') {
        fail(new Error(String(data.error ?? 'Realtime transcription failed')))
      }
    }

    ws.onerror = () => fail(new Error('Realtime transcription connection failed'))
    ws.onclose = () => {
      if (finishResolve) {
        if (lastText.trim()) resolveFinish(lastText)
        else rejectFinish(new Error('Realtime transcription closed before final text'))
      } else if (opened) {
        callbacks.onError(new Error('Realtime transcription connection closed'))
      }
    }

    const session: RealtimeTranscriptionSession = {
      sendAudio(audioBase64: string) {
        if (!audioBase64) return
        if (!opened) {
          pendingAudio.push(audioBase64)
          if (pendingAudio.length > MAX_PENDING_AUDIO_CHUNKS) pendingAudio.shift()
        } else {
          send({ type: 'audio', audio: audioBase64 })
        }
      },
      finish(options) {
        return new Promise((resolveFinish, rejectFinish) => {
          finishResolve = resolveFinish
          finishReject = rejectFinish
          const softTimeoutMs = options?.softTimeoutMs ?? SOFT_FINISH_TIMEOUT_MS
          const hardTimeoutMs = options?.hardTimeoutMs ?? HARD_FINISH_TIMEOUT_MS
          softFinishTimeout = setTimeout(() => {
            if (lastText.trim()) {
              resolveFinish(lastText)
              close()
            }
          }, softTimeoutMs)
          hardFinishTimeout = setTimeout(() => {
            rejectFinish(new Error('Realtime transcription timed out'))
            close()
          }, hardTimeoutMs)
          send({ type: 'stop' })
        })
      },
      close,
    }

    function resolveFinish(text: string) {
      if (finishSettled) return
      finishSettled = true
      clearFinishTimers()
      finishResolve?.(text.trim())
      finishResolve = null
      finishReject = null
    }

    function rejectFinish(error: Error) {
      if (finishSettled) return
      finishSettled = true
      clearFinishTimers()
      finishReject?.(error)
      finishResolve = null
      finishReject = null
    }

    function clearFinishTimers() {
      if (softFinishTimeout) clearTimeout(softFinishTimeout)
      if (hardFinishTimeout) clearTimeout(hardFinishTimeout)
      softFinishTimeout = null
      hardFinishTimeout = null
    }

    function close() {
      clearTimeout(openTimeout)
      try {
        ws.close()
      } catch {}
    }
  })
}

function realtimeUrl() {
  const base = apiBaseUrl().replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  return `${base}/api/transcribe/realtime`
}
