import { File, Paths } from 'expo-file-system'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { synthesizeSpeech } from './api'

let currentPlayer: ReturnType<typeof createAudioPlayer> | null = null

export async function stopTTS() {
  if (currentPlayer) {
    try {
      currentPlayer.remove()
    } catch {}
    currentPlayer = null
  }
}

export async function speakWithElevenLabs(text: string, onDone: () => void): Promise<void> {
  const startedAt = Date.now()
  await stopTTS()

  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
  })

  const audioBase64 = await synthesizeSpeech(text)
  console.log(`Timing client elevenlabs_fetch_audio: ${Date.now() - startedAt}ms`)
  const file = new File(Paths.cache, 'tts_audio.mp3')

  const writeStartedAt = Date.now()
  file.write(audioBase64, { encoding: 'base64' })
  console.log(`Timing client elevenlabs_write_audio: ${Date.now() - writeStartedAt}ms`)

  const player = createAudioPlayer({ uri: file.uri })
  currentPlayer = player

  player.addListener('playbackStatusUpdate', (status: any) => {
    if (status.didJustFinish) {
      stopTTS()
      onDone()
    }
  })

  player.play()
}
