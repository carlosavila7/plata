// In-memory access token only — never persisted. On cold start it is re-minted
// via a silent /auth/refresh from the refresh token in secure storage.
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}
