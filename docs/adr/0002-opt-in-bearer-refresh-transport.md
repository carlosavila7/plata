# Refresh tokens reach native clients by opt-in, not by default

`/auth/login`, `/auth/register` and `/auth/refresh` deliver the refresh token in
an httpOnly cookie, which a browser can hold but JavaScript cannot read — the
reason the PWA survives an XSS without leaking a 7-day credential. React Native
has no equivalent guarantee, so these endpoints also return `refreshToken` in the
JSON body, and `/auth/refresh` accepts it in the request body — but **only** when
the request carries `X-Refresh-Transport: body`.

The opt-in is the whole point. Always returning the token in the body would be
less code and would hand that credential back to any script injected into the
PWA, which stays in production throughout the migration. Separate `/auth/native/*`
routes were rejected instead: they would duplicate login throttling, token
rotation and revocation, which are the last things that should exist twice.

## Consequences

- Rotation is destructive — `/auth/refresh` revokes the token it was given. The
  native client must commit the new token to secure storage before acting on the
  response, or a kill in between logs the user out.
- `REFRESH_TOKEN_TTL_DAYS` was raised from 7 to 30. The token is rotating,
  revocable and hardware-backed on the device; a login screen appearing mid-
  purchase is the more expensive failure.
