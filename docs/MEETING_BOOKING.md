# Meeting booking setup and operation

Implemented locally on 2026-10-07. Live scheduling is disabled until a real Cal.com event, connected calendar and meeting terms are configured. No real appointment or email delivery has been tested.

## Visitor behavior

The working example offers a meeting invitation at every stage. Its sample time buttons remain examples. The explicit meeting action opens the shared panel; the closing contact section can open the same panel without completing the example.

With scheduling disabled, visitors see **Request a meeting with Veloce**. The form saves a `MEETING` lead and attempts team/visitor notifications. It clearly says that no appointment is reserved. Until an email provider is configured, these notifications are logged as skipped and the team must inspect the database; saving a request does not establish email delivery. The direct email link remains available.

With scheduling enabled, visitors review the actual duration, format and cost terms, optionally edit the discussion context, and explicitly agree to sharing details with Veloce and the scheduler. The calendar then loads on demand. Cal.com collects the contact details and reserves time against its calendar configuration. A browser completion event triggers server-side verification before the site shows a confirmed appointment or approval request. Returning to the example preserves the active calendar within the page; reload draft recovery is not promised.

## Configure Cal.com

1. Create one single-host event for the Veloce introductory meeting, with a public link in the form `https://cal.com/username/event`. Connect the host's busy calendars and destination calendar. Set meeting location, duration, availability, buffers, minimum notice and booking horizon. Prefer automatic acceptance for the first release.
2. Ensure the public event identifies Veloce and explains the meeting's actual price/terms. This implementation does not collect payment. A paid meeting requires a separate payment decision and implementation before release.
3. Obtain the numeric event type ID and host/user ID, and a server-side API key with access to their bookings. Store credentials in the local/deployment environment, not source control or browser configuration.
4. Configure the normal `notes` booking field as optional and editable. The embed prefills it from discussion context; name/email are collected once by Cal.com. Confirm the event preserves `metadata[veloceSession]` for the embed and the direct booking-link fallback.
5. Add an HTTPS webhook to `/api/booking/webhook` with a strong independent secret. Subscribe to `BOOKING_CREATED`, `BOOKING_REQUESTED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED` and `BOOKING_REJECTED`. Keep standard payloads with `payload.uid`; custom webhook templates are not supported.

Set these variables using `.env.example` as the reference:

| Variable | Value |
| --- | --- |
| `BOOKING_ENABLED` | `true` only after the event is ready. |
| `CAL_BOOKING_URL` | Actual single-host event URL, without query parameters. |
| `CAL_EVENT_TYPE_ID`, `CAL_HOST_ID` | Actual positive numeric IDs. |
| `CAL_API_KEY` | Server API key. |
| `CAL_WEBHOOK_SECRET` | The secret configured on the Cal webhook. |
| `BOOKING_DURATION_MINUTES` | Actual positive integer duration matching the event. |
| `BOOKING_FORMAT` | Actual meeting format, e.g. Video call. |
| `BOOKING_COST_LABEL` | Approved cost terms, matching the event. No default free claim is supplied. |
| `BOOKING_CRON_SECRET` | Separate random secret of at least 32 characters for maintenance. |

Enabled scheduling with incomplete configuration fails clearly. Disabled scheduling needs no Cal credentials. Restart the development server after Prisma generation/migrations, and rebuild/restart when enabling scheduling so the production CSP includes the provider origins.

## Database and recovery

Run `npm run db:deploy` and `npx prisma generate` before starting the updated application. The additive migrations introduce meeting intent, appointment lifecycle tables, notification leases and a reconciliation cursor. Existing inquiry/referral records remain intact.

`BookingSession` stores hashed public/private tokens separately, verified referral attribution and consent. Opening the calendar creates no lead. Only a provider-verified booking creates an appointment and its meeting lead. Sales stages remain distinct from appointment status.

