# Client tracker

`/admin/clients` lists every inquiry with its stage, what to do next and when the person was last contacted. It uses the same owner login as `/admin/analytics` and is excluded from tracking and search indexing.

## Before deploying

Apply the migration **before** the new code goes live:

```sh
npm run db:deploy
```

`20261023000000_client_tracker` adds `Lead.stageChangedAt`, `Lead.lastContactedAt`, the `LeadActivity` timeline table and the `LEAD_FOLLOW_UP` notification kind. Prisma reads every `Lead` column, so without the migration inquiry submissions fail as well, not just the tracker.

## Stages and suggestions

New → Contacted → Consultation → Proposal → Won, or Not proceeding. Suggestions are drafts; nothing is sent on a schedule.

| Stage | Suggested when | Overdue after |
|---|---|---|
| New | always (no first reply yet) | 1 day |
| Contacted | 5 days without contact or a stage change | 10 days |
| Consultation | a confirmed meeting has ended and there was no contact since | 2 days after the meeting |
| Proposal | 7 days without contact or a stage change | 14 days |

"Needs attention" counts overdue inquiries. A follow-up email or a logged contact ("I contacted them") moves a New inquiry to Contacted.

## Follow-up emails

The owner picks a draft, edits it and confirms before anything is sent. Each send goes through the notification outbox with its own dedupe key, so a double click cannot send twice. Limits: 3 follow-ups per person per day, plus the global notification budget. Sending is turned off when no email provider is configured (see [EMAILJS.md](EMAILJS.md)).

Follow-ups are only for the person's own inquiry and are refused for closed inquiries. The privacy notice promises no mailing list; marketing email would need a separate opt-in.

## Closing and retention

"Close as not proceeding" uses the existing privacy close workflow: won inquiries and inquiries with a booking can't be closed, and closed inquiries are deleted by the retention cleanup after the retention period unless reopened. The timeline is deleted with the inquiry.
