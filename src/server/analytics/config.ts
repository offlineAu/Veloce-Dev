import "server-only";
export function analyticsConfig() {
  const enabled = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview" && process.env.ANALYTICS_ENABLED === "true" && !!process.env.POSTHOG_PROJECT_KEY;
  return {
    enabled,
    key: process.env.POSTHOG_PROJECT_KEY,
    host: process.env.POSTHOG_REGION === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com",
  };
}
