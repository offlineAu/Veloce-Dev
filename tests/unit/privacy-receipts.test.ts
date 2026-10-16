import { describe, expect, it } from "vitest";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import { inquirySchema } from "@/schemas/inquiry";
import { introductionSchema } from "@/schemas/introduction";
import { meetingRequestSchema, meetingSessionSchema } from "@/schemas/meeting";

const guard = { idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 5000 };
const cases = [
  ["inquiry", inquirySchema, { ...guard, name: "Ana", email: "ana@example.com", projectType: "OTHER", projectGoals: "A website", privacyConsent: true }],
  ["introduction", introductionSchema, { ...guard, referrerName: "Ana", referrerEmail: "ana@example.com", referredName: "Bo", referredEmail: "bo@example.com", projectInterest: "UNSURE", referrerConsent: true }],
  ["meeting request", meetingRequestSchema, { ...guard, name: "Ana", email: "ana@example.com", privacyConsent: true }],
  ["scheduler", meetingSessionSchema, { entryPoint: "contact", privacyConsent: true }],
] as const;

describe("privacy receipt boundaries", () => {
  it.each(cases)("%s rejects missing and stale notices and accepts the displayed version", (_name, schema, input) => {
    for (const privacyNoticeVersion of [undefined, "2020-01-01"]) {
      const result = schema.safeParse({ ...input, privacyNoticeVersion });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === "privacyNoticeVersion")).toBe(true);
    }
    expect(schema.safeParse({ ...input, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }).success).toBe(true);
  });
});
