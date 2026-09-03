# The native client reaches the API over Tailscale

Production runs a Cloudflare *quick* tunnel (`cloudflared tunnel --url
http://app:80`), whose hostname is random and changes on every restart. That is
survivable for the PWA, which is served from the tunnel and calls the API
same-origin at `/api`. It is fatal for an installed APK with a base URL compiled
in. Rather than make the user re-enter a URL, or buy a domain to hold a named
tunnel, the host joins a tailnet and the native client targets a stable MagicDNS
name over HTTPS terminated by `tailscale serve`.

## Consequences

- The API is not publicly reachable for the native client; the phone must be on
  the tailnet. This is a personal single-user system, so that is a feature.
- Two access paths coexist during the migration: the PWA over the public quick
  tunnel, the native client over Tailscale. The second path disappears with the
  first when the PWA is retired.
- `tailscale serve` gives a real certificate for the `ts.net` name, so Android's
  cleartext-traffic restriction never needs an exemption — avoiding an app-wide
  `usesCleartextTraffic: true`, which would have weakened every request the app
  makes, not just the one to this host.
