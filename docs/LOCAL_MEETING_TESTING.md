# Local meeting testing

Configured on 2026-10-08 using the Cal.diy checkout at `/Users/au/Projects/cal.com`.

Veloce uses `.env.development.local` for the local scheduler. Hosted Cal configuration remains in `.env`. Next.js loads this file only in development, so production builds use hosted settings. Local mode is also rejected in production. No hosted Cal bookings were made by these checks.

## Try it

1. Open http://localhost:3000 and go to **Our approach**.
2. Click **Book a meeting with Veloce** under **Have a workflow like this?**.
3. Agree to the privacy notice, then click **Choose a real meeting time**.
4. Choose a date and available time, enter a test name/email, and confirm. Use `your-test-name@example.test` to keep test addresses clearly separate.
5. Veloce displays confirmation only after checking the real local Cal API. The provider details link supports rescheduling and cancellation.
6. Open http://localhost:8025 to inspect the local invitation and calendar attachment. MailDev captures messages locally and has no outgoing relay configured.

Cal's direct meeting page is http://localhost:3002/veloce-local/intro. Sign in at http://localhost:3002/auth/login with `veloce-local@example.test` / `VeloceLocal2026!` to inspect bookings or change the test availability.

This is a dedicated local test account, with a 30-minute in-person placeholder location, no charge, and availability every day from 09:00 to 18:00 Asia/Manila. It is not connected to Google/Microsoft calendars or a video service. Local booking persistence, notifications and webhook processing are real; external calendar busy checks and video-room creation are not part of this local test.

## Restart

Both local PostgreSQL instances must be running: Cal on port 5432 and Veloce on port 54329. Start Veloce's database with `npm run db:dev` if needed. Keep Cal's existing PostgreSQL service and dedicated `calendso` database available.

From the Veloce project:

```sh
npm run dev:booking
```

This starts Redis (6379), MailDev (SMTP 1025 / inbox 8025), the built Cal API (5555), Cal web (3002), and Veloce (3000). It reuses services already listening on those ports. Restart a reused Veloce process yourself if you changed its environment. Logs for newly started services are in `.dev-db/booking-logs/`. Keep the terminal open; Ctrl+C stops only services the command started.

Redis was installed locally with Homebrew. MailDev is pinned to 2.2.1 because the installed 3.0.0 package did not serve its inbox UI.

Cal's root `package.json` pins `@radix-ui/react-slot` to 1.2.3 and `@radix-ui/react-presence` to 1.1.5 through Yarn resolutions. Older nested versions accessed `element.ref` and caused React 19 console-error overlays in the local booking page. These resolutions and Cal's updated `yarn.lock` must be retained when reinstalling dependencies. Desktop/mobile date selection and the booking form were checked with zero deprecated-ref errors after this change on 2026-10-09; an actual booking also reached Veloce's verified confirmation.

If you update the Cal checkout, rebuild the API with `yarn dev:build` from `apps/api/v2`, and rebuild the embed with `yarn workspace @calcom/embed-core build` from the Cal root before restarting. API configuration is in `apps/api/v2/.env`, sharing the Cal database and auth/encryption settings. The local API uses booking version `2024-08-13` and offset pagination, matching this checkout.

## Recovery

Cal sends authenticated webhooks to `http://localhost:3000/api/booking/webhook`. Its secret matches Veloce's `.env.development.local`. If Veloce was stopped during a booking change, run maintenance after restarting:

```sh
node --env-file=.env --env-file=.env.development.local --import tsx scripts/reconcile-bookings.ts
```

Maintenance is manual in this local setup; no recurring cron job was installed. Webhooks are journaled before acknowledgement, then processed after the response so Cal can commit its transition. A still-uncommitted cancellation remains retryable. Session reference/access token separation, host/event matching and signature verification stay active in local mode.

Verified locally: desktop and mobile bookings, the Veloce confirmation screen and matching database records, rescheduling, automatic cancellation synchronization, local invitation delivery, and maintenance recovery. The test appointments were cancelled to free their slots.

Cal's prior root environment is saved in `.env.before-veloce-local` inside its checkout. Keep all environment files and API keys out of source control.
