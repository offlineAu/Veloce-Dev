import "server-only";
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  HASH_SECRET: z.string().min(16),
  COMPANY_NAME: z.string().min(1).default("Your Company"),
  COMPANY_DESCRIPTION: z.string().min(1).default("Build fast. Build what works."),
  COMPANY_CONTACT_EMAIL: z.email().default("hello@example.com"),
  COMPANY_TIMEZONE: z.string().default("Asia/Manila"),
  NOTIFY_TEAM_EMAIL: optionalString,
  NOTIFY_FROM_EMAIL: optionalString,
  RESEND_API_KEY: optionalString,
  EMAILJS_SERVICE_ID: optionalString,
  EMAILJS_TEMPLATE_ID: optionalString,
  EMAILJS_PUBLIC_KEY: optionalString,
  EMAILJS_PRIVATE_KEY: optionalString,
  NOTIFY_REFERRER: z.enum(["true", "false"]).default("false"),
  BOOKING_ENABLED: z.enum(["true", "false"]).default("false"),
  CAL_BOOKING_URL: optionalString,
  CAL_LOCAL_MODE: z.enum(["true", "false"]).default("false"),
  CAL_API_BASE_URL: optionalString,
  CAL_EVENT_TYPE_ID: optionalString,
  CAL_HOST_ID: optionalString,
  CAL_API_KEY: optionalString,
  CAL_WEBHOOK_SECRET: optionalString,
  BOOKING_DURATION_MINUTES: optionalString,
  BOOKING_FORMAT: optionalString,
  BOOKING_COST_LABEL: optionalString,
  BOOKING_CRON_SECRET: optionalString,
  // Optional public channels shown in the footer. Any that are unset are simply not shown.
  COMPANY_WHATSAPP: optionalString, // international number; digits only are used
  SOCIAL_FACEBOOK_URL: optionalString,
  SOCIAL_INSTAGRAM_URL: optionalString,
  SOCIAL_LINKEDIN_URL: optionalString,
  SOCIAL_GITHUB_URL: optionalString,
  SOCIAL_X_URL: optionalString,
  SOCIAL_DISCORD_URL: optionalString,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Throws a readable error if misconfigured. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const keys = Object.keys(z.flattenError(parsed.error).fieldErrors).join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
