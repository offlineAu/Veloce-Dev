"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, LoaderCircle, Mail, Send } from "lucide-react";
import { closeInquiry, moveStage, reopenInquiry, saveNote, sendFollowUpAction, type ActionState } from "@/app/admin/clients/actions";
import { STAGE_LABEL } from "@/lib/admin-labels";

const TONE: Record<string, string> = {
  NEW: "border-[var(--dash-hi)]/40 bg-[var(--dash-hi)]/15 text-[var(--dash-accent)]",
  CONVERTED: "border-[#1fa093]/40 bg-[#1fa093]/15 text-sage-700",
  NOT_PROCEEDING: "border-[var(--dash-line)] text-[var(--dash-muted)]",
};
export function StagePill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[status] ?? "border-[var(--dash-mark)]/40 bg-[var(--dash-mark)]/10 text-[var(--dash-ink)]"}`}>{STAGE_LABEL[status] ?? status}</span>;
}

const input = "w-full rounded-2xl border border-[var(--dash-line-strong)] bg-[var(--dash-bg)] px-4 py-3 text-sm text-[var(--dash-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--dash-muted)]/70 focus:border-[var(--dash-hi)] focus:ring-4 focus:ring-[var(--dash-hi)]/15";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--dash-hi)] px-5 text-sm font-semibold text-[var(--dash-on-hi)] transition-colors hover:opacity-90 disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--dash-line-strong)] px-5 text-sm text-[var(--dash-ink)] transition-colors hover:bg-ink/[0.06] disabled:opacity-60";

function Status({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="flex items-start gap-2 text-sm text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{state.error}</p>;
  if (state.ok) return <p role="status" className="flex items-center gap-2 text-sm text-sage-700"><Check className="size-4" aria-hidden />{state.ok}</p>;
  return null;
}
const Spinner = () => <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />;

export function StageForm({ id, status, options }: { id: string; status: string; options: string[] }) {
  const [state, action, pending] = useActionState(moveStage, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    <label htmlFor="stage" className="text-sm text-[var(--dash-ink)]">Move to</label>
    <select id="stage" name="status" defaultValue={status} key={status} className={`${input} mt-1.5 appearance-none`}>
      {options.map(o => <option key={o} value={o}>{STAGE_LABEL[o]}</option>)}
    </select>
    <label htmlFor="stage-note" className="sr-only">Reason (optional)</label>
    <input id="stage-note" name="note" maxLength={1000} placeholder="Reason (optional)" className={input} />
    <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={pending} className={secondary}>{pending ? <Spinner /> : null}Update stage</button><Status state={state} /></div>
  </form>;
}

export function CloseOrReopen({ id, closed, canClose }: { id: string; closed: boolean; canClose: boolean }) {
  const [closeState, close, closing] = useActionState(closeInquiry, {});
  const [reopenState, reopen, reopening] = useActionState(reopenInquiry, {});
  const [confirming, setConfirming] = useState(false);
  if (closed) return <form action={reopen} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    <p className="text-sm text-[var(--dash-muted)]">This inquiry is closed and will be deleted after the retention period. Reopen it to keep working on it.</p>
    <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={reopening} className={secondary}>{reopening ? <Spinner /> : null}Reopen</button><Status state={reopenState} /></div>
  </form>;
  if (!canClose) return <p className="text-sm text-[var(--dash-muted)]">Won clients and inquiries with a booking can&apos;t be closed here.</p>;
  return <form action={close} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    {confirming ? <>
      <label htmlFor="close-note" className="text-sm text-[var(--dash-ink)]">Close as not proceeding?</label>
      <input id="close-note" name="note" maxLength={1000} placeholder="Reason (optional)" className={input} />
      <p className="text-xs text-[var(--dash-muted)]">Closing starts the retention period: the inquiry, its design and its timeline are deleted afterwards unless you reopen it.</p>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={closing} className={secondary}>{closing ? <Spinner /> : null}Close inquiry</button><button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-3 text-sm text-[var(--dash-muted)] hover:text-[var(--dash-ink)]">Cancel</button></div>
    </> : <button type="button" onClick={() => setConfirming(true)} className="min-h-11 text-sm text-[var(--dash-muted)] underline-offset-4 hover:text-[var(--dash-ink)] hover:underline">Close as not proceeding…</button>}
    <Status state={closeState} />
  </form>;
}

export function NoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(saveNote, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return <form ref={form} action={action} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    <label htmlFor="note" className="sr-only">Note</label>
    <textarea id="note" name="note" rows={3} maxLength={4000} placeholder="Add a note: a call, a decision, what you promised…" className={`${input} resize-y`} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-h-11 items-center gap-2.5 text-sm text-[var(--dash-ink)]"><input type="checkbox" name="contacted" className="size-4 accent-[#e8afa1]" />I contacted them (call, chat or my own email)</label>
      <button type="submit" disabled={pending} className={secondary}>{pending ? <Spinner /> : null}Save</button>
    </div>
    <Status state={state} />
  </form>;
}

type Draft = { title: string; subject: string; body: string };
export function FollowUpComposer({ id, to, drafts, suggested, emailReady, open, isNew }: { id: string; to: { name: string; email: string }; drafts: Record<string, Draft>; suggested?: string; emailReady: boolean; open: boolean; isNew: boolean }) {
  const keys = Object.keys(drafts);
  const [key, setKey] = useState(suggested && drafts[suggested] ? suggested : keys[0]!);
  const [subject, setSubject] = useState(drafts[key]!.subject);
  const [body, setBody] = useState(drafts[key]!.body);
  const [confirming, setConfirming] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await sendFollowUpAction(previous, form);
    // One id per message, so a double click or a retried request can't send it twice. A new one after each send.
    if (result.ok) { setRequestId(crypto.randomUUID()); setConfirming(false); }
    return result;
  }, {});
  const pick = (next: string) => { setKey(next); setSubject(drafts[next]!.subject); setBody(drafts[next]!.body); setConfirming(false); };
  const placeholders = /\[[^\]]+\]|^•\s*$/m.test(body);
  if (!open) return <p className="text-sm text-[var(--dash-muted)]">Follow-ups are only sent for open inquiries. Reopen this inquiry to email them about it.</p>;
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="requestId" value={requestId} />
    {!emailReady ? <p className="flex items-start gap-2 rounded-2xl border border-[var(--dash-line-strong)] p-3.5 text-sm text-[var(--dash-muted)]"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />Email isn&apos;t set up on the server, so sending is turned off. You can still draft and copy a message.</p> : null}
    <div role="tablist" aria-label="Templates" className="flex flex-wrap gap-1.5">
      {keys.map(k => <button key={k} type="button" role="tab" aria-selected={k === key} onClick={() => pick(k)} className={`min-h-9 rounded-full border px-3.5 text-xs transition-colors ${k === key ? "border-[var(--dash-hi)] bg-[var(--dash-hi)]/15 text-[var(--dash-ink)]" : "border-[var(--dash-line)] text-[var(--dash-muted)] hover:text-[var(--dash-ink)]"}`}>{drafts[k]!.title}{k === suggested ? " · suggested" : ""}</button>)}
    </div>
    <p className="flex items-center gap-2 text-sm text-[var(--dash-muted)]"><Mail className="size-4" aria-hidden />To <span className="text-[var(--dash-ink)]">{to.name}</span> &lt;{to.email}&gt;</p>
    <div><label htmlFor="fu-subject" className="text-sm text-[var(--dash-ink)]">Subject</label><input id="fu-subject" name="subject" value={subject} onChange={e => { setSubject(e.target.value); setConfirming(false); }} maxLength={150} required className={`${input} mt-1.5`} /></div>
    <div><label htmlFor="fu-body" className="text-sm text-[var(--dash-ink)]">Message</label><textarea id="fu-body" name="body" value={body} onChange={e => { setBody(e.target.value); setConfirming(false); }} rows={11} maxLength={5000} required className={`${input} mt-1.5 resize-y font-[inherit] leading-relaxed`} /></div>
    {placeholders ? <p className="text-xs text-[var(--dash-accent)]">Fill in the bracketed parts and empty bullet points before sending.</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {confirming ? <>
        <button type="submit" disabled={pending || !emailReady} className={primary}>{pending ? <Spinner /> : <Send className="size-4" aria-hidden />}Send to {to.name.split(" ")[0]}</button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-3 text-sm text-[var(--dash-muted)] hover:text-[var(--dash-ink)]">Keep editing</button>
      </> : <button type="button" disabled={!emailReady || placeholders || !subject.trim() || !body.trim()} onClick={() => setConfirming(true)} className={primary}>Review and send</button>}
      <button type="button" onClick={() => navigator.clipboard?.writeText(`${subject}\n\n${body}`)} className="min-h-11 px-3 text-sm text-[var(--dash-muted)] hover:text-[var(--dash-ink)]">Copy text</button>
    </div>
    {confirming ? <p className="text-xs text-[var(--dash-muted)]">This sends one email now. It will be added to the timeline{isNew ? " and the inquiry moves to Contacted" : ""}.</p> : null}
    <Status state={state} />
  </form>;
}
