"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/server/security/password";
import { clientKey } from "@/server/security/request";
import { allow } from "@/server/security/rate-limit";
import { verifyTotp } from "@/server/security/totp";
import { securityEvent } from "@/server/security/events";
import { db } from "@/server/db";
import { createHash } from "node:crypto";
import { newOwnerSession, endOwnerSession, requireOwner, OWNER_COOKIE, OWNER_SESSION_SECONDS, ownerConfigured, ownerReturnPath } from "@/server/admin/session";

export async function ownerLogin(_previous: { error: string }, form: FormData) {
  const password = form.get("password");
  if (!ownerConfigured() || typeof password !== "string" || !password || password.length > 200) return { error: "Unable to sign in. Check your password or contact the site owner." };
  try {
    if (!await allow(`analytics-owner:${await clientKey()}`, 5, 15 * 60_000) || !await allow("analytics-owner:global", 100, 15 * 60_000)) { securityEvent("login_limited"); return { error: "Too many sign-in attempts. Try again in 15 minutes." }; }
    if (!verifyPassword(password, process.env.ANALYTICS_OWNER_PASSWORD_HASH!)) { securityEvent("login_failed"); return { error: "Unable to sign in. Check your credentials or contact the site owner." }; }
    const mfaSecret = process.env.ANALYTICS_OWNER_TOTP_SECRET;
    if (mfaSecret) {
      const step = verifyTotp(mfaSecret, form.get("code"));
      if (step === null) { securityEvent("login_failed"); return { error: "Unable to sign in. Check your credentials or contact the site owner." }; }
      // Unique insertion prevents reuse even across instances and rate-limit windows.
      const key = `owner-totp:${createHash("sha256").update(mfaSecret).digest("hex").slice(0, 24)}:${step}`;
      try { await db.rateLimit.create({ data: { key, windowStart: new Date(step * 30_000), count: 1 } }); }
      catch { return { error: "Use the next authenticator code and try again." }; }
    }
    (await cookies()).set(OWNER_COOKIE, await newOwnerSession(), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: OWNER_SESSION_SECONDS,
    });
  } catch { return { error: "Sign-in is temporarily unavailable. Please try again." }; }
  redirect(ownerReturnPath(form.get("next")) ?? "/admin/analytics");
}
export async function ownerLogout() {
  await endOwnerSession();
  redirect("/admin/analytics");
}

export async function ownerLogoutAll() {
  await requireOwner();
  const { revokeAllSessions } = await import("@/server/security/sessions");
  await revokeAllSessions("owner");
  (await cookies()).delete(OWNER_COOKIE);
  redirect("/admin/analytics");
}
