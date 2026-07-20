import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioStudioModule, useAudioRecorder } from '@siteed/audio-studio'
import { File } from 'expo-file-system'
import { SessionState, Translation, TranslationMode } from '../types'
import { evaluateSpeech, transcribeSpeech, translateChinese } from '../lib/api'
import { saveToHistory } from '../lib/history'
import { getTranslationMode, saveTranslationMode } from '../lib/settings'
import { speakWithElevenLabs, stopTTS } from '../lib/elevenlabs'
import { RealtimeTranscriptionSession, startRealtimeTranscription } from '../lib/realtimeTranscription'
import { trackDuration, trackEvent } from '../lib/analytics'

const STOP_AUDIO_FLUSH_DELAY_MS = 350

interface SessionData {
  state: SessionState
  sceneStatus: 'idle' | 'listening' | 'processing'
  sceneTranscript: string
  chineseTranscript: string
  partialTranscript: string
  translations: Translation[]
  currentTranslation: Translation | null
  translationMode: TranslationMode
  feedback: string
  isCorrect: boolean
  error: string
  setTranslationMode: (mode: TranslationMode) => void
  startSession: () => void
  startSceneListening: () => void
  endSession: () => void
  beginSpeaking: () => void
  nextPrompt: () => void
  stopSceneSpeaking: () => void
  stopChineseSpeaking: () => void
  stopEnglishSpeaking: () => void
  selectTranslation: (translation: Translation) => void
  replayTTS: () => void
}

