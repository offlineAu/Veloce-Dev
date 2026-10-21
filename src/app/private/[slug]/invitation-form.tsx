"use client";
import { useActionState } from "react";
import { unlockCase } from "./actions";
export function InvitationForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(unlockCase.bind(null, slug), { error: "" });
  return <form action={action} className="mt-8 space-y-4">
    <label className="flex flex-col gap-2">Invitation code<input name="invitation" type="password" autoComplete="off" required maxLength={100} className="rounded-xl border border-line bg-background p-3" /></label>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button disabled={pending} className="rounded-xl bg-ink px-5 py-3 text-bg">{pending ? "Checking…" : "View case study"}</button>
  </form>;
}
