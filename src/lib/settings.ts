import AsyncStorage from '@react-native-async-storage/async-storage'
import { TranslationMode } from '../types'

const TRANSLATION_MODE_KEY = 'saynative_translation_mode'

export async function getTranslationMode(): Promise<TranslationMode> {
  const stored = await AsyncStorage.getItem(TRANSLATION_MODE_KEY)
  return stored === 'moreNative' ? 'moreNative' : 'fast'
}

export async function saveTranslationMode(mode: TranslationMode): Promise<void> {
  await AsyncStorage.setItem(TRANSLATION_MODE_KEY, mode)
}
