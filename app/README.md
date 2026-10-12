# JJCON SetUp — access

React + Vite + TypeScript build of `project/JJCon Access.dc.html`: sign in, password reset,
invitations and the Admin / Editor / Crew permission model. Styled with the Bushido v2 tokens
and fonts copied into `src/styles/bushido/`.

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
| `/` | signed-in landing with "Signed in as" and Sign out (placeholder until the console is built) |

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

Permissions: `can(role, capability, ctx)` in `src/auth/permissions.ts` reads the same table the
roles reference page renders. Use it to leave actions out of the page entirely rather than
disabling them.
