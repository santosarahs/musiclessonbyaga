# musiclessonbyaga

**The Lesson Book** — a single-page scheduler and billing tool for an online music studio
teaching piano, guitar, voice, ukulele, and drums, with a different teacher per instrument.

## Contents

- [`index.html`](index.html) — the whole app in one self-contained file
  (no build step, no dependencies). Open it in a browser, or deploy the repo as-is
  to any static host (Vercel, GitHub Pages, Netlify) and it serves at `/`.

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

**Access**
- Passcode gate with three roles: **view only** (read), **scheduler** (edit the
  schedule), **admin** (everything, including rates, settings, and the passcodes).
- Set up on first run; admins manage passcodes and can turn the gate off entirely
  under Settings → Access.
- Note: this is a client-side gate for casual use, not real security — passcodes live
  in the page data and are not encrypted. A login backend is needed for true access
  control.

**Other**
- Light and dark themes, responsive layout, and a Print view for handouts and payment reports.
- Data is saved in the browser; when hosted as a Claude Artifact it persists across sessions.
