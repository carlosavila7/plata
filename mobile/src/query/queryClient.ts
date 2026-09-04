import { AppState, type AppStateStatus } from 'react-native'
import { QueryClient, focusManager } from '@tanstack/react-query'

// TanStack Query's refetch-on-focus is web-only by default (it listens for the
// `visibilitychange` DOM event, which doesn't exist in React Native). Wiring
// AppState in is what makes coming back to the foreground behave like the
// PWA's visibility-driven sync trigger.
AppState.addEventListener('change', (state: AppStateStatus) => {
  focusManager.setFocused(state === 'active')
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
})
