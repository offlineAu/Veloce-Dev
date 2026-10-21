"use client";
import { useActionState } from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";
import { ownerLogin } from "@/app/admin/analytics/actions";
import { Button } from "@/components/ui/button";

export function OwnerLogin({ mfa = false }: { mfa?: boolean }) {
  const [state, action, pending] = useActionState(ownerLogin, { error: "" });
  return <div className="mx-auto mt-16 max-w-md rounded-3xl border border-line bg-surface p-7 shadow-sm sm:p-10">
    <LockKeyhole className="mb-5 size-7 text-accent-700" aria-hidden />
    <h1 className="font-heading text-3xl font-semibold">Your site, in numbers.</h1>
    <p className="mt-3 text-sm text-muted">Sign in with your owner password to view private analytics.</p>
    <form action={action} className="mt-7 space-y-5" aria-busy={pending}>
      <label className="flex flex-col gap-2 text-sm font-semibold">Owner password
        <input name="password" type="password" required maxLength={200} autoComplete="current-password" className="min-h-12 rounded-xl border border-line bg-background px-4" />
      </label>
      {mfa ? <label className="flex flex-col gap-2 text-sm font-semibold">Authenticator code
        <input name="code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} autoComplete="one-time-code" className="min-h-12 rounded-xl border border-line bg-background px-4" />
      </label> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />Signing in…</> : "View analytics"}</Button>
    </form>
  </div>;
}
