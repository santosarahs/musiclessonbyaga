# musiclessonbyaga

**The Lesson Book** — a single-page scheduler and billing tool for an online music studio
teaching piano, guitar, voice, ukulele, and drums, with a different teacher per instrument.

## Contents

- [`index.html`](index.html) — page shell: theme CSS, the embedded sample-data
  seed, and two `<script type="module">` tags that load the built bundles from `dist/`.
- [`src/`](src) — the app itself, in TypeScript:
  - `app.ts` — schedule, billing, students, all rendering and modals (formerly the inline `#main` script).
  - `firebase-client.ts` — Google Sign-In + Firestore glue, exposed as `window.LessonBookFB` (formerly `#firebase-init`).
  - `types.ts` — the shared data model (lessons, bills, bookings, students, rates…).
  - `vendor/*.d.ts` — hand-written ambient types for the three Firebase SDK modules, which are still loaded straight from the `gstatic.com` CDN at runtime (not bundled) — see below.
- `dist/` — build output (`app.js`, `firebase-client.js`), **git-ignored**; generate it with `npm run build`.
- [`firestore.rules`](firestore.rules) — access control for the Firebase backend (see below).

## Development

```
npm install
npm run build      # type-checks with tsc, then bundles src/ -> dist/ with esbuild
npm run watch       # rebuilds dist/ on save, for local iteration (skips type-checking)
npm run typecheck   # tsc --noEmit only
```

Then open `index.html` through a local static server (module scripts can't load over
`file://`) — e.g. `npx serve .` — or deploy as below. There's no framework and no
runtime dependencies: `esbuild` and `typescript` are dev-only, and the Firebase SDK is
still loaded from the CDN at the exact URLs in `firebase-client.ts` (esbuild is told to
leave `https://` imports alone rather than bundle them).

## Backend (Firebase)

Login and the shared schedule/billing data run on Firebase (Google Sign-In + Firestore),
free tier. To stand up your own instance:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com),
   enable **Authentication → Sign-in method → Google**, and enable **Firestore Database**
   (production mode).
2. **Project settings → Your apps →** register a web app, copy the `firebaseConfig` object,
   and paste it into the `firebaseConfig` block near the top of
   [`src/firebase-client.ts`](src/firebase-client.ts). It's a public client identifier,
   not a secret — safe to commit. Re-run `npm run build` after changing it.
3. In **Firestore Database → Rules**, paste in the contents of `firestore.rules` and Publish.
4. Deploy to Vercel as usual — `vercel.json` in this repo tells Vercel to run
   `npm run build` and serve the repo root (which now includes the generated `dist/`).
   Then in Firebase, **Authentication → Settings → Authorized domains**, add your Vercel
   domain (e.g. `your-app.vercel.app`) so Google Sign-In works there.

Access is by Google account email, hard-coded for the first two people in both
`src/firebase-client.ts` (`BOOTSTRAP_ROLES`) and `firestore.rules` (`bootstrapRole()`) —
keep those two lists in sync if you ever change them. The admin can add or remove anyone
else from **Settings → Manage access** in the app itself, no code changes needed.

Note: unlike before, this app can no longer be pasted in as a single self-contained Claude
Artifact — it now depends on a build step and on separate `dist/*.js` files that an Artifact
can't produce or fetch. Use a real static host (Vercel/Netlify/GitHub Pages) that runs
`npm run build` as part of the deploy.

## What it does

**Schedule**
- **Week** view — a recurring Mon–Sun grid of standing weekly lessons; click a slot to add one.
- **Month** view — a dated calendar; weekly lessons repeat onto matching weekdays, one-off
  lessons sit on their own date. Click a day to see everything on it.
- All teachers on one calendar, colour-coded by instrument, with per-teacher filter chips.

**Billing**
- Per-instrument rates with separate **Local** and **Foreigner / abroad** pricing.
- Packages — e.g. Piano 12 sessions, ₱300 off the total, locals only.
- A transactions ledger: date, student, lesson, sessions, rate, discount, total, amount paid,
  balance, and status (unpaid / partial / paid), with Billed / Collected / Outstanding totals.

**Other**
- Light and dark themes, responsive layout, and a Print view for handouts and payment reports.
- Data is saved in the browser; when hosted as a Claude Artifact it persists across sessions.
