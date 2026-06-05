import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import ConfettiCannon from 'react-native-confetti-cannon'
import { useSession } from '../hooks/useSession'
import { SessionState } from '../types'

interface Props {
  onOpenHistory: () => void
}

const STATUS_TEXT: Partial<Record<SessionState, string>> = {
  listening_chinese: 'Listening...',
  processing: 'Translating...',
  playing_tts: 'Listen carefully...',
  listening_english: 'Repeat after me...',
  evaluating: 'Evaluating...',
}

function SoundWave() {
  return (
    <View style={styles.soundWave}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.soundBar, { height: 12 + Math.sin(i) * 8 }]} />
      ))}
    </View>
  )
}

function HistoryIcon() {
  return (
    <View style={styles.historyIcon}>
      <View style={styles.historyHourHand} />
      <View style={styles.historyMinuteHand} />
    </View>
  )
}

function MicIcon() {
  return (
    <View style={styles.micIcon}>
      <View style={styles.micBody} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
      <View style={styles.micBase} />
    </View>
  )
}

export default function MainScreen({ onOpenHistory }: Props) {
  const session = useSession()
  const [showConfetti, setShowConfetti] = useState(false)
  const footer = footerState(session)
  const showSceneStart = session.state === 'idle'
  const showNextPractice = session.state === 'ready_to_speak' || session.state === 'correct'
  const isSceneBusy = session.sceneStatus !== 'idle'

  React.useEffect(() => {
    if (session.state === 'correct') {
      setShowConfetti(true)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
  }, [session.state])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SayNative</Text>
          <Text style={styles.subtitle}>Your spoken American English coach</Text>
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={onOpenHistory}>
          <HistoryIcon />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        {/* Status area */}
        <View style={styles.statusArea}>
          {session.state === 'idle' && (
            <View style={styles.idleHint}>
              <Text style={styles.idleText}>Tap Start and speak naturally</Text>
              <Text style={styles.idleSubText}>Say Chinese and repeat English</Text>
            </View>
          )}
          {session.state === 'listening_chinese' && <SoundWave />}
          {(session.state === 'processing' || session.state === 'evaluating') && (
            <ActivityIndicator size="large" color="#FF6A00" />
          )}
          {session.state === 'playing_tts' && <SoundWave />}
          {session.state === 'ready_to_speak' && <Text style={styles.resultMark}>↗</Text>}
          {session.state === 'listening_english' && <SoundWave />}
          {session.state === 'correct' && <Text style={styles.successText}>Nailed it</Text>}
          {session.state === 'incorrect' && <Text style={styles.resultMark}>↻</Text>}

          {session.state === 'ready_to_speak' && (
            <Text style={styles.tapToSpeak}>Ready to repeat</Text>
          )}
          {session.state === 'listening_chinese' && (
            <Text style={styles.tapToStop}>Tap Stop when you're done</Text>
          )}
          {session.state === 'listening_english' && (
            <Text style={styles.tapToStop}>Tap Stop when you're done</Text>
          )}
          {STATUS_TEXT[session.state] && (
            <Text style={styles.statusText}>{STATUS_TEXT[session.state]}</Text>
          )}
          {(session.state === 'correct' || session.state === 'incorrect') && session.feedback ? (
            <Text style={[styles.statusFeedback, session.isCorrect ? styles.statusFeedbackCorrect : styles.statusFeedbackIncorrect]}>
              {session.feedback}
            </Text>
          ) : null}
        </View>

        {session.sceneTranscript ? (
          <Text style={styles.sceneText}>Scene: {session.sceneTranscript}</Text>
        ) : null}

        {session.state === 'listening_chinese' && session.partialTranscript ? (
          <Text style={styles.sourceText}>{session.partialTranscript}</Text>
        ) : null}

        {session.chineseTranscript ? (
          <Text style={styles.sourceText}>{session.chineseTranscript}</Text>
        ) : null}

        {/* English translations */}
        {session.translations.map((t, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => session.selectTranslation(t)}
            style={[
              styles.translationCard,
              session.currentTranslation?.text === t.text && styles.translationCardActive,
            ]}
            activeOpacity={0.82}
          >
            <Text style={styles.translationText}>"{t.text}"</Text>
            {t.note ? <Text style={styles.translationNote}>— {t.note}</Text> : null}
          </TouchableOpacity>
        ))}

        {/* Error */}
        {session.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{session.error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Start / Stop button */}
      <View style={styles.footer}>
        {showNextPractice ? (
          <View style={styles.segmentedAction}>
            <TouchableOpacity
              style={styles.sceneBtn}
              onPress={session.nextPrompt}
            >
              <Text style={styles.sceneBtnText}>Next</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.segmentedStartBtn}
              onPress={session.beginSpeaking}
            >
              <Text style={styles.startBtnText}>Practice</Text>
            </TouchableOpacity>
          </View>
        ) : showSceneStart ? (
          <View style={styles.segmentedAction}>
            <TouchableOpacity
              style={[styles.sceneBtn, session.sceneStatus === 'listening' && styles.sceneBtnActive]}
              onPress={session.sceneStatus === 'listening' ? session.stopSceneSpeaking : session.startSceneListening}
              disabled={session.sceneStatus === 'processing'}
            >
              <Text style={styles.sceneBtnText}>
                {sceneButtonLabel(session)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentedStartBtn, isSceneBusy && styles.segmentedStartBtnDisabled]}
              onPress={session.startSession}
              disabled={isSceneBusy}
            >
              <View style={styles.startBtnContent}>
                <MicIcon />
                <Text style={styles.startBtnText}>Start</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.stopBtn, footer.primary && styles.primaryActionBtn, footer.disabled && styles.disabledBtn]}
            onPress={footer.onPress}
            disabled={footer.disabled}
          >
            <Text style={[styles.stopBtnText, footer.primary && styles.primaryBtnText]}>
              {footer.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showConfetti ? (
        <ConfettiCannon
          count={90}
          origin={{ x: 200, y: 0 }}
          colors={['#FF6A00', '#FDBA2D', '#3B82F6', '#22C55E', '#F8FAFC']}
          explosionSpeed={360}
          fallSpeed={2600}
          fadeOut
          onAnimationEnd={() => setShowConfetti(false)}
        />
      ) : null}
    </SafeAreaView>
  )
}

