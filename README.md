# musiclessonbyaga

**The Lesson Book** — a single-page scheduler and billing tool for an online music studio
teaching piano, guitar, voice, ukulele, and drums, with a different teacher per instrument.

## Contents

- [`lesson-book.html`](lesson-book.html) — the whole app in one self-contained file
  (no build step, no dependencies). Open it in a browser.

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
