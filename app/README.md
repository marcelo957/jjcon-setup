# JJCON SetUp

React + Vite + TypeScript build of the Claude Design export in `../project`:

- **Access** (`project/JJCon Access.dc.html`): sign in, password reset, invitations and the
  Admin / Editor / Crew permission model.
- **Console** (`project/JJCon Ops.dc.html`), built in phases. Phase 1 is here: the app shell,
  Prep dashboard, Sectors index, sector page and the create/edit sector form. Tasks, Team,
  People, Field view and Print packets follow.

Styled with Bushido v2: tokens and fonts in `src/styles/bushido/`, and the console uses the
design system's own React components from `src/vendor/bushido/_ds_bundle.js` (wrapped in
`src/ds/`). Icon chunks are served from `public/bushido/icons/`.

```sh
npm install
npm run dev      # http://localhost:5173/access lists every designed state
npm test
npm run build
```

## Routes

| Route | Design states |
| --- | --- |
| `/sign-in` | 1a sign in, 1b wrong password, 1c deactivated account |
| `/forgot-password` | 2a request a reset link, 2b link sent |
| `/reset-password/:token` | 2c set a new password (+ expired / used / invalid link) |
| `/invite/:token` | 3a accept, 3b expired, 3c already used (+ withdrawn / invalid link) |
| `/access/roles` | 5 roles and permissions reference |
| `/access` | index of all of the above with demo accounts |
| `/prep` | Prep dashboard: readiness matrix, floorplan and other-item rollups, bulk owner and mark-ready |
| `/sectors` | Sectors index, Active and Archived tabs, archive / restore / delete |
| `/sectors/new`, `/sectors/:id/edit` | Create / edit form: plans, built-in blocks, custom blocks |
| `/sectors/:id` | Sector page; `?plan=G` picks a floorplan, `?edit=1` opens edit mode, `#material` etc. scroll to a card |

The phone layouts (4a–4c) are the same routes under 480px wide: no card, white page, 48px controls.

## Auth backend

Screens only talk to the `AuthService` interface (`src/auth/types.ts`). `src/auth/service.ts`
currently wires in `MockAuthService`, which keeps demo people, invitations and reset tokens in
localStorage; replace it with an HTTP implementation when the API exists. In mock mode the
"Check your email" screen shows the reset link that a real backend would email.

Demo accounts (reset them from `/access`):

| Email | Password | State |
| --- | --- | --- |
| marcelo@ibjjf.com | jjcon-admin-2027 | Admin |
| diego@ibjjf.com, cardoso@ibjjf.com | jjcon-editor-2027 | Editor |
| jackson@ibjjf.com (D'Andre) | jjcon-crew-2027 | Crew |
| p.nakamura@ibjjf.com | jjcon-crew-2027 | Deactivated |

Sessions: "Keep me signed in" (on by default) stores the session in localStorage for 30 days;
unticked, it lives in sessionStorage and ends with the browser.

## Console data

`src/ops/data/store.ts` keeps people and sectors in localStorage, seeded from the design's data
(`seed.ts`). Every screen reads it with `useOps()` and changes it only through `OpsStore`
methods, so a real API replaces that one class. Uploaded PDFs go to IndexedDB
(`src/ops/files/fileStore.ts`); the demo plans point at `sample:` ids that are drawn on demand
as real PDFs (`samplePdf.ts`). PDFs render with pdf.js (legacy build, for older phone browsers),
canvas only: no annotation layer, no document scripts.

The console loads lazily after sign-in. The Bushido bundle is 1.9 MB unminified (about 165 KB
gzipped) and cannot be tree-shaken.

Permissions: `can(role, capability, ctx)` in `src/auth/permissions.ts` reads the same table the
roles reference page renders. Use it to leave actions out of the page entirely rather than
disabling them.
