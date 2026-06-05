import { useState } from 'react'
import { Modal } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import MainScreen from './src/screens/MainScreen'
import HistoryScreen from './src/screens/HistoryScreen'

export default function App() {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <StatusBar style="dark" />
      <MainScreen onOpenHistory={() => setHistoryOpen(true)} />
      <Modal
        visible={historyOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <HistoryScreen onClose={() => setHistoryOpen(false)} />
      </Modal>
    </>
  )
}
