# Plata — mobile

Expo app targeting Android, installed independently from `app/` and `api/` — its
own `package.json` and lockfile, not an npm workspace member. See
`docs/adr/0001-native-client-is-online-only.md` for why this client holds no
local domain data.

## Setup

```
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL if not using the default
```

## Run on a physical Android device

1. Install **Expo Go** from the Play Store on the device.
2. Make sure the device and the dev machine are on the same network.
3. From `mobile/`, run:
   ```
   npm run android
   ```
4. Scan the QR code Metro prints with Expo Go.

If the API isn't reachable at the build's default base URL (e.g. it's running
on a LAN address instead), open the **Debug** screen from the home screen,
switch to "Custom (LAN override)", enter the machine's LAN address
(`http://<lan-ip>:3000`), and save. The override is stored on-device and takes
effect immediately — no rebuild needed.

## Production build (Tailscale)

The installed APK has its API base URL baked in at build time — see
`docs/adr/0003-api-reachable-over-tailscale.md` for why it targets a Tailscale
MagicDNS name instead of the public quick tunnel the PWA uses.

### One-time: expose the API host over Tailscale HTTPS

On the host running the production `docker-compose.yml` stack (nginx listens
on host port 80 and proxies `/api/` to the API container):

1. Join the tailnet if it hasn't already: `sudo tailscale up`.
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns),
   confirm **HTTPS Certificates** is enabled for the tailnet — `tailscale
   serve --https` can't issue a cert without it.
3. Front nginx with a real cert on 443:
   ```
   sudo tailscale serve --bg --https=443 / http://127.0.0.1:80
   ```
4. Confirm the mapping: `tailscale serve status`. The stable address is
   `https://<hostname>.<tailnet-suffix>.ts.net` (find both with `tailscale
   status` / `tailscale dns status` on any tailnet member).
5. If that address isn't `https://private-cloud.tailc62b08.ts.net`, update
   `EXPO_PUBLIC_API_BASE_URL` in `eas.json`'s `production` profile to match —
   it must end in `/api` (nginx strips that prefix before proxying to the API).

This only exposes the API to devices on the tailnet; the public quick tunnel
and the PWA it serves are untouched.

### One-time: configure the EAS project

```
npx eas login              # authenticate with your Expo account
npx eas build:configure    # links this app to an EAS project, writes app.json's extra.eas.projectId
```

### Build and install

```
npm run build:android      # eas build --platform android --profile production
```

EAS builds in the cloud and prints a download link (and QR code) for the
resulting `.apk` when it finishes. On the phone (must be on the tailnet):

1. Open the link, or run `eas build:run --platform android` / `adb install
   <path-to-apk>` if you downloaded it to a machine with the phone attached.
2. Allow "install from unknown sources" for the installer if prompted —
   this is a one-time sideload permission, unrelated to network security.
3. Open the app and log in. If it can't reach the API, check the **Debug**
   screen — it shows the base URL the build resolved.
4. To confirm it isn't just working over LAN, try it on mobile data (tailnet
   only, home Wi-Fi off).

Rebuilding after this point (new features, bumped version) is just `npm run
build:android` again — no reconfiguration needed unless the Tailscale
hostname changes.

## Structure

- `app/` — file-based routes (expo-router)
- `src/theme.ts` — colour tokens and shared style objects ported from `app/src/theme.ts`
- `src/components/` — `FieldRow`, `SelectPicker`, `MoneyInput`, `SkeletonRows`, `DateTimeField`
- `src/config/apiBaseUrl.ts` — build-time default + runtime debug override

Date and time entry uses the platform pickers (`@react-native-community/datetimepicker`)
instead of the PWA's custom `DatePicker`/`TimePicker`.
