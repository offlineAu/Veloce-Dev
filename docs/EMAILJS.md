# EmailJS setup

Veloce sends notification email through EmailJS when `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`,
`EMAILJS_PUBLIC_KEY` and `EMAILJS_PRIVATE_KEY` are all set (otherwise Resend, otherwise nothing is sent).
Calls are made **server-side** from `src/server/notifications/provider.ts`; keys never reach the browser.

## 1. Dashboard settings
1. **Account > Security**: enable **Allow EmailJS API for non-browser applications** (otherwise the API returns 403).
2. **Account > General**: copy the **Public Key** and **Private Key** into `.env`.
3. **Email Services**: service ID is `service_7lvdmxo`.

## 2. Create the template (Email Templates > Create New Template > Code Editor)
Use the **Code editor** (not the visual designer) and paste the contents of `docs/emailjs-template.html`.

Settings tab:

| Field | Value |
| --- | --- |
| To Email | `{{to_email}}` |
| Subject | `{{subject}}` |
| From Name | your company name |
| Reply To | your contact address |

Save, then copy the **Template ID** into `EMAILJS_TEMPLATE_ID`.

## How it works
The app renders each message (team notification, acknowledgement, introduction) to finished HTML with its own
branded wrapper, then sends `to_email`, `subject` and `html` as template parameters. The template only outputs
`{{{html}}}` (triple braces = unescaped). All interpolated user values are escaped in `templates.ts` before this point.
One template therefore serves every message type.

## Limits
EmailJS has no idempotency key, no plain-text part, and the free plan allows about 200 emails per month.
Duplicate prevention comes from the `NotificationLog` outbox.
