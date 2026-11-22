# Tatkal AI

Fast, legitimate Tatkal booking **assistant** (PWA). Separate app – not connected to any other project.

- Accurate IST countdown (AC 10:00, non-AC 11:00), server-time sync, clock-drift and latency display, works offline
- Multiple journeys, up to 4 passengers, preferred + 3 backup trains, readiness score with one-tap fixes
- Booking mode (checklist → final report → countdown → big OPEN IRCTC button), instant backup-train switch, copy passenger list
- **Train number search** (v1.1): enter a 5-digit number → name, type, route with every halting station (arr/dep/halt/day/km/platform), running days, classes, distance, duration, data source + last-updated time. `TRAIN NOT FOUND` for invalid numbers. Saved on the device for instant repeat searches; old copies are labelled.
- **BOOK THIS TRAIN → booking plan**: boarding/destination picked from the real route (destination must come after boarding), class from the train's real classes, warns if the train doesn't run on that date, Tatkal date counted from the train's start date at its origin
- **Passenger profiles & groups**: save / edit / delete / activate-deactivate passengers, save groups (Family, Friends…), plans restore the chosen passengers when reopened
- Plans can be activated/deactivated (inactive = no reminders)
- Reminders default 45/15/1/0 min before opening (non-AC 10:15, 10:45, 10:59, 11:00; AC 9:15, 9:45, 9:59, 10:00), changeable in Settings
- **Tatkal Agent** (v1.2, `#/agent`, nav "Agent"): one screen that picks the next plan, re-checks it against the real timetable (train runs that day, class exists, stations on route & in order, boarding day → correct Tatkal date), passengers, backups, internet, clock and IRCTC reachability; shows phase-by-phase instructions + countdown; opens the **official IRCTC Rail Connect app** on Android (`intent:` link to `cris.org.in.prs.ima`, falls back to the website) or the website; final summary + copy passengers (on tap); records the result (PNR / RAC / WL / payment failed / failed) and then blocks a second booking of the same plan. Never switches train or books by itself.
- Home-screen shortcuts (long-press the installed app icon): Tatkal Agent, Search train
- Booking history (your own records), JSON backup/restore, installable PWA

**Privacy:** all data stays in the browser on your device. No account, no server copy. Passwords, OTPs, CVV, UPI PIN and Aadhaar numbers are never asked for or stored.

**Fair use:** no auto-login, CAPTCHA solving, OTP reading, form filling, payment or booking automation. You book on the official IRCTC site/app. No fake availability – train data is what you save from official sources (IRCTC / NTES). Not affiliated with IRCTC.

## Stack
React 19 + TypeScript + Vite, plain CSS, hand-written service worker, Vercel functions: `api/time.js` (server time) and `api/train.js` (train lookup). No paid services.

## Train data
There is **no free official public API** from Indian Railways / CRIS / IRCTC. The government open-data timetable on data.gov.in is from ~2015 and out of date. So:

1. **Automatic:** `api/train.js` asks [RailRadar](https://railradar.in/docs) (independent, *not* Indian Railways; free plan ≈ 100 requests/month). Results are cached on Vercel's CDN for a day and on the phone, so repeat searches don't use the quota.
2. **Fallback:** if the lookup fails (no key, limit reached, provider down, offline) the app says so and offers **NTES ↗** (official) and **Khud bharo** (manual journey with the train number pre-filled).

The app never invents train details: wrong-number / broken responses are rejected and shown as `TRAIN NOT FOUND` or an error. Timetable ≠ live status – live status links to NTES.

**Setup (easy):** get a free key at railradar.in → Tatkal AI → **Settings** → *Train search key* → paste → **Save key**. Stored only on that phone (not in backups) and sent only to this app's own `/api/train`. **Or** (server-wide): Vercel → Settings → Environment Variables → `RAILRADAR_API_KEY` → Redeploy; this takes priority.

## Run
```bash
npm install
npm run dev      # local
npm test         # countdown / ranking / validation tests
npm run build
```
Deploy: import the repo in Vercel (framework: Vite). No environment variables needed.

## Why the agent can't press "Book" for you
IRCTC gives booking APIs only to licensed agents / partners (B2B/B2C principal service providers, e.g. ixigo, RailYatri), not to personal apps. Using the website's private API or screen automation breaks IRCTC rules and can get the account blocked. So login, CAPTCHA, Aadhaar OTP, passenger submit and payment stay with the user; the agent does everything around them. A browser also can't open another app without a tap, so the launch button needs one tap.

## Known limits
- No free official API for live seat availability, so it is not shown.
- Reminders fire while the app is open or recently used. Fully-closed background push needs a push server + database (not free) – not built, so delivery is not guaranteed.
- Passenger data is kept only in this browser (localStorage). It is not encrypted at rest, because the key would have to live on the same device; the protection is that it never leaves the phone. Use "Delete all data" in Settings to wipe it.
- Premium Tatkal availability per train is not in the data, so the app only warns to check IRCTC.
- iPhone notifications need the app added to the Home Screen (iOS 16.4+).
