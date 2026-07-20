export type SessionState =
  | 'idle'
  | 'listening_scene'
  | 'listening_chinese'
  | 'processing'
  | 'playing_tts'
  | 'ready_to_speak'
  | 'listening_english'
  | 'evaluating'
  | 'correct'
  | 'incorrect'

export interface Translation {
  text: string
  note: string
}

export type TranslationMode = 'fast' | 'moreNative'

export interface HistoryItem {
  id: string
  english: string
  chinese: string
  scene?: string
  timestamp: number
}
