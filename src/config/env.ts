import "server-only";
import { z } from "@/lib/security/schema";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  SECURITY_CSP_MODE: z.enum(["report-only", "enforce"]).default("report-only"),
  SECURITY_TRUSTED_IP_HEADER: z.preprocess(v => v === "" ? undefined : v, z.enum(["x-real-ip", "x-forwarded-for"]).optional()),
  ANALYTICS_OWNER_TOTP_SECRET: z.preprocess(v => v === "" ? undefined : v, z.string().regex(/^[A-Z2-7]{32,128}$/).optional()),
  OWNER_SESSION_VERSION: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default("1"),
  DEV_SESSION_VERSION: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default("1"),
  ANALYTICS_ENABLED: z.enum(["true", "false"]).default("false"),
  POSTHOG_PROJECT_KEY: optionalString,
  POSTHOG_PROJECT_ID: optionalString,
  POSTHOG_PERSONAL_API_KEY: optionalString,
  ANALYTICS_OWNER_PASSWORD_HASH: optionalString,
  ANALYTICS_OWNER_SESSION_SECRET: z.preprocess(v => v === "" ? undefined : v, z.string().min(32).optional()),
  POSTHOG_REGION: z.enum(["eu", "us"]).default("eu"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  HASH_SECRET: z.string().min(16),
  COMPANY_NAME: z.string().min(1).default("Your Company"),
  COMPANY_DESCRIPTION: z.string().min(1).default("Build fast. Build what works."),
  COMPANY_CONTACT_EMAIL: z.email().default("hello@example.com"),
  LEGAL_ENTITY_NAME: optionalString,
  LEGAL_BUSINESS_ADDRESS: optionalString,
  PRIVACY_CONTACT_EMAIL: z.preprocess(v => v === "" ? undefined : v, z.email().optional()),
  LEGAL_HOSTING_PROVIDER: optionalString,
  LEGAL_DATABASE_PROVIDER: optionalString,
  LEGAL_PROCESSING_LOCATIONS: optionalString,
  LEGAL_GOVERNING_LAW: optionalString,
  PRIVACY_CRON_SECRET: z.preprocess(v => v === "" ? undefined : v, z.string().min(32).optional()),
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
  // Developer template upload (shortcut + shared password). Both unset: the upload panel is switched off.
  TEMPLATE_UPLOAD_PASSWORD_HASH: optionalString, // scrypt "salt:hash" from `npm run template:password`
  DEV_SESSION_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined))
    .refine((v) => v === undefined || v.length >= 32, "DEV_SESSION_SECRET must be at least 32 characters"),
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
