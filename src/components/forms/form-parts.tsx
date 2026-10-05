"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult, FieldErrors } from "@/server/services/result";
import { Check, Lock } from "lucide-react";

/** Hidden anti-bot field. Real users never see or fill it. */
export function Honeypot(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this empty
        <input type="text" tabIndex={-1} autoComplete="off" {...props} />
      </label>
    </div>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex max-w-[40ch] items-start gap-2 text-[13px] leading-snug text-neutral-700">
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SuccessPanel({ title, children, onDone }: { title: string; children: ReactNode; onDone: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex flex-col items-start gap-4 py-2" role="status">
      <span className="grid size-16 place-items-center rounded-full bg-sage-100 text-sage-700">
        <Check aria-hidden className="size-8" strokeWidth={2.75} />
      </span>
      <h3 ref={ref} tabIndex={-1} className="text-2xl outline-none">
        {title}
      </h3>
      <div className="flex flex-col gap-2 text-base leading-relaxed">{children}</div>
      <button type="button" onClick={onDone} className="mt-2 min-h-12 rounded-full bg-accent-600 px-7 font-semibold text-on-accent hover:bg-accent-hover">
        Done
      </button>
    </div>
  );
}

/** Maps a server result onto form errors. Returns a form-level message, or null if handled/ok. */
export function applyServerResult<T extends FieldValues>(
  result: ActionResult<object>,
  setError: UseFormSetError<T>,
  contactEmail: string,
): string | null {
  if (result.ok) return null;
  if (result.code === "VALIDATION") {
    const errors: FieldErrors = result.fieldErrors;
    let first = true;
    for (const [name, msgs] of Object.entries(errors)) {
      if (msgs?.[0]) setError(name as Path<T>, { message: msgs[0] }, { shouldFocus: first });
      first = false;
    }
    return "Please check the highlighted fields.";
  }
  if (result.code === "RATE_LIMITED") return "You've sent several requests recently. Please wait a little while and try again.";
  return `Something went wrong on our side and your submission was not saved. Please try again, or email ${contactEmail}.`;
}