Webhook processing authenticates the raw body using `x-cal-signature-256`, durably journals the booking UID, and acknowledges receipt before re-fetching authoritative provider state with Next.js `after`. This allows providers that await delivery before committing their transition to finish the write. A cancellation/rejection that still reads as accepted stays pending for recovery rather than being marked processed. Transaction locks and provider versions prevent duplicate or stale updates. Rescheduled bookings retain replacement references. Appointment records and lifecycle ingestion remain active when new booking initiation is disabled.

For the dedicated self-hosted development setup, see [Local meeting testing](LOCAL_MEETING_TESTING.md). Hosted account configuration remains separate from the local test configuration.

Schedule the following command every five minutes from the deployed application environment:

```sh
npx tsx scripts/reconcile-bookings.ts
```

The script reads `BOOKING_CRON_SECRET` from its environment and calls `POST /api/booking/maintenance` with bearer authorization. Do not put the secret in a command argument. Configure an actual hosted scheduler/cron runner; merely adding this script does not schedule it.

Each run retries up to 25 failed/unprocessed booking events, scans up to ten provider pages of 100 bookings, and retries up to 25 meeting-request notification rows. Reconciliation starts with a seven-day lookback and overlaps subsequent windows by an hour. Its cursor and snapshot boundary persist between runs, so larger windows resume rather than restarting. The maintenance response contains counts, not visitor details.

Booking events stop automatic retries after ten failed attempts. Email notifications stop after five delivery attempts. Inspect these rows and the maintenance results; resolve provider/configuration errors before resetting attempts. Team address changes do not silently reroute an existing notification row. Do not manually mark skipped/failed notifications sent.

Notification recovery uses an atomic two-minute lease and the original provider idempotency key. A provider timeout can leave delivery uncertain: Resend deduplication depends on its idempotency retention window, and EmailJS does not support provider idempotency. Exactly-once external delivery after an ambiguous failure cannot be guaranteed with EmailJS. Prefer a provider with idempotency for the meeting-request fallback; do not send duplicate meeting confirmations from the application and Cal.com.

Useful operator checks (counts only):

```sql
SELECT status, count(*) FROM "Appointment" GROUP BY status;
SELECT "entryPoint", count(*) FROM "BookingSession" GROUP BY "entryPoint";
SELECT attempts, count(*) FROM "BookingEvent"
WHERE "processedAt" IS NULL GROUP BY attempts;
SELECT n.status, count(*) FROM "NotificationLog" n
JOIN "Lead" l ON l.id = n."leadId"
WHERE l.intent = 'MEETING' GROUP BY n.status;
```

Session counts measure calendar initiation after consent, not all invitation views. Confirmed appointment counts come from provider verification. No analytics vendor or conversion-uplift claim is included.

## Launch acceptance and rollback

Before enabling production scheduling, perform an authorized test on a dedicated Cal test event/calendar: select a time, verify the host calendar event and invitation, inspect the verified database record, cancel and reschedule, and exercise webhook/reconciliation recovery. Check real embed layout and accessibility on mobile and desktop, timezone selection, busy-slot conflicts and the direct-link fallback. The local fixture checks do not establish these external results.

Configure and verify the existing EmailJS/Resend fallback delivery, activate the maintenance schedule, and review the privacy notice for Cal.com processing. These remain owner/account/deployment setup items.

To stop new scheduling, set `BOOKING_ENABLED=false`, rebuild and restart. Keep Cal credentials, webhook and maintenance active to process existing appointments; the UI offers meeting requests instead. Do not delete booking records or revert migrations to disable booking.

## Provider contract references

- [Embed metadata and prefilling](https://cal.com/help/embedding/prefill-booking-form-embed)
- [Embed completion and loading events](https://cal.com/help/embedding/embed-events)
- [Single booking lookup](https://cal.com/docs/api-reference/v2/bookings/get-a-booking): API version `2026-02-25`.
- [Booking list and cursor pagination](https://cal.com/docs/api-reference/v2/bookings/get-all-bookings): API version `2026-05-01`.
- [Webhook authenticity](https://cal.com/docs/developing/guides/automation/webhooks)

Integration is intentionally limited to one hosted Cal.com single-host event. Team, recurring and seated booking formats require separate validation before extending it.
