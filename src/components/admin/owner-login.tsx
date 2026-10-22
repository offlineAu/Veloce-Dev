"use client";
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, BarChart3, Clock3, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Smartphone, Workflow } from "lucide-react";
import { ownerLogin } from "@/app/admin/analytics/actions";

const field = "flex min-h-13 items-center gap-3 rounded-2xl border border-[var(--dash-line-strong)] bg-[var(--dash-bg)] px-4 transition-[border-color,box-shadow] focus-within:border-[var(--dash-hi)] focus-within:ring-4 focus-within:ring-[var(--dash-hi)]/15";

/** Seconds left in the current 30-second authenticator window, from this device's clock. */
function useCodeWindow() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(30 - Math.floor(Date.now() / 1000) % 30);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

/**
 * One real input (so paste, autofill of one-time codes and the "Authenticator code" label all work natively) drawn as
 * six digit slots underneath it.
 */
function CodeInput() {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const left = useCodeWindow();
  return <div>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor="owner-code" className="text-sm font-medium text-[var(--dash-ink)]">Authenticator code</label>
      {left !== null ? <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--dash-muted)]" aria-hidden>
        <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--dash-line-strong)" strokeWidth="2" /><circle cx="8" cy="8" r="6" fill="none" stroke="var(--dash-hi)" strokeWidth="2" strokeDasharray={`${left / 30 * 37.7} 37.7`} /></svg>
        new code in {left}s
      </span> : null}
    </div>
    <div className="relative mt-2">
      <input
        id="owner-code" name="code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} autoComplete="one-time-code" aria-describedby="owner-code-help"
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => {
          const current = focused && (i === code.length || (i === 5 && code.length === 6));
          return <div key={i} className={`relative grid h-14 place-items-center rounded-[14px] border bg-[var(--dash-bg)] font-heading text-2xl tabular-nums text-[var(--dash-ink)] transition-[border-color,box-shadow] sm:h-16 ${current ? "border-[var(--dash-hi)] ring-4 ring-[var(--dash-hi)]/15" : code[i] ? "border-[var(--dash-line-strong)]" : "border-[var(--dash-line)]"} ${i === 2 ? "mr-1 sm:mr-2" : ""}`}>
            {code[i] ?? (current && code.length < 6 ? <span className="h-7 w-0.5 rounded-full bg-[var(--dash-hi)] motion-safe:animate-pulse" /> : <span className="size-1.5 rounded-full bg-[var(--dash-line-strong)]" />)}
          </div>;
        })}
      </div>
    </div>
    <p id="owner-code-help" className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-[var(--dash-muted)]"><Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />Open your authenticator app and enter the 6-digit code for Veloce (owner). You can paste it too.</p>
  </div>;
}

function PasswordInput() {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const capsCheck = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  return <div>
    <label htmlFor="owner-password" className="text-sm font-medium text-[var(--dash-ink)]">Owner password</label>
    <div className={`${field} mt-2`}>
      <KeyRound className="size-4 shrink-0 text-[var(--dash-muted)]" aria-hidden />
      <input id="owner-password" name="password" type={visible ? "text" : "password"} required maxLength={200} autoComplete="current-password" autoFocus onKeyDown={capsCheck} onKeyUp={capsCheck}
        className="h-13 min-w-0 flex-1 bg-transparent text-base text-[var(--dash-ink)] outline-none placeholder:text-[var(--dash-muted)]/60" placeholder="Enter your password" />
      <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="-mr-2 grid size-10 place-items-center rounded-xl text-[var(--dash-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--dash-ink)]">
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
    {caps ? <p className="mt-2 text-xs text-[var(--dash-accent)]" role="status">Caps Lock is on.</p> : null}
  </div>;
}

const INSIDE = [
  [BarChart3, "Traffic and conversions", "Visitors, pages and the path from first visit to inquiry."],
  [Workflow, "Inquiry pipeline", "Who is waiting for a reply, and where every conversation stands."],
  [Clock3, "When people visit", "The hours and channels that bring people to your site."],
] as const;

