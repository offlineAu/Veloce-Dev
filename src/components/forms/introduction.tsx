"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, ModalContent, useOpenerFocus } from "@/components/ui/dialog";
import { PixelLogoLoader } from "@/components/brand/pixel-logo-loader";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { submitIntroductionAction } from "@/server/actions/forms";
import { PROJECT_INTERESTS, introductionClientSchema, type IntroductionFormValues } from "@/schemas/introduction";
import { Honeypot, PrivacyNote, SuccessPanel, applyServerResult } from "./form-parts";

const IntroCtx = createContext<{ open: () => void } | null>(null);

export interface IntroductionProviderProps {
  children: ReactNode;
  companyName: string;
  contactEmail: string;
  refToken: string;
}

export function IntroductionProvider({ children, ...rest }: IntroductionProviderProps) {
  const [isOpen, setOpen] = useState(false);
  const focus = useOpenerFocus();
  const { remember } = focus;
  const ctx = useMemo(() => ({ open: () => { remember(); setOpen(true); } }), [remember]);
  return (
    <IntroCtx.Provider value={ctx}>
      {children}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <ModalContent
          onCloseAutoFocus={focus.onCloseAutoFocus}
          title="Make an introduction"
          description={`Tell us who might benefit from working with ${rest.companyName}.`}
        >
          <IntroductionForm {...rest} onClose={() => setOpen(false)} />
        </ModalContent>
      </Dialog>
    </IntroCtx.Provider>
  );
}

export function OpenIntroductionButton({ onClick, ...props }: ButtonProps) {
  const ctx = useContext(IntroCtx);
  if (!ctx) throw new Error("OpenIntroductionButton must be used inside IntroductionProvider");
  return (
    <Button
      {...props}
      onClick={(e) => {
        onClick?.(e);
        ctx.open();
      }}
    />
  );
}

const DEFAULTS = {
  referrerName: "", referrerEmail: "", referredName: "", referredEmail: "", referredCompany: "",
  projectInterest: "", message: "", referrerConsent: false, contactFax: "",
};

function IntroductionForm({
  companyName, contactEmail, refToken, onClose,
}: Omit<IntroductionProviderProps, "children"> & { onClose: () => void }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => Date.now());
  const [done, setDone] = useState<{ name: string; emailed: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, setError, formState: { errors } } = useForm<IntroductionFormValues>({
    resolver: zodResolver(introductionClientSchema),
    defaultValues: DEFAULTS as unknown as Partial<IntroductionFormValues>,
    mode: "onTouched",
  });
  const err = (k: keyof IntroductionFormValues) => errors[k]?.message as string | undefined;

  const onSubmit = handleSubmit((data) => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const result = await submitIntroductionAction({ ...data, refToken, idempotencyKey, startedAt }).catch(
        () => ({ ok: false, code: "UNAVAILABLE" }) as const,
      );
      if (result.ok) {
        setDone({ name: data.referredName as string, emailed: result.referrerEmailed });
        toast.success("Introduction received");
      }
      else setFormError(applyServerResult(result, setError, contactEmail));
    });
  });

  if (done) {
    return (
      <SuccessPanel title="Introduction recorded" onDone={onClose}>
        <p>
          Thank you. We&apos;ve recorded your introduction of <strong>{done.name}</strong>, and our team will review it.
        </p>
        {done.emailed ? <p>We&apos;ve also emailed you a confirmation.</p> : null}
      </SuccessPanel>
    );
  }

  return (
    <>
      <span role="status" className="sr-only">{pending ? "Sending…" : ""}</span>
      <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5" aria-busy={pending}>
        <Honeypot {...register("contactFax")} />
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-accent-700">About you</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="in-rname" label="Your name" required error={err("referrerName")}>
              {(a) => <TextInput {...register("referrerName")} id={a.id} autoComplete="name" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
            </Field>
            <Field id="in-remail" label="Your email" required error={err("referrerEmail")}>
              {(a) => <TextInput {...register("referrerEmail")} id={a.id} type="email" autoComplete="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
            </Field>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-accent-700">Who you&apos;re introducing</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="in-name" label="Their name" required error={err("referredName")}>
              {(a) => <TextInput {...register("referredName")} id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
            </Field>
            <Field id="in-email" label="Their email" required error={err("referredEmail")}>
              {(a) => <TextInput {...register("referredEmail")} id={a.id} type="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
            </Field>
            <Field id="in-company" label="Their company" error={err("referredCompany")}>
              {(a) => <TextInput {...register("referredCompany")} id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
            </Field>
            <Field id="in-interest" label="What are they looking for?" required error={err("projectInterest")}>
              {(a) => (
                <SelectInput {...register("projectInterest")} id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy}>
                  <option value="">Choose one</option>
                  {PROJECT_INTERESTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </SelectInput>
              )}
            </Field>
          </div>
        </fieldset>
        <Field id="in-message" label="Message" error={err("message")}>
          {(a) => <TextArea {...register("message")} id={a.id} rows={3} placeholder="Anything that would help us start the conversation" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>

        <div>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" {...register("referrerConsent")} aria-invalid={!!err("referrerConsent")} aria-describedby={err("referrerConsent") ? "in-consent-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-accent-600" />
            <span>
              I have this person&apos;s permission to share their name and email with {companyName}, who may contact them about this introduction.{" "}
              <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-accent-700 underline underline-offset-2">Privacy notice</a>.
            </span>
          </label>
          {err("referrerConsent") ? <p id="in-consent-error" role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{err("referrerConsent")}</p> : null}
        </div>

        {formError ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{formError}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <PrivacyNote>Used only to follow up on this introduction. Nobody is added to a mailing list.</PrivacyNote>
          <Button type="submit" size="lg" disabled={pending}>{pending ? <><PixelLogoLoader variant="compact" /> Sending…</> : "Send introduction"}</Button>
        </div>
      </form>
    </>
  );
}
