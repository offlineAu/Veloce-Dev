import { describe, expect, it } from "vitest";
import { MAX_SHARE_TEXT, buildProspectLink, buildShareMessage, mailtoHref, whatsappHref } from "@/lib/share";

describe("share links", () => {
  const link = buildProspectLink("https://example.com", "abcDEF_123-456789012345");

  it("builds a prospect link with only the public token", () => {
    expect(link).toBe("https://example.com/?ref=abcDEF_123-456789012345");
  });

  it("includes the link and offer in the message, omits offer when absent", () => {
    const withOffer = buildShareMessage({ companyName: "Acme", link, offerTitle: "Free audit" });
    expect(withOffer).toContain(link);
    expect(withOffer).toContain("Free audit");
    const without = buildShareMessage({ companyName: "Acme", link });
    expect(without).not.toMatch(/offering/);
  });

  it("encodes mailto and WhatsApp URLs and round-trips the text", () => {
    const text = "Hi & welcome!\n\nSee https://example.com/?ref=a&b=c #1 100% ünï";
    const mail = mailtoHref("A website team I'd recommend", text);
    expect(mail.startsWith("mailto:?subject=A%20website%20team%20I'd%20recommend&body=")).toBe(true);
    expect(decodeURIComponent(mail.split("body=")[1]!)).toBe(text);
    const wa = whatsappHref(text);
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(wa).not.toMatch(/\s/);
    expect(decodeURIComponent(wa.split("text=")[1]!)).toBe(text);
  });

  it("caps very long text", () => {
    const wa = whatsappHref("a".repeat(MAX_SHARE_TEXT + 500));
    expect(decodeURIComponent(wa.split("text=")[1]!)).toHaveLength(MAX_SHARE_TEXT);
  });

  it("cannot be turned into a non-http link by a hostile token", () => {
    const u = new URL(buildProspectLink("https://example.com", "javascript:alert(1)"));
    expect(u.protocol).toBe("https:");
    expect(u.hostname).toBe("example.com");
  });
});
