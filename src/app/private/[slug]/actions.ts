"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CASE_COOKIE, caseGrant } from "@/server/portfolio/access";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";
import { securityEvent } from "@/server/security/events";

export async function unlockCase(slug: string, _state: { error: string }, form: FormData) {
  const token = form.get("invitation");
  if (typeof token !== "string" || token.length > 100) return { error: "Invitation unavailable or expired." };
  try {
    if (!await allow(`case-login:${await clientKey()}`, 10, 15 * 60_000) || !await allow("case-login:global", 300, 15 * 60_000)) return { error: "Too many attempts. Try again later." };
    const grant = await caseGrant(slug, token.trim());
    if (!grant) { securityEvent("access_denied"); return { error: "Invitation unavailable or expired." }; }
    (await cookies()).set(CASE_COOKIE, token.trim(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: Math.min(8 * 3600, Math.floor((grant.expiresAt.getTime() - Date.now()) / 1000)) });
  } catch { return { error: "Private access is temporarily unavailable." }; }
  redirect(`/private/${slug}`);
}
export async function leaveCase() {
  (await cookies()).delete(CASE_COOKIE);
  redirect("/");
}
