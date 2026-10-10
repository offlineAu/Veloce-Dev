import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { decodeSession, encodeSession } from "@/server/security/dev-session";
import { assertPublicUrl, isPrivateAddress } from "@/server/builder/safe-fetch";
import { tidyComment } from "@/lib/builder/import/sections";
import { builderTheme, tokensFromConfig, readTailwindConfig } from "@/lib/builder/import/theme";
import { Report } from "@/lib/builder/import/report";

describe("developer password", () => {
  it("verifies the right password only, and never accepts a malformed hash", () => {
    const stored = hashPassword("correct horse battery");
    expect(stored).toMatch(/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/);
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("correct horse batterY", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
    expect(verifyPassword("x", "plain-text-password")).toBe(false);
    expect(hashPassword("same")).not.toBe(hashPassword("same")); // salted
  });
});

describe("developer session cookie", () => {
  const secret = "s".repeat(40);
  it("round-trips, and rejects tampering, a different secret and expiry", () => {
    const token = encodeSession({ name: "Au", exp: Date.now() + 60_000 }, secret);
    expect(decodeSession(token, secret)?.name).toBe("Au");
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "Au", exp: Date.now() + 9e12 })).toString("base64url");
    expect(decodeSession(`${forged}.${mac}`, secret)).toBeNull();
    expect(decodeSession(`${body}.${mac}x`, secret)).toBeNull();
    expect(decodeSession(token, "t".repeat(40))).toBeNull();
    expect(decodeSession(token, secret, Date.now() + 120_000)).toBeNull();
    expect(decodeSession(undefined, secret)).toBeNull();
    expect(decodeSession("garbage", secret)).toBeNull();
  });
});

describe("downloads from uploaded HTML (SSRF guard)", () => {
  it("knows private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "142.250.72.14", "2607:f8b0:4005:80a::200e"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses plain http, credentials, odd ports and internal hosts", async () => {
    await expect(assertPublicUrl("http://example.com/a.png")).rejects.toThrow(/https/);
    await expect(assertPublicUrl("https://user:pw@example.com/a.png")).rejects.toThrow(/credentials/);
    await expect(assertPublicUrl("https://example.com:8443/a.png")).rejects.toThrow(/port/);
    await expect(assertPublicUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(/not public/);
    await expect(assertPublicUrl("https://[::1]/x")).rejects.toThrow(/not public/);
    await expect(assertPublicUrl("https://localhost/x")).rejects.toThrow(/not public/);
  });
});

describe("importing single HTML pages", () => {
  it("turns section marker comments into readable labels", () => {
    expect(tidyComment("BEGIN: MainHeader")).toBe("Main header");
    expect(tidyComment("BEGIN: CTAContactSection")).toBe("CTA contact section");
    expect(tidyComment(" Immersive Editorial Hero ")).toBe("Immersive Editorial Hero");
  });

  it("maps a palette without Material names from how the page uses it, and honours the developer's choice", () => {
    const report = new Report();
    const tokens = tokensFromConfig(
      readTailwindConfig(`tailwind.config = { theme: { extend: { colors: { brand: { ivory: '#f6f4ee', /* canvas */ dark: '#111612', slateText: '#59615a', lime: '#d9f5ab', borderSoft: '#e5e2d6' } } } } }`, report),
      report,
    );
    const hints = { bodyBg: "brand-ivory", bodyText: "brand-dark", buttonBgs: new Map([["brand-dark", 5], ["brand-lime", 2]]) };
    const t = builderTheme(tokens, false, report, hints);
    expect(t).toMatchObject({ bg: "#f6f4ee", fg: "#111612", muted: "#59615a", accent: "#111612" });
    expect(report.toMarkdown("x")).toMatch(/accent ← brand-dark/);
    const chosen = builderTheme(tokens, false, new Report(), hints, { accent: "brand-lime" });
    expect(chosen.accent).toBe("#d9f5ab");
    expect(chosen.onAccent).toBe("#141312"); // dark text reads on lime
  });
});

describe("bundle isolation", () => {
  it("only the upload route (through its service) loads the importer, and nothing else on the site", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk("src");
    const importers = files.filter((f) => !f.startsWith(path.join("src", "lib", "builder", "import")) && /["']@\/lib\/builder\/import["']/.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([path.join("src", "server", "builder", "upload-service.ts")]);
    const services = files.filter((f) => /["']@\/server\/builder\/upload-service["']/.test(readFileSync(f, "utf8")));
    expect(services).toEqual([path.join("src", "app", "api", "dev", "templates", "route.ts")]);
  });
});