export function OwnerLogin({ mfa = false }: { mfa?: boolean }) {
  const [state, action, pending] = useActionState(ownerLogin, { error: "" });
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error) error.current?.focus(); }, [state]);
  return <div className="mx-auto mt-8 grid max-w-5xl overflow-hidden rounded-[32px] border border-[var(--dash-line)] bg-[var(--dash-surface)] shadow-2xl shadow-black/40 sm:mt-14 lg:grid-cols-[1.05fr_1fr]">
    <div className="relative hidden overflow-hidden border-r border-[var(--dash-line)] bg-[var(--dash-raised)] p-10 lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-x-10 bottom-0 flex h-40 items-end gap-1.5 opacity-50" aria-hidden>
        {[34, 52, 41, 63, 48, 72, 58, 86, 64, 78, 95, 70, 88, 100].map((h, i) => <span key={i} className="flex-1 rounded-t-[4px] bg-gradient-to-t from-transparent to-[var(--dash-mark)]" style={{ height: `${h}%`, opacity: 0.35 + i / 28 }} />)}
      </div>
      <p className="relative flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--dash-accent)]"><span className="size-1.5 rounded-full bg-[var(--dash-hi)]" aria-hidden />Veloce · Owner</p>
      <p className="relative mt-8 font-heading text-4xl font-medium leading-[1.05] tracking-tight text-[var(--dash-ink)]">Everything your site is telling you, in one place.</p>
      <ul className="relative mt-10 space-y-5">
        {INSIDE.map(([Icon, title, text]) => <li key={title} className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--dash-line-strong)] bg-[var(--dash-surface)]"><Icon className="size-4 text-[var(--dash-accent)]" aria-hidden /></span>
          <span><span className="block text-sm font-medium text-[var(--dash-ink)]">{title}</span><span className="mt-0.5 block text-sm text-[var(--dash-muted)]">{text}</span></span>
        </li>)}
      </ul>
    </div>
    <div className="p-6 sm:p-10">
      <span className="grid size-12 place-items-center rounded-2xl border border-[var(--dash-line-strong)] bg-[var(--dash-raised)]"><LockKeyhole className="size-5 text-[var(--dash-accent)]" aria-hidden /></span>
      <h1 className="mt-6 font-heading text-3xl font-medium tracking-tight text-[var(--dash-ink)] sm:text-4xl">Your site, in numbers.</h1>
      <p className="mt-2 text-sm text-[var(--dash-muted)]">{mfa ? "Sign in with your owner password and authenticator code." : "Sign in with your owner password to view private analytics."}</p>
      <form action={action} className="mt-8 space-y-6" aria-busy={pending}>
        <PasswordInput />
        {mfa ? <CodeInput /> : null}
        {state.error ? <p ref={error} tabIndex={-1} role="alert" className="flex items-start gap-2.5 rounded-2xl border border-[#ff9f90]/30 bg-[#ff9f90]/10 p-3.5 text-sm text-[#ffc7be] outline-none"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{state.error}</p> : null}
        <button type="submit" disabled={pending} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--dash-hi)] px-6 text-sm font-semibold text-[var(--dash-on-hi)] transition-[background-color,transform] hover:bg-[#f0c3b7] active:scale-[0.99] disabled:opacity-70">
          {pending ? <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />Signing in…</> : "View analytics"}
        </button>
      </form>
      <ul className="mt-8 grid gap-2 border-t border-[var(--dash-line)] pt-6 text-xs text-[var(--dash-muted)] sm:grid-cols-2">
        <li className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-[var(--dash-accent)]" aria-hidden />{mfa ? "Two-step sign-in" : "Private owner access"}</li>
        <li className="flex items-center gap-2"><Clock3 className="size-3.5 text-[var(--dash-accent)]" aria-hidden />Signed out after 8 hours</li>
      </ul>
    </div>
  </div>;
}
