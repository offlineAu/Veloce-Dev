import { describe, expect, it } from "vitest";
import { servicePageHref, withReferral } from "@/content/seo";
import { serializeJsonLd } from "@/lib/seo";

describe("SEO helpers", () => {
  it("keeps a verified referral before the fragment and preserves existing queries", () => {
    expect(withReferral("/#services", "valid-token")).toBe("/?ref=valid-token#services");
    expect(withReferral("/build?template=shop", "valid-token")).toBe("/build?template=shop&ref=valid-token");
    expect(servicePageHref("modernization", "valid-token")).toBe("/services/website-redesign?ref=valid-token");
    expect(servicePageHref("unknown")).toBeUndefined();
  });
  it("escapes script termination while retaining valid JSON", () => {
    const value = { name: "</script><script>alert(1)</script>" };
    const serialized = serializeJsonLd(value);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
