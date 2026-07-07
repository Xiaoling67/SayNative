import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native'
import { subscribeToAuthState, type AuthUser } from '../lib/auth'
import AuthScreen from '../screens/AuthScreen'

interface Props {
  children: React.ReactNode
}

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser)
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </SafeAreaView>
    )
  }

  if (!user) return <AuthScreen />

  return <>{children}</>
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
})
