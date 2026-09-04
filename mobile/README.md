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

## Structure

- `app/` — file-based routes (expo-router)
- `src/theme.ts` — colour tokens and shared style objects ported from `app/src/theme.ts`
- `src/components/` — `FieldRow`, `SelectPicker`, `MoneyInput`, `SkeletonRows`
- `src/config/apiBaseUrl.ts` — build-time default + runtime debug override
- `src/api/client.ts` — thin fetch wrapper against the API base URL

Date and time entry uses the platform pickers (`@react-native-community/datetimepicker`)
instead of the PWA's custom `DatePicker`/`TimePicker`.
