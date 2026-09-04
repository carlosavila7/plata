import * as SecureStore from 'expo-secure-store'

// The refresh token is the only credential this app persists — in the OS
// keystore, never in plain storage (AsyncStorage, filesystem, etc). See ADR-0001.
const KEY = 'refreshToken'

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY)
}

export function setRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, token)
}

export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY)
}
