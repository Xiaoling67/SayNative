import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { HistoryItem } from '../types'

const KEY = 'saynative_history'

export async function getHistory(): Promise<HistoryItem[]> {
  const stored = await AsyncStorage.getItem(KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    await AsyncStorage.removeItem(KEY)
    return []
  }
}

export async function saveToHistory(english: string, chinese: string, scene = ''): Promise<void> {
  const history = await getHistory()
  const item: HistoryItem = {
    id: Date.now().toString(),
    english,
    chinese,
    scene: scene.trim() || undefined,
    timestamp: Date.now(),
  }
  history.unshift(item)
  await AsyncStorage.setItem(KEY, JSON.stringify(history))
}

export async function deleteFromHistory(id: string): Promise<void> {
  const history = await getHistory()
  await AsyncStorage.setItem(KEY, JSON.stringify(history.filter((i) => i.id !== id)))
}

export async function exportHistory(): Promise<void> {
  const history = await getHistory()
  if (history.length === 0) return
  const text = history.map((i) => [i.english, i.chinese, i.scene ? `Scene: ${i.scene}` : ''].filter(Boolean).join('\n')).join('\n\n')
  const file = new File(Paths.cache, 'saynative-history.txt')
  file.write(text)
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Export History' })
}
