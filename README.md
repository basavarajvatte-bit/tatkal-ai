# Tatkal AI

Fast, legitimate Tatkal booking **assistant** (PWA). Separate app – not connected to any other project.

- Accurate IST countdown (AC 10:00, non-AC 11:00), server-time sync, clock-drift and latency display, works offline
- Multiple journeys, up to 4 passengers, preferred + 3 backup trains, readiness score with one-tap fixes
- Booking mode (checklist → final report → countdown → big OPEN IRCTC button), instant backup-train switch, copy passenger list
- Reminders at 15/5/2/1/0 min, booking history (your own records), JSON backup/restore, installable PWA

**Privacy:** all data stays in the browser on your device. No account, no server copy. Passwords, OTPs, CVV, UPI PIN and Aadhaar numbers are never asked for or stored.

**Fair use:** no auto-login, CAPTCHA solving, OTP reading, form filling, payment or booking automation. You book on the official IRCTC site/app. No fake availability – train data is what you save from official sources (IRCTC / NTES). Not affiliated with IRCTC.

## Stack
React 19 + TypeScript + Vite, plain CSS, hand-written service worker, one Vercel function (`api/time.js`) for server time. No paid services.

## Run
```bash
npm install
npm run dev      # local
npm test         # countdown / ranking / validation tests
npm run build
```
Deploy: import the repo in Vercel (framework: Vite). No environment variables needed.

## Known limits
- No free official API for live seat availability, so it is not shown.
- Reminders fire while the app is open or recently used. Fully-closed background push needs a push server (future).
- iPhone notifications need the app added to the Home Screen (iOS 16.4+).
