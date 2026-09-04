import AsyncStorage from '@react-native-async-storage/async-storage'

// Baked in per build (EAS build profiles / .env) so a production APK points at
// the Tailscale hostname without code changes. See docs/adr/0003.
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'

// Runtime override for pointing a dev build at a LAN address without a
// rebuild — set from the Debug screen, reachable from the home screen.
const OVERRIDE_KEY = 'debug.apiBaseUrlOverride'

export async function getApiBaseUrl(): Promise<string> {
  const override = await AsyncStorage.getItem(OVERRIDE_KEY)
  return override || DEFAULT_API_BASE_URL
}

export async function getApiBaseUrlOverride(): Promise<string | null> {
  return AsyncStorage.getItem(OVERRIDE_KEY)
}

export async function setApiBaseUrlOverride(url: string | null): Promise<void> {
  if (url && url.trim()) {
    await AsyncStorage.setItem(OVERRIDE_KEY, url.trim())
  } else {
    await AsyncStorage.removeItem(OVERRIDE_KEY)
  }
}
