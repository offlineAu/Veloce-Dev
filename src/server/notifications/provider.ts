import "server-only";
import { env } from "@/config/env";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Sent as the provider's idempotency key where supported. */
  idempotencyKey: string;
}

export interface NotificationProvider {
  /** False for providers that do not actually deliver (e.g. the dev console provider). */
  readonly delivers: boolean;
  send(email: OutgoingEmail): Promise<{ providerRef: string }>;
}

/** Dev provider: delivers nothing and logs no addresses or content. */
export const consoleProvider: NotificationProvider = {
  delivers: false,
  async send(email) {
    console.info(`[notifications] no email provider configured; not sending "${email.subject}"`);
    throw new NotDelivered("No email provider configured");
  },
};

export class NotDelivered extends Error {}

export function resendProvider(apiKey: string, from: string): NotificationProvider {
  return {
    delivers: true,
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Provider responded with ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { providerRef: body.id ?? "unknown" };
    },
  };
}

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  /** Required for server-side calls; enable "Allow EmailJS API for non-browser applications" in the dashboard. */
  privateKey: string;
}

/**
 * EmailJS REST provider. The template owns the layout; we send the finished message as
 * `subject` and `html` (rendered with {{{html}}}) and the recipient as `to_email`.
 * EmailJS has no idempotency key; duplicates are prevented by the outbox in dispatch().
 */
export function emailJsProvider(cfg: EmailJsConfig): NotificationProvider {
  return {
    delivers: true,
    async send(email) {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          accessToken: cfg.privateKey,
          template_params: { to_email: email.to, subject: email.subject, html: email.html, text: email.text },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      // EmailJS answers with a plain-text body ("OK" on success); never include it in errors.
      if (!res.ok) throw new Error(`Provider responded with ${res.status}`);
      return { providerRef: "emailjs" };
    },
  };
}

let override: NotificationProvider | undefined;

/** Test hook. */
export function setProviderForTests(p: NotificationProvider | undefined) {
  override = p;
}

export function getProvider(): NotificationProvider {
  if (override) return override;
  const e = env();
  if (e.EMAILJS_SERVICE_ID && e.EMAILJS_TEMPLATE_ID && e.EMAILJS_PUBLIC_KEY && e.EMAILJS_PRIVATE_KEY) {
    return emailJsProvider({
      serviceId: e.EMAILJS_SERVICE_ID,
      templateId: e.EMAILJS_TEMPLATE_ID,
      publicKey: e.EMAILJS_PUBLIC_KEY,
      privateKey: e.EMAILJS_PRIVATE_KEY,
    });
  }
  if (e.RESEND_API_KEY && e.NOTIFY_FROM_EMAIL) return resendProvider(e.RESEND_API_KEY, e.NOTIFY_FROM_EMAIL);
  return consoleProvider;
}
