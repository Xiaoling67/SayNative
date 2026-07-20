import AsyncStorage from '@react-native-async-storage/async-storage'

const AUTH_STORAGE_KEY = 'saynative_auth_session'
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY

export const isAuthConfigured = Boolean(FIREBASE_API_KEY)

export interface AuthUser {
  uid: string
  email: string
  idToken: string
}

interface StoredAuthSession extends AuthUser {
  refreshToken: string
  expiresAt: number
}

type AuthListener = (user: AuthUser | null) => void

const listeners = new Set<AuthListener>()
let currentUser: AuthUser | null = null

export function subscribeToAuthState(callback: AuthListener) {
  listeners.add(callback)
  void restoreSession().then(callback)

  return () => {
    listeners.delete(callback)
  }
}

export async function registerWithEmail(email: string, password: string) {
  const session = await callFirebaseAuth('accounts:signUp', {
    email: email.trim(),
    password,
    returnSecureToken: true,
  })
  return saveSession(session)
}

export async function loginWithEmail(email: string, password: string) {
  const session = await callFirebaseAuth('accounts:signInWithPassword', {
    email: email.trim(),
    password,
    returnSecureToken: true,
  })
  return saveSession(session)
}

export async function logout() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
  currentUser = null
  notify()
}

export async function getCurrentUser() {
  return restoreSession()
}

async function restoreSession() {
  if (currentUser) return currentUser

  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as StoredAuthSession
    if (session.expiresAt <= Date.now()) {
      return refreshSession(session)
    }

    currentUser = {
      uid: session.uid,
      email: session.email,
      idToken: session.idToken,
    }
    return currentUser
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

async function refreshSession(previousSession: StoredAuthSession) {
  if (!FIREBASE_API_KEY) return null

  try {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(previousSession.refreshToken)}`,
      },
    )
    const json = await response.json()

    if (!response.ok) {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    const session: StoredAuthSession = {
      uid: json.user_id,
      email: previousSession.email,
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + Number(json.expires_in) * 1000,
    }

    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    currentUser = {
      uid: session.uid,
      email: session.email,
      idToken: session.idToken,
    }
    return currentUser
  } catch {
    return null
  }
}

async function saveSession(response: FirebaseAuthResponse) {
  const expiresInMs = Number(response.expiresIn) * 1000
  const session: StoredAuthSession = {
    uid: response.localId,
    email: response.email,
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + expiresInMs,
  }

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  currentUser = {
    uid: session.uid,
    email: session.email,
    idToken: session.idToken,
  }
  notify()
  return currentUser
}

function notify() {
  listeners.forEach((listener) => listener(currentUser))
}

async function callFirebaseAuth(endpoint: string, body: Record<string, unknown>) {
  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_NOT_CONFIGURED')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const json = await response.json()

  if (!response.ok) {
    throw new Error(json?.error?.message || 'AUTH_REQUEST_FAILED')
  }

  return json as FirebaseAuthResponse
}

interface FirebaseAuthResponse {
  idToken: string
  email: string
  refreshToken: string
  expiresIn: string
  localId: string
}