function footerState(session: ReturnType<typeof useSession>) {
  switch (session.state) {
    case 'listening_chinese':
      return { label: 'Stop', onPress: session.stopChineseSpeaking, disabled: false, primary: true }
    case 'ready_to_speak':
    case 'incorrect':
      return { label: 'Tap to repeat', onPress: session.beginSpeaking, disabled: false, primary: true }
    case 'listening_english':
      return { label: 'Stop', onPress: session.stopEnglishSpeaking, disabled: false, primary: true }
    case 'processing':
      return { label: 'Translating...', onPress: session.endSession, disabled: true, primary: false }
    case 'playing_tts':
      return { label: 'Listening...', onPress: session.endSession, disabled: true, primary: false }
    case 'evaluating':
      return { label: 'Evaluating...', onPress: session.endSession, disabled: true, primary: false }
    default:
      return { label: 'End', onPress: session.endSession, disabled: false, primary: false }
  }
}

function sceneButtonLabel(session: ReturnType<typeof useSession>) {
  if (session.sceneStatus === 'listening') return 'Stop'
  if (session.sceneStatus === 'processing') return 'Scene...'
  return session.sceneTranscript ? 'Scene ✓' : 'Scene'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111', fontFamily: 'System' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  historyBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIcon: {
    width: 17,
    height: 17,
    borderWidth: 1.8,
    borderColor: '#6B7280',
    borderRadius: 9,
  },
  historyHourHand: {
    position: 'absolute',
    left: 7,
    top: 3.5,
    width: 1.8,
    height: 5,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
  historyMinuteHand: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: 5,
    height: 1.8,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
  micIcon: {
    width: 18,
    height: 20,
    marginRight: 8,
  },
  micBody: {
    position: 'absolute',
    left: 5,
    top: 0,
    width: 8,
    height: 12,
    borderWidth: 1.8,
    borderColor: '#fff',
    borderRadius: 5,
  },
  micArc: {
    position: 'absolute',
    left: 2,
    top: 6,
    width: 14,
    height: 10,
    borderLeftWidth: 1.8,
    borderRightWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: '#fff',
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  micStem: {
    position: 'absolute',
    left: 8,
    top: 15,
    width: 1.8,
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  micBase: {
    position: 'absolute',
    left: 5,
    top: 18,
    width: 8,
    height: 1.8,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  main: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  statusArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    gap: 12,
  },
  idleHint: { alignItems: 'center', gap: 6 },
  idleText: { fontSize: 16, color: '#9CA3AF' },
  idleSubText: { fontSize: 13, color: '#D1D5DB' },
  soundWave: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  soundBar: { width: 6, backgroundColor: '#FF6A00', borderRadius: 3 },
  resultMark: { fontSize: 34, color: '#FF6A00', fontWeight: '700' },
  successText: { fontSize: 16, color: '#16A34A', fontWeight: '700' },
  tapToSpeak: { fontSize: 14, color: '#EA580C', fontWeight: '600' },
  tapToStop: { fontSize: 13, color: '#F87171', fontWeight: '500' },
  statusFeedback: {
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  statusFeedbackCorrect: { color: '#15803D' },
  statusFeedbackIncorrect: { color: '#C2410C' },
  partialCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  partialText: { fontSize: 15, color: '#EF4444', lineHeight: 22 },
  statusText: { fontSize: 14, color: '#6B7280' },
  sceneText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  sourceText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cardLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  cardText: { fontSize: 16, color: '#374151' },
  translationCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  translationCardActive: {
    borderColor: '#FF6A00',
    backgroundColor: '#FFF3E8',
  },
  translationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    lineHeight: 28,
  },
  translationNote: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  replayBtn: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  replayBtnText: { fontSize: 14, color: '#EA580C' },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorText: { fontSize: 14, color: '#DC2626' },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  segmentedAction: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FED7AA',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sceneBtn: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#FED7AA',
  },
  sceneBtnActive: { backgroundColor: '#FFEDD5' },
  sceneBtnText: { color: '#EA580C', fontSize: 18, fontWeight: '700' },
  segmentedStartBtn: {
    flex: 2,
    backgroundColor: '#FF6A00',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedStartBtnDisabled: { opacity: 0.65 },
  startBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    backgroundColor: '#FF6A00',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryActionBtn: { backgroundColor: '#FF6A00' },
  disabledBtn: { opacity: 0.65 },
  primaryBtnText: { color: '#fff' },
  stopBtnText: { color: '#6B7280', fontSize: 18, fontWeight: '600' },
})
