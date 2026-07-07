import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { isAuthConfigured, loginWithEmail, registerWithEmail } from '../lib/auth'

type AuthMode = 'login' | 'register'

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRegistering = mode === 'register'

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password with at least 6 characters.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (isRegistering) {
        await registerWithEmail(email, password)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.title}>SayNative</Text>
            <Text style={styles.subtitle}>Your spoken American English coach</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.heading}>{isRegistering ? 'Create account' : 'Welcome back'}</Text>
            <Text style={styles.helper}>
              {isRegistering
                ? 'Create an account to join the SayNative beta.'
                : 'Sign in to continue practicing.'}
            </Text>

            {!isAuthConfigured ? (
              <View style={styles.configWarning}>
                <Text style={styles.configWarningText}>
                  Firebase Auth is not configured yet. Add EXPO_PUBLIC_FIREBASE_API_KEY
                  to your environment before testing login.
                </Text>
              </View>
            ) : null}

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType={isRegistering ? 'newPassword' : 'password'}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, (busy || !isAuthConfigured) && styles.disabledButton]}
              onPress={submit}
              disabled={busy || !isAuthConfigured}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isRegistering ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                setMode(isRegistering ? 'login' : 'register')
                setError(null)
              }}
            >
              <Text style={styles.switchText}>
                {isRegistering
                  ? 'Already have an account? Sign in'
                  : 'New to SayNative? Create account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function authErrorMessage(err: unknown) {
  const code =
    typeof err === 'object' && err
      ? 'code' in err
        ? String(err.code)
        : 'message' in err
          ? String(err.message)
          : ''
      : ''

  if (code.includes('EMAIL_EXISTS')) return 'This email is already registered.'
  if (code.includes('INVALID_EMAIL')) return 'Enter a valid email address.'
  if (code.includes('INVALID_LOGIN_CREDENTIALS')) return 'Email or password is incorrect.'
  if (code.includes('WEAK_PASSWORD')) return 'Use a password with at least 6 characters.'

  return 'Something went wrong. Please try again.'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboard: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  panel: { gap: 14 },
  heading: { fontSize: 24, fontWeight: '700', color: '#111' },
  helper: { fontSize: 14, color: '#9CA3AF', lineHeight: 20, marginBottom: 4 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF6A00',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchButton: { alignItems: 'center', paddingVertical: 10 },
  switchText: { fontSize: 14, color: '#EA580C', fontWeight: '600' },
  error: { fontSize: 13, color: '#DC2626', lineHeight: 18 },
  configWarning: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  configWarningText: { fontSize: 13, color: '#C2410C', lineHeight: 18 },
})
