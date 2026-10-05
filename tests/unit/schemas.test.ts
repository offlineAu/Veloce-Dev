import { describe, expect, it } from "vitest";
import { inquirySchema } from "@/schemas/inquiry";
import { introductionSchema } from "@/schemas/introduction";

const guard = { idempotencyKey: crypto.randomUUID(), startedAt: 0 };
const inquiry = {
  name: "  Ana   Cruz ", email: " ANA@Example.COM ", projectType: "REDESIGN", projectGoals: "Book online",
  privacyConsent: true, ...guard,
};

describe("inquirySchema", () => {
  it("normalises input", () => {
    const r = inquirySchema.parse({ ...inquiry, companyName: "  ", currentWebsite: "example.com", additionalDetails: "a\r\nb" });
    expect(r.name).toBe("Ana Cruz");
    expect(r.email).toBe("ana@example.com");
    expect(r.companyName).toBeUndefined();
    expect(r.currentWebsite).toBe("https://example.com");
    expect(r.intent).toBe("CONVERSATION");
    expect(r.referralClaimed).toBe(false);
  });

  it.each([
    [{ name: "" }, "name"],
    [{ email: "nope" }, "email"],
    [{ projectType: "HACK" }, "projectType"],
    [{ projectGoals: "" }, "projectGoals"],
    [{ privacyConsent: false }, "privacyConsent"],
    [{ currentWebsite: "javascript:alert(1)" }, "currentWebsite"],
    [{ currentWebsite: "ftp://example.com" }, "currentWebsite"],
    [{ name: "x".repeat(101) }, "name"],
    [{ idempotencyKey: "not-a-uuid" }, "idempotencyKey"],
  ])("rejects %j", (patch, field) => {
    const r = inquirySchema.safeParse({ ...inquiry, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === field)).toBe(true);
  });

  it("strips control characters and drops malformed tokens instead of failing", () => {
    const r = inquirySchema.parse({ ...inquiry, name: "Ana\u0000 Cruz", refToken: "<script>" });
    expect(r.name).toBe("Ana Cruz");
    expect(r.refToken).toBeUndefined();
  });

  it("does not accept client-supplied campaign ids", () => {
    const r = inquirySchema.parse({ ...inquiry, referralCampaignId: "evil" });
    expect("referralCampaignId" in r).toBe(false);
  });
});

describe("introductionSchema", () => {
  const intro = {
    referrerName: "Ana", referrerEmail: "ana@example.com", referredName: "Bo", referredEmail: "bo@example.com",
    projectInterest: "UNSURE", referrerConsent: true, ...guard,
  };
  it("accepts a valid introduction", () => {
    expect(introductionSchema.safeParse(intro).success).toBe(true);
  });
  it("requires the referrer's consent attestation", () => {
    expect(introductionSchema.safeParse({ ...intro, referrerConsent: false }).success).toBe(false);
  });
  it("rejects introducing yourself", () => {
    const r = introductionSchema.safeParse({ ...intro, referredEmail: "ANA@example.com" });
    expect(r.success).toBe(false);
  });
});
