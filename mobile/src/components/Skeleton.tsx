import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { border, surface } from '../theme'

function SkeletonBar({ width, flex }: { width?: number; flex?: number }) {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[skeletonStyles.bar, { opacity }, width != null ? { width } : null, flex != null ? { flex } : null]}
    />
  )
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={skeletonStyles.row}>
          <SkeletonBar width={52} />
          <SkeletonBar flex={1} />
          <SkeletonBar width={64} />
        </View>
      ))}
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  bar: {
    height: 12,
    borderRadius: 2,
    backgroundColor: surface,
  },
})