export function useSession(): SessionData {
  const recorder = useAudioRecorder()
  const [state, setState] = useState<SessionState>('idle')
  const [sceneStatus, setSceneStatus] = useState<'idle' | 'listening' | 'processing'>('idle')
  const [sceneTranscript, setSceneTranscript] = useState('')
  const [chineseTranscript, setChineseTranscript] = useState('')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [translations, setTranslations] = useState<Translation[]>([])
  const [currentTranslation, setCurrentTranslation] = useState<Translation | null>(null)
  const [translationMode, setTranslationModeState] = useState<TranslationMode>('fast')
  const [feedback, setFeedback] = useState('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [error, setError] = useState('')

  const activeRef = useRef(false)
  const sceneTranscriptRef = useRef('')
  const partialTranscriptRef = useRef('')
  const translationsRef = useRef<Translation[]>([])
  const currentTranslationRef = useRef<Translation | null>(null)
  const translationModeRef = useRef<TranslationMode>('fast')
  const chineseTranscriptRef = useRef('')
  const recordingModeRef = useRef<'scene' | 'chinese' | 'english' | null>(null)
  const realtimeRef = useRef<RealtimeTranscriptionSession | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const practiceAttemptsRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    getTranslationMode()
      .then((mode) => {
        if (cancelled) return
        translationModeRef.current = mode
        setTranslationModeState(mode)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const setTranslationMode = useCallback((mode: TranslationMode) => {
    translationModeRef.current = mode
    setTranslationModeState(mode)
    saveTranslationMode(mode).catch(() => {})
    trackEvent('mode_changed', { mode_used: mode })
  }, [])

  const clearPendingTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const resetCurrentPrompt = () => {
    setChineseTranscript('')
    chineseTranscriptRef.current = ''
    setPartialTranscript('')
    partialTranscriptRef.current = ''
    setTranslations([])
    translationsRef.current = []
    setCurrentTranslation(null)
    currentTranslationRef.current = null
    setFeedback('')
    setIsCorrect(false)
    practiceAttemptsRef.current = 0
  }

  const startStreamingRecording = async (label: 'scene' | 'chinese' | 'english') => {
    const startedAt = Date.now()
    const permission = await AudioStudioModule.requestPermissionsAsync()
    if (!permission.granted && permission.status !== 'granted') {
      throw new Error('Microphone permission is required')
    }
    const language = label === 'english' ? 'english' : 'chinese'
    const mode = label === 'english' ? 'manual' : 'vad'
    try {
      const realtime = await startRealtimeTranscription(language, mode, {
        onPartial(text) {
          setPartialTranscript(text)
          partialTranscriptRef.current = text
          if (label === 'scene') {
            setSceneTranscript(text)
            sceneTranscriptRef.current = text
          }
        },
        onFinal(text) {
          setPartialTranscript(text)
          partialTranscriptRef.current = text
          if (label === 'scene') {
            setSceneTranscript(text)
            sceneTranscriptRef.current = text
          }
        },
        onError(error) {
          console.warn(`Realtime transcription ${label} error: ${error.message}`)
          trackEvent('realtime_disconnect', { phase: label })
          if (recordingModeRef.current === label && partialTranscriptRef.current.trim()) {
            setError('Network is unstable. I’ll keep what I heard.')
          }
        },
      })
      realtimeRef.current = realtime
    } catch (error) {
      realtimeRef.current = null
      trackEvent('realtime_disconnect', { phase: label })
      console.warn(`Realtime transcription ${label} unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
    await recorder.startRecording({
      sampleRate: 16000,
      channels: 1,
      encoding: 'pcm_16bit',
      interval: 100,
      bufferDurationSeconds: 0.1,
      streamFormat: 'raw',
      output: {
        primary: { enabled: true, format: 'wav' },
      },
      onAudioStream: async (event) => {
        if (typeof event.data === 'string') {
          realtimeRef.current?.sendAudio(event.data)
        }
      },
    })
    console.log(`Timing client start_streaming_recording_${label}: ${Date.now() - startedAt}ms`)
  }

  const stopStreamingRecording = async (label: 'scene' | 'chinese' | 'english') => {
    const startedAt = Date.now()
    await wait(STOP_AUDIO_FLUSH_DELAY_MS)
    const recording = await recorder.stopRecording()
    const realtime = realtimeRef.current
    realtimeRef.current = null
    const language = label === 'english' ? 'english' : 'chinese'
    if (!realtime) {
      const transcript = await transcribeRecording(recording, language)
      console.log(`Timing client full_audio_${label}_fallback: ${Date.now() - startedAt}ms`)
      return { transcript, recording }
    }
    let transcript = ''
    try {
      transcript = await realtime.finish(
        label === 'english' ? { softTimeoutMs: 6500, hardTimeoutMs: 15000 } : undefined
      )
    } catch (error) {
      console.warn(`Realtime finish ${label} failed: ${error instanceof Error ? error.message : String(error)}`)
      transcript = await transcribeRecording(recording, language)
    }
    console.log(`Timing client streaming_${label}_final: ${Date.now() - startedAt}ms`)
    return { transcript, recording }
  }

  const transcribeRecording = async (
    recording: Awaited<ReturnType<typeof recorder.stopRecording>> | null,
    language: 'chinese' | 'english'
  ) => {
    if (!recording?.fileUri) throw new Error('No audio recording was captured')
    const audioBase64 = await new File(recording.fileUri).base64()
    return (await transcribeSpeech(audioBase64, language, recording.mimeType || 'audio/wav')).trim()
  }

  const finalChineseTranscript = async (
    streamingTranscript: string,
    recording: Awaited<ReturnType<typeof recorder.stopRecording>> | null
  ) => {
    if (!recording?.fileUri) return streamingTranscript
    try {
      const startedAt = Date.now()
      const fullTranscript = await transcribeRecording(recording, 'chinese')
      console.log(`Timing client chinese_full_audio_confirm: ${Date.now() - startedAt}ms`)
      if (shouldUseFullTranscript(streamingTranscript, fullTranscript)) return fullTranscript
    } catch (error) {
      console.warn(`Full Chinese transcript check failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    return streamingTranscript
  }

  const shouldUseFullTranscript = (streamingTranscript: string, fullTranscript: string) => {
    const realtimeText = streamingTranscript.trim()
    const finalText = fullTranscript.trim()
    if (!finalText) return false
    if (!realtimeText) return true
    return normalizedLength(finalText) >= normalizedLength(realtimeText) + 2
  }

  const normalizedLength = (text: string) => text.replace(/[\s，。！？,.!?]/g, '').length

  const messageForError = (error: unknown, fallback: string) => {
    if (!(error instanceof Error) || !error.message) return fallback
    return `${fallback}: ${error.message}`
  }

  const playTTS = useCallback((text: string, onDone: () => void) => {
    trackEvent('tts_played', { characters: text.length })
    speakWithElevenLabs(text, onDone).catch(() => {
      if (!activeRef.current) return
      trackEvent('api_error', { error_type: 'tts_playback_failed' })
      setError('Audio playback failed. You can still practice by reading the sentence.')
      setState('ready_to_speak')
    })
  }, [])

  const startSceneListening = useCallback(async () => {
    if (recordingModeRef.current) return
    activeRef.current = false
    clearPendingTimeout()
    stopTTS()
    resetCurrentPrompt()
    setSceneTranscript('')
    sceneTranscriptRef.current = ''
    recordingModeRef.current = 'scene'
    setError('')
    setSceneStatus('processing')
    setState('idle')
    trackEvent('scene_recording_started')

    try {
      await startStreamingRecording('scene')
      setSceneStatus('listening')
    } catch (e) {
      recordingModeRef.current = null
      setSceneStatus('idle')
      setError(e instanceof Error ? e.message : 'Microphone not available')
      setState('idle')
    }
  }, [recorder]) // eslint-disable-line react-hooks/exhaustive-deps

  const startChineseListening = useCallback(async () => {
    if (!activeRef.current) return
    clearPendingTimeout()
    recordingModeRef.current = 'chinese'
    setError('')
    setPartialTranscript('')
    partialTranscriptRef.current = ''
    setState('processing')

    try {
      await startStreamingRecording('chinese')
      if (!activeRef.current) return
      setState('listening_chinese')
    } catch (e) {
      if (!activeRef.current) return
      recordingModeRef.current = null
      setError(e instanceof Error ? e.message : 'Microphone not available')
      setState('idle')
    }
  }, [recorder]) // eslint-disable-line react-hooks/exhaustive-deps

  const processChineseTranscript = useCallback(async (transcript: string) => {
    if (!activeRef.current) return
    if (!transcript.trim()) {
      setError('I did not catch that. Please try again.')
      await startChineseListening()
      return
    }

    setChineseTranscript(transcript)
    chineseTranscriptRef.current = transcript
    setState('processing')
    trackEvent('chinese_recorded', {
      transcript_chars: transcript.trim().length,
      has_scene: Boolean(sceneTranscriptRef.current.trim()),
      mode_used: translationModeRef.current,
    })

    try {
      const startedAt = Date.now()
      const trans = await translateChinese(transcript, sceneTranscriptRef.current, translationModeRef.current)
      console.log(`Timing client chinese_translate_flow: ${Date.now() - startedAt}ms`)
      if (!activeRef.current) return
      if (!trans.length) throw new Error('No translation returned')

      setTranslations(trans)
      translationsRef.current = trans
      setCurrentTranslation(trans[0])
      currentTranslationRef.current = trans[0]
      setState('playing_tts')
      trackDuration('english_generated', startedAt, {
        mode_used: translationModeRef.current,
        has_scene: Boolean(sceneTranscriptRef.current.trim()),
        option_count_shown: trans.length,
      })

      playTTS(trans[0].text, () => {
        if (!activeRef.current) return
        setState('ready_to_speak')
      })
    } catch {
      if (!activeRef.current) return
      trackEvent('api_error', { error_type: 'translation_failed' })
      setError('Translation failed, please try again')
      await startChineseListening()
    }
  }, [playTTS, startChineseListening])

  const stopChineseSpeaking = useCallback(async () => {
    if (!activeRef.current || recordingModeRef.current !== 'chinese') return
    recordingModeRef.current = null
    setState('processing')

    try {
      const startedAt = Date.now()
      const { transcript, recording } = await stopStreamingRecording('chinese')
      console.log(`Timing client chinese_streaming_transcribe_flow: ${Date.now() - startedAt}ms`)
      await processChineseTranscript(await finalChineseTranscript(transcript, recording))
    } catch (e) {
      if (!activeRef.current) return
      const fallback = partialTranscriptRef.current.trim()
      if (fallback) {
        setError('Network was unstable, so I used the text already recognized.')
        await processChineseTranscript(fallback)
        return
      }
      setError(messageForError(e, 'Chinese speech recognition failed, please try again'))
      await startChineseListening()
    }
  }, [processChineseTranscript, startChineseListening]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopSceneSpeaking = useCallback(async () => {
    if (recordingModeRef.current !== 'scene') return
    recordingModeRef.current = null
    setSceneStatus('processing')

    try {
      const startedAt = Date.now()
      const { transcript, recording } = await stopStreamingRecording('scene')
      console.log(`Timing client scene_streaming_transcribe_flow: ${Date.now() - startedAt}ms`)
      const scene = (await finalChineseTranscript(transcript, recording)).trim()
      if (!scene) throw new Error('No scene was captured')
      setSceneTranscript(scene)
      sceneTranscriptRef.current = scene
      setSceneStatus('idle')
      setState('idle')
      trackDuration('scene_saved', startedAt, { transcript_chars: scene.length })
    } catch (e) {
      const fallback = partialTranscriptRef.current.trim()
      if (fallback) {
        setSceneTranscript(fallback)
        sceneTranscriptRef.current = fallback
        setSceneStatus('idle')
        setState('idle')
        setError('Network was unstable, so I used the scene already recognized.')
        trackEvent('scene_saved', { transcript_chars: fallback.length, used_fallback: true })
        return
      }
      setSceneStatus('idle')
      setError(messageForError(e, 'Scene speech recognition failed, please try again'))
      setState('idle')
      trackEvent('api_error', { error_type: 'scene_recognition_failed' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const beginSpeaking = useCallback(async () => {
    if (!activeRef.current || !currentTranslationRef.current) return
    clearPendingTimeout()
    recordingModeRef.current = 'english'
    setError('')
    setFeedback('')
    setPartialTranscript('')
    partialTranscriptRef.current = ''
    trackEvent('practice_started', {
      mode_used: translationModeRef.current,
      selected_option_rank: selectedOptionRank(),
    })

    try {
      await startStreamingRecording('english')
      if (!activeRef.current) return
      setState('listening_english')
    } catch {
      if (!activeRef.current) return
      recordingModeRef.current = null
      setError('Microphone not available')
      setState('ready_to_speak')
    }
  }, [recorder]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopEnglishSpeaking = useCallback(async () => {
    if (!activeRef.current || recordingModeRef.current !== 'english') return
    recordingModeRef.current = null
    setState('evaluating')

    try {
      const startedAt = Date.now()
      const { transcript: userSpeech } = await stopStreamingRecording('english')
      console.log(`Timing client english_streaming_transcribe_flow: ${Date.now() - startedAt}ms`)
      const evaluateStartedAt = Date.now()
      const result = await evaluateSpeech(currentTranslationRef.current?.text ?? '', userSpeech)
      console.log(`Timing client english_evaluate_flow: ${Date.now() - evaluateStartedAt}ms`)
      if (!activeRef.current) return
      practiceAttemptsRef.current += 1
      trackDuration('practice_completed', evaluateStartedAt, {
        success: result.correct,
        selected_option_rank: selectedOptionRank(),
        mode_used: translationModeRef.current,
        attempt_number: practiceAttemptsRef.current,
      })

      setFeedback(result.feedback)
      setIsCorrect(result.correct)

      if (result.correct) {
        setState('correct')
        await saveToHistory(currentTranslationRef.current?.text ?? '', chineseTranscriptRef.current, sceneTranscriptRef.current)
      } else {
        setState('incorrect')
        playTTS(result.feedback, () => {
          if (!activeRef.current) return
          setState('ready_to_speak')
        })
      }
    } catch (e) {
      if (!activeRef.current) return
      const fallback = partialTranscriptRef.current.trim()
      if (fallback) {
        setError('Network was unstable, so I used the words already recognized.')
        const evaluateStartedAt = Date.now()
        const result = await evaluateSpeech(currentTranslationRef.current?.text ?? '', fallback)
        console.log(`Timing client english_evaluate_fallback_flow: ${Date.now() - evaluateStartedAt}ms`)
        if (!activeRef.current) return
        practiceAttemptsRef.current += 1
        trackDuration('practice_completed', evaluateStartedAt, {
          success: result.correct,
          selected_option_rank: selectedOptionRank(),
          mode_used: translationModeRef.current,
          attempt_number: practiceAttemptsRef.current,
          used_fallback: true,
        })
        setFeedback(result.feedback)
        setIsCorrect(result.correct)
        if (result.correct) {
          setState('correct')
          await saveToHistory(currentTranslationRef.current?.text ?? '', chineseTranscriptRef.current, sceneTranscriptRef.current)
        } else {
          setState('incorrect')
          playTTS(result.feedback, () => {
            if (!activeRef.current) return
            setState('ready_to_speak')
          })
        }
        return
      }
      setError(messageForError(e, 'Evaluation failed, please try again'))
      setState('ready_to_speak')
      trackEvent('api_error', { error_type: 'evaluation_failed' })
    }
  }, [startChineseListening]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectTranslation = useCallback((translation: Translation) => {
    if (!activeRef.current || recordingModeRef.current) return
    clearPendingTimeout()
    stopTTS()
    setCurrentTranslation(translation)
    currentTranslationRef.current = translation
    trackEvent('option_selected', {
      selected_option_rank: translationsRef.current.findIndex((item) => item.text === translation.text) + 1,
      option_count_shown: translationsRef.current.length,
      mode_used: translationModeRef.current,
    })
    setFeedback('')
    setIsCorrect(false)
    setError('')
    setState('playing_tts')
    playTTS(translation.text, () => {
      if (!activeRef.current) return
      setState('ready_to_speak')
    })
  }, [playTTS])

  const startSession = useCallback(() => {
    if (sceneStatus !== 'idle') return
    activeRef.current = true
    clearPendingTimeout()
    setError('')
    resetCurrentPrompt()
    trackEvent('practice_flow_started', {
      has_scene: Boolean(sceneTranscriptRef.current.trim()),
      mode_used: translationModeRef.current,
    })
    startChineseListening()
  }, [sceneStatus, startChineseListening])

  const nextPrompt = useCallback(() => {
    if (sceneStatus !== 'idle' || recordingModeRef.current) return
    activeRef.current = false
    clearPendingTimeout()
    stopTTS()
    setError('')
    resetCurrentPrompt()
    setState('idle')
  }, [sceneStatus])

  const endSession = useCallback(() => {
    activeRef.current = false
    clearPendingTimeout()
    recordingModeRef.current = null
    setSceneStatus('idle')
    if (recorder.isRecording) recorder.stopRecording().catch(() => {})
    realtimeRef.current?.close()
    realtimeRef.current = null
    stopTTS()
    setState('idle')
    setError('')
    resetCurrentPrompt()
  }, [recorder])

  const replayTTS = useCallback(() => {
    if (!currentTranslationRef.current) return
    stopTTS()
    setError('')
    setState('playing_tts')
    trackEvent('tts_replayed', {
      selected_option_rank: selectedOptionRank(),
      mode_used: translationModeRef.current,
    })
    playTTS(currentTranslationRef.current.text, () => {
      if (!activeRef.current) return
      setState('ready_to_speak')
    })
  }, [playTTS])

  const selectedOptionRank = () => {
    const current = currentTranslationRef.current
    if (!current) return 0
    return translationsRef.current.findIndex((item) => item.text === current.text) + 1
  }

  return {
    state,
    sceneStatus,
    sceneTranscript,
    chineseTranscript,
    partialTranscript,
    translations,
    currentTranslation,
    translationMode,
    feedback,
    isCorrect,
    error,
    setTranslationMode,
    startSession,
    startSceneListening,
    endSession,
    beginSpeaking,
    nextPrompt,
    stopSceneSpeaking,
    stopChineseSpeaking,
    stopEnglishSpeaking,
    selectTranslation,
    replayTTS,
  }
}
