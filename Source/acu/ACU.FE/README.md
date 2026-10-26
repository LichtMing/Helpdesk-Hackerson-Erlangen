# ACU UI — Frontend

A mobile-first PWA for managing and orchestrating ACU robot devices. Built with React + TypeScript + Vite, themed after the Siemens Healthineers visual identity (Healthineers Orange `#EC6602` on clinical neutrals, generous spacing).

The console is **monitoring-only**: it shows registered robots, pending approval
requests, workflow assignments, and live workflow progress. The former patient
preview tab was removed; patient interaction happens on the robot screen.

## Highlights

- **Cross-platform PWA** — installable on Android, iOS and desktop browsers (Add to Home Screen on iOS Safari, native install prompt on Chromium).
- **Mobile-first layout** — bottom tab bar on phones, top tab strip on tablet/desktop; master/detail collapses to a stacked drawer on small screens; floating action button on the Workflows screen; touch-friendly 40+px targets.
- **Live connection state** — top bar shows a green "Live" pill while polling succeeds and a pulsing cloud-off icon when the server is unreachable; feature tabs are hidden while offline so cached data cannot mislead the operator.
- **Adaptive polling** — `useDeviceData` polls every 3 s while online and backs off exponentially (5 → 10 → 20 → 30 s cap) while offline, with a single fetch per cycle.
- **Internationalised** — English + German dictionaries in `src/i18n/`, typed against each other so missing keys are compile errors.
- **Offline-aware** — service worker (`public/sw.js`) precaches the app shell, uses network-first for `/api/*` (cached fallback when offline), and SWR for static assets.
- **Healthineers-inspired theme** — design tokens in [`src/theme/tokens.css`](src/theme/tokens.css), supports light & dark.

## Toolchain and dependencies

- Node.js `22.20+` (verified with `22.22.3`) and npm `10.9.8`.
- `package-lock.json` v3 is committed and is the authoritative dependency set:
  165 lockfile entries, 4 runtime dependencies, and 11 development
  dependencies.
- Runtime: React `18.3.1`, React DOM `18.3.1`, axios `1.20.0`, and
  react-icons `5.7.0`. The embedded Swagger UI package was removed because the
  gateway serves Swagger at `/docs` and the operator UI never imported it.
- Build and test: Vite `8.3.1`, TypeScript `5.9.3`, Vitest `5.0.2`,
  Testing Library, jsdom `25.0.1`, and Playwright `1.63.0`.
- The complete version table is in
  [`docs/DEPENDENCIES.md`](../../../docs/DEPENDENCIES.md).

## Folder layout

```
public/
  manifest.webmanifest         PWA manifest
  sw.js                        Service worker (precache + runtime cache)
  icon.svg / icon-maskable.svg / apple-touch-icon.svg

src/
  main.tsx                     Entry; registers SW in production
  App.tsx                      Composes layout shell + feature views; gates content on isServerOnline
  index.css                    Imports tokens, global styles, ui primitives
  types.ts                     Shared TS types
  icons.ts                     Central icon registry (all `react-icons/md` re-exports)
  about.ts                     Compile-time constants — APP_NAME, APP_VERSION, MANUFACTURER, BRAND_TAGLINE, BUILD_NUMBER

  theme/
    tokens.css                 Design tokens (Healthineers Orange, neutrals, spacing, motion)
    global.css                 Element resets, focus styles, scrollbar

  i18n/
    en.ts                      English dictionary (Dict = typeof en)
    de.ts                      German dictionary
    I18nProvider.tsx           Provider — exposes useI18n() / useT()

  api/                         HTTP clients (axios). deviceApi does one fetch and partitions client-side.
  hooks/
    useDeviceData.ts           Adaptive polling (3 s online → exponential back-off offline) + mutations
    useWorkflows.ts            Workflow CRUD
    useMediaQuery.ts           Responsive breakpoints

  components/
    layout/                    AppShell, TopBar (Live / cloud-off indicator), NavTabs, BottomNav
    ui/                        Reusable primitives: Modal, Toast, EmptyState, ui.css (with .surface-card and .icon-tile)

  features/
    requests/RequestsView.tsx  Connection requests + filter
    devices/DevicesView.tsx    Master/detail with assign-workflow sheet
    devices/WorkflowTimeline.tsx Live workflow progress
    workflows/WorkflowsView.tsx Create/edit/delete + bottom-sheet editor
    workflows/robot/            Robot-specific workflow editor
    settings/SettingsView.tsx  App (language) + About (System Information) tabs

  pwa/registerServiceWorker.ts

tests/                         Vitest + Testing Library unit tests
e2e/specs/                     Playwright operator-flow specs
```

## Scripts

```bash
npm run dev          # Vite dev server (proxies /api → ApiGateway)
npm run build        # tsc + vite build → dist/
npm run preview      # Preview the built bundle
npm test             # Vitest unit tests (49 tests in 11 files)
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright (see limitations below)
```

## Local configuration

A portable template is committed as `.env.example`. Copy it to `.env` and set
the gateway URL. For a gateway on the same machine:

```env
VITE_API_BASE_URL=http://localhost:3000
```

For a robot demo, use the ACU host's LAN address instead, for example
`http://192.168.1.100:3000`. Leave `VITE_API_BASE_URL` empty for the Docker
image; nginx then proxies `/api` to the `backend` service. See the
[ACU solution README](../README.md), the
[repository README](../../../README.md), and
[`docs/REPRODUCIBILITY.md`](../../../docs/REPRODUCIBILITY.md) for the full
end-to-end walkthrough.

## Docker deployment

```bash
cd Source/acu
docker compose build frontend
docker compose up -d frontend
```

The UI is served on <http://localhost:3100>. The container builds with
`VITE_API_BASE_URL=""` and `nginx.conf` forwards `/api/` to `backend:3000`.

## Testing

```bash
npm test        # unit tests: 49 passing
npm run build   # production type check + bundle
```

Playwright is configured for Chromium. The default `npm run test:e2e` path uses
`e2e/scripts/start-gateway.ps1`, so it requires Windows, PowerShell, and the
.NET SDK. On Linux/macOS, start the backend yourself and reuse it:

```bash
# terminal 1: gateway on :3000
cd Source/acu && docker compose up -d backend

# terminal 2: UI on :4173
cd Source/acu/ACU.FE
npm run dev -- --host 127.0.0.1 --port 4173

# terminal 3
npx playwright test e2e/specs/operator-flows.spec.ts
```

`e2e/specs/live-workflow-simulator.spec.ts` additionally expects a
`RobotSimulator` project that is not part of this repository snapshot.

## Installing as a PWA

- **Chrome/Edge (desktop & Android):** install icon in the address bar / "Install app" menu.
- **iOS Safari:** Share → *Add to Home Screen*. The status bar uses the `apple-mobile-web-app-status-bar-style` setting; the launcher icon uses `apple-touch-icon.svg`.

The service worker is only registered in production builds, so dev HMR is unaffected.
