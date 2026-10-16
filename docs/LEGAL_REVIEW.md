# Privacy and terms rollout

Veloce is a Philippines-based freelance practice. The website uses footer links and consent beside inquiries, referrals and scheduling. There is no arrival acceptance modal. Audit deployed network requests and third-party storage before launch and whenever integrations change to determine whether optional technologies require a consent mechanism.

## Identity, contact and providers

- Set `LEGAL_ENTITY_NAME` to the individual freelancer's full name; incorporation is not assumed. `LEGAL_BUSINESS_ADDRESS` is the contact address (the existing configuration name is retained).
- Contact uses `PRIVACY_CONTACT_EMAIL` if configured, otherwise `COMPANY_CONTACT_EMAIL` from the environment. There is no need to repeat the address in source code.
- `LEGAL_HOSTING_PROVIDER`, `LEGAL_DATABASE_PROVIDER` and `LEGAL_PROCESSING_LOCATIONS` describe this website's actual services and processing/transfer arrangements, including the mailbox, scheduling and connected providers. They can change, but the notice must reflect the services currently processing this site's information.
- Providers selected for a client's separate project belong in that project's agreement and relevant privacy documentation. This website's notice does not list every possible future client provider.
- Philippine law is the default in the terms. `LEGAL_GOVERNING_LAW` can hold reviewed additional wording; do not assume a registration, corporation or exclusive court venue.

The pages remain marked “Draft for review” because the individual's full name, contact address, live provider details and external-copy deletion arrangements have not been confirmed. Complete legal review and set an effective date before removing that label.

## Thirty-day closed-record retention

A conversation must be explicitly closed before its 30-day clock starts. Age of a submission, absence of website activity and technical `updatedAt` are not closure evidence. Review outstanding inquiries and referrals regularly so abandoned records do not remain open indefinitely.

Use these commands in the trusted deployment environment with database access (record IDs are available through the owner's existing database tooling):

```sh
npm run privacy:record -- close inquiry <record-id>
npm run privacy:record -- close referral <record-id>
npm run privacy:record -- reopen inquiry <record-id>
npm run privacy:record -- reopen referral <record-id>
npm run privacy:record -- hold inquiry <record-id>
npm run privacy:record -- release inquiry <record-id>
```

`hold` and `release` also accept `referral`. A hold requires a concrete legal obligation or claim; document the reason and review date securely. It is not a reason to retain information indefinitely.

Closing an inquiry sets `NOT_PROCEEDING` and `closedAt`; closing a referral sets `DECLINED` and `closedAt`. Repeating close does not reset the clock. Reopening clears the closure date and returns an inquiry to `NEW` or a referral to `RECEIVED`. Reopening does not release a hold. Closing is refused for converted inquiries or inquiries with appointments; manage booking/project records separately. No existing record receives an inferred closure date in the migration.

After 30 complete days (720 hours), cleanup deletes closed, unheld inquiries without appointments, and closed, unheld referrals. Database cascades remove associated designs, preview links, attribution and notification rows. Records with an active email delivery lease are skipped until a later run. Active and converted records are excluded even if they have an old closure date. Each run deletes up to 250 inquiries and 250 referrals; `hasMore` indicates a backlog or records whose eligibility changed during the run. Cleanup is idempotent.

Confirmed/cancelled appointments, booking sessions and provider event journals are outside this routine inquiry sweep. They require a separate retention decision, as do contracts and invoices. Do not publish a blanket promise that every record disappears after 30 days.

## Activate scheduled cleanup

1. Run `npm run db:deploy` against the intended deployment database before starting the updated application. The migrations add consent evidence and closure/hold fields without backfilling unknown historical facts.
2. Set a dedicated random `PRIVACY_CRON_SECRET` of at least 32 characters in the app and scheduler environments. Do not reuse booking, webhook or developer secrets. The script reads `.env` and environment variables; use injected deployment values for production.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin. The cleanup caller refuses redirects and non-local HTTP so its bearer token cannot be redirected to another host.
4. Run a preview:

   ```sh
   npm run privacy:cleanup
   ```

5. Inspect the eligible counts and verify closure/hold decisions. To delete eligible records:

   ```sh
   npm run privacy:cleanup -- --apply
   ```

6. Configure the deployment scheduler to run the apply command at least daily. If `hasMore` remains true, inspect the analytics provider-deletion queue described in [ANALYTICS.md](ANALYTICS.md) before retrying; analytics-linked records remain protected until provider erasure is confirmed. For an ordinary database backlog, clear it with additional runs and increase frequency. Monitor failures; code alone does not install a hosted schedule.

The caller sends `POST /api/privacy/maintenance?dryRun=true` (or `false` with `--apply`) with bearer authorization. The endpoint rejects missing/incorrect secrets and ambiguous modes, returns counts only with `Cache-Control: no-store`, and does not expose database errors. No secret or visitor details are printed by the caller.

No existing customer record was closed or deleted as part of implementation. Tests exercise deletion in a dedicated temporary database schema.

## Copies outside the website database

Cleanup cannot delete sent messages from the freelancer's mailbox, recipients' inboxes, EmailJS/Resend, Cal.com, connected calendar/meeting services or hosting backups. Arrange mailbox disposal, provider deletion and backup expiry separately, and document the actual periods before making a complete retention promise. Keep records needed for an active project or an actual statutory obligation under a separate justified schedule. Deleting a submitted design does not remove the visitor's unsent local browser draft.

## Versioned consent and publication

New submissions send the notice version from the browser bundle. The server accepts only the current version and saves it with a server-selected purpose and timestamp. Scheduling copies the original session receipt to the resulting meeting lead. Deploy browser and server changes together; older open forms must refresh.

Previous draft source wording is archived in `docs/legal/2026-10-15`. Preserve an immutable release or archive whenever the notice or consent wording changes. Update `PRIVACY_NOTICE_VERSION` and `LEGAL_UPDATED_LABEL` in `src/lib/legal.ts`. Provider changes also require a versioned release; retain the public configuration snapshot privately so the notice shown can be reconstructed. Never archive credentials.

Reference guidance: [NPC retention advisory](https://privacy.gov.ph/wp-content/uploads/2022/01/NPC_AdvisoryOpinionNo._2017-024.pdf), [NPC right to be informed](https://privacy.gov.ph/the-right-to-be-informed/), and [NPC data subject rights](https://privacy.gov.ph/data-subject-rights/).
