import { describe, expect, it } from "vitest";
import { offerState } from "@/lib/offer";

const now = new Date("2026-06-15T12:00:00Z");
const day = 24 * 3600_000;

describe("offerState", () => {
  it("is none when no offer text is configured (never invents an offer)", () => {
    expect(offerState({}, now)).toBe("none");
    expect(offerState({ offerTitle: "  ", offerDescription: null }, now)).toBe("none");
    expect(offerState({ offerExpiresAt: new Date(now.getTime() + day) }, now)).toBe("none");
  });
  it("is active with an offer and no window", () => {
    expect(offerState({ offerTitle: "x" }, now)).toBe("active");
    expect(offerState({ offerDescription: "x" }, now)).toBe("active");
  });
  it("respects start and expiry boundaries", () => {
    const base = { offerTitle: "x" };
    expect(offerState({ ...base, offerStartsAt: new Date(now.getTime() + day) }, now)).toBe("upcoming");
    expect(offerState({ ...base, offerExpiresAt: new Date(now.getTime() + day) }, now)).toBe("active");
    expect(offerState({ ...base, offerExpiresAt: new Date(now.getTime() - 1) }, now)).toBe("expired");
    expect(offerState({ ...base, offerExpiresAt: now }, now)).toBe("expired"); // expiry instant is exclusive
    expect(offerState({ ...base, offerStartsAt: now }, now)).toBe("active");
  });
});
