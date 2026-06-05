import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native'
import { HistoryItem } from '../types'
import { getHistory, deleteFromHistory, exportHistory } from '../lib/history'

interface Props {
  onClose: () => void
}

export default function HistoryScreen({ onClose }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])

  useEffect(() => {
    getHistory().then(setItems)
  }, [])

  const handleDelete = async (id: string) => {
    await deleteFromHistory(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleExport = async () => {
    await exportHistory()
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <View style={styles.headerActions}>
          {items.length > 0 && (
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
              <Text style={styles.exportBtnText}>Export</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>No saved phrases yet</Text>
          <Text style={styles.emptySubText}>Correctly repeated sentences will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.itemContent}>
                <Text style={styles.itemEnglish}>{item.english}</Text>
                <Text style={styles.itemChinese}>{item.chinese}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  exportBtnText: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#9CA3AF' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  emptySubText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  itemContent: { flex: 1 },
  itemEnglish: { fontSize: 15, fontWeight: '500', color: '#111', lineHeight: 22 },
  itemChinese: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 14, color: '#D1D5DB' },
})
