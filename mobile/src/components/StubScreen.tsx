import { StyleSheet, Text, View } from 'react-native'
import { textSecondary } from '../theme'

export function StubScreen({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label} — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: textSecondary,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
