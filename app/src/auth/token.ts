// In-memory access token. Deliberately NOT persisted — on reload it is re-minted
// via a silent /auth/refresh (httpOnly cookie). Keeps the token out of storage/XSS.
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
