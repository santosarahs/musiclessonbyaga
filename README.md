# musiclessonbyaga

**The Lesson Book** — a single-page scheduler and billing tool for an online music studio
teaching piano, guitar, voice, ukulele, and drums, with a different teacher per instrument.

## Contents

- [`index.html`](index.html) — the whole app in one self-contained file
  (no build step, no dependencies). Open it in a browser, or deploy the repo as-is
  to any static host (Vercel, GitHub Pages, Netlify) and it serves at `/`.
- [`firestore.rules`](firestore.rules) — access control for the Firebase backend (see below).

## Backend (Firebase)

Login and the shared schedule/billing data run on Firebase (Google Sign-In + Firestore),
free tier. To stand up your own instance:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com),
   enable **Authentication → Sign-in method → Google**, and enable **Firestore Database**
   (production mode).
2. **Project settings → Your apps →** register a web app, copy the `firebaseConfig` object,
   and paste it into the `firebaseConfig` block near the top of the `firebase-init` script
   tag in `index.html`. It's a public client identifier, not a secret — safe to commit.
3. In **Firestore Database → Rules**, paste in the contents of `firestore.rules` and Publish.
4. Deploy to Vercel as usual. Then in Firebase, **Authentication → Settings → Authorized
   domains**, add your Vercel domain (e.g. `your-app.vercel.app`) so Google Sign-In works there.

Access is by Google account email, hard-coded for the first two people in both
`index.html` (`BOOTSTRAP_ROLES`) and `firestore.rules` (`bootstrapRole()`) — keep those two
lists in sync if you ever change them. The admin can add or remove anyone else from
**Settings → Manage access** in the app itself, no code changes needed.

Note: this app can also be hosted as a Claude Artifact for local/offline use, but Firebase
login won't work there — the Artifact sandbox blocks the network calls Google Sign-In and
Firestore need. Use a real static host (Vercel/Netlify/GitHub Pages) for the Firebase-backed
version.

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
