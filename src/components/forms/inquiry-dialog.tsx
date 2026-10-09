"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ModalContent } from "@/components/ui/dialog";
import { PixelLogoLoader } from "@/components/brand/pixel-logo-loader";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { submitInquiryAction } from "@/server/actions/forms";
import { serviceInquiries } from "@/content/site";
import { CONSULTATION_TOPICS, PROJECT_TYPES, WEBSITE_TYPES, WEBSITE_TYPE_PROJECTS, inquiryClientSchema, type InquiryFormValues } from "@/schemas/inquiry";
import { Honeypot, PrivacyNote, SuccessPanel, applyServerResult } from "./form-parts";
import type { InquiryProviderProps, InquiryService, Intent } from "./inquiry";

/* The dialog and its form. Loaded on demand (see inquiry.tsx) so react-hook-form and zod are not in the first-load bundle. */

export default function InquiryDialog({ onCloseAutoFocus, ...props }: Omit<InquiryProviderProps, "children"> & { intent: Intent; service?: InquiryService; onClose: () => void; onCloseAutoFocus: (e: Event) => void }) {
  const { service } = props;
  if (props.intent === "CONSULTATION") {
    return (
      <ModalContent
        onCloseAutoFocus={onCloseAutoFocus}
        title="Request a consultation"
        description="Get advice before deciding what to build or change. Tell us where you need clarity, and we'll reply by email to arrange a discussion."
      >
        <InquiryForm key="consultation" {...props} service={undefined} />
      </ModalContent>
    );
  }
  if (props.getSiteDraft) {
    return (
      <ModalContent
        onCloseAutoFocus={onCloseAutoFocus}
        title="Send us your design"
        description={`${props.companyName} will review your page and reply with questions, a proposed scope and an honest estimate. Nothing goes live until you agree.`}
      >
        <InquiryForm key="draft" {...props} service={undefined} />
      </ModalContent>
    );
  }
  return (
    <ModalContent
      onCloseAutoFocus={onCloseAutoFocus}
      title={service ? `Ask about ${service.title}` : "Tell us about your project"}
      description={service ? `Tell ${props.companyName} what you have in mind and we will arrange a useful first conversation.` : `A few details help ${props.companyName} prepare for a useful first conversation.`}
    >
      <InquiryForm key="conversation" {...props} />
    </ModalContent>
  );
}

const DEFAULTS = {
  name: "", email: "", companyName: "", currentWebsite: "", projectType: "", websiteType: "",
  projectGoals: "", additionalDetails: "", referralClaimed: false, privacyConsent: false, contactFax: "",
};

export function InquiryForm({
  companyName, contactEmail, refToken, introducedBy, intent, service, getSiteDraft, onClose,
}: Omit<InquiryProviderProps, "children"> & { intent: Intent; service?: InquiryService; onClose: () => void }) {
  const consultation = intent === "CONSULTATION";
  const receivedTitle = consultation ? "Consultation request received" : "Inquiry received";
  const preset = service ? serviceInquiries[service.slug] : undefined;
  // Read once when the form opens, to label the inquiry; the design itself is read again at submit time.
  const [draftAtOpen] = useState(() => getSiteDraft?.());
  const draftPages = draftAtOpen?.data.pages.length ?? 0;
  const draftBlocks = draftAtOpen?.data.pages.reduce((n, p) => n + p.data.content.length, 0) ?? 0;
  const [editTopic, setEditTopic] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => Date.now());
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, setError, setValue, control, formState: { errors } } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryClientSchema),
    defaultValues: {
      ...DEFAULTS,
      ...(preset ? { projectType: preset.projectType, websiteType: preset.websiteType ?? "" } : {}),
      ...(draftAtOpen ? { projectType: "NEW_PROJECT", websiteType: draftAtOpen.websiteType ?? "" } : {}),
    } as unknown as Partial<InquiryFormValues>,
    mode: "onTouched",
  });

  const projectType = useWatch({ control, name: "projectType" }) as string;
  const showWebsiteType = !consultation && WEBSITE_TYPE_PROJECTS.includes(projectType);
  useEffect(() => {
    if (!showWebsiteType && !(preset?.websiteType && projectType === preset.projectType)) setValue("websiteType", "");
  }, [showWebsiteType, preset, projectType, setValue]);
  const topicLocked = !!preset && !editTopic;

  const err = (k: keyof InquiryFormValues) => errors[k]?.message as string | undefined;
  const companyFields = (
    <>
      <Field id="iq-company" label="Company" error={err("companyName")}>
        {(a) => <TextInput {...register("companyName")} id={a.id} autoComplete="organization" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
      </Field>
      <Field id="iq-site" label="Current website" error={err("currentWebsite")}>
        {(a) => <TextInput {...register("currentWebsite")} id={a.id} type="text" inputMode="url" placeholder="example.com" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
      </Field>
    </>
  );
  const detailsField = (
    <Field id="iq-details" label={consultation ? "Context for the discussion" : "Additional details"} error={err("additionalDetails")}>
      {(a) => <TextArea {...register("additionalDetails")} id={a.id} rows={3} placeholder={consultation ? "What you've tried, tools you use, or constraints we should know about" : "Timeline, must-have features, tools you already use…"} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
    </Field>
  );

  const onSubmit = handleSubmit((data) => {
    if (pending) return; // duplicate-submit guard
    setFormError(null);
    startTransition(async () => {
      const params = new URLSearchParams(window.location.search);
      const draft = getSiteDraft?.();
      const result = await submitInquiryAction({
        ...data,
        intent,
        serviceSlug: service?.slug,
        refToken,
        idempotencyKey,
        startedAt,
        landingPath: window.location.pathname,
        utmSource: params.get("utm_source") ?? undefined,
        utmMedium: params.get("utm_medium") ?? undefined,
        utmCampaign: params.get("utm_campaign") ?? undefined,
        siteDraft: draft ? { templateId: draft.templateId, data: draft.data } : undefined,
      }).catch(() => ({ ok: false, code: "UNAVAILABLE" }) as const);
      if (result.ok) {
        setSentTo(data.email as string);
        toast.success(receivedTitle);
      } else if (result.code === "VALIDATION" && result.fieldErrors.siteDraft?.[0]) {
        setFormError(result.fieldErrors.siteDraft[0]); // a problem with the design, not a form field
      } else {
        setFormError(applyServerResult(result, setError, contactEmail));
      }
    });
  });

  if (sentTo) {
    return (
      <SuccessPanel title={receivedTitle} onDone={onClose}>
        <p>
          {consultation ? "Thanks. We'll reply to " : "Thanks. We've received your inquiry and will reply to "}<strong>{sentTo}</strong>{consultation ? " to clarify your question and arrange a consultation. We'll confirm the scope and any cost before you commit." : " to arrange a first conversation."}
        </p>
      </SuccessPanel>
    );
  }

  return (
    <>
      <span role="status" className="sr-only">{pending ? "Sending…" : ""}</span>
      <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5" aria-busy={pending}>
        {consultation ? (
          <div className="rounded-xl bg-sage-100 p-4 text-sm text-sage-800">
            <p className="font-semibold">A clearer next step</p>
            <p className="mt-1">Use this discussion to review an issue, compare options, or work out priorities. We&apos;ll confirm the scope and any cost by email before you commit.</p>
          </div>
        ) : null}
        {draftAtOpen ? (
          <p className="rounded-md bg-accent-100 px-4 py-3 text-sm text-ink">
            Your design ({draftPages} {draftPages === 1 ? "page" : "pages"}, {draftBlocks} {draftBlocks === 1 ? "section" : "sections"}) will be attached. You can keep editing it afterwards.
          </p>
        ) : null}
        {introducedBy ? (
          <p className="rounded-md bg-sage-100 px-4 py-3 text-sm text-sage-800">
            Introduced by <strong>{introducedBy}</strong>. Your inquiry will be linked to that introduction.
          </p>
        ) : null}
        <Honeypot {...register("contactFax")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="iq-name" label="Name" required error={err("name")}>
            {(a) => <TextInput {...register("name")} id={a.id} autoComplete="name" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
          </Field>
          <Field id="iq-email" label="Email" required error={err("email")}>
            {(a) => <TextInput {...register("email")} id={a.id} type="email" autoComplete="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
          </Field>
          {preset || consultation ? null : companyFields}
        </div>

        {topicLocked ? (
          <p className="flex flex-wrap items-center gap-x-2 text-[15px]">
            <span className="font-semibold">Topic:</span> {service?.title}
            <button type="button" onClick={() => setEditTopic(true)} className="font-semibold text-accent-700 underline underline-offset-2">Change</button>
            <input type="hidden" {...register("projectType")} />
          </p>
        ) : (
        <fieldset className="flex flex-col gap-2.5" aria-describedby={err("projectType") ? "iq-ptype-error" : undefined}>
          <legend className="mb-2.5 text-sm font-semibold">
            {consultation ? "What would you like advice on?" : "Project type"}<span aria-hidden className="text-accent-700"> *</span>
            <span className="sr-only"> (required)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {(consultation ? CONSULTATION_TOPICS : PROJECT_TYPES).map(([value, text]) => (
              <label key={value} className="relative cursor-pointer">
                <input type="radio" value={value} {...register("projectType")} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center rounded-full bg-neutral-100 px-4 text-[15px] ring-2 ring-transparent peer-checked:bg-accent-100 peer-checked:ring-accent-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-700">
                  {text}
                </span>
              </label>
            ))}
          </div>
          {err("projectType") ? <p id="iq-ptype-error" role="alert" className="text-[13px] font-medium text-danger">{consultation ? "Choose a topic for your consultation." : err("projectType")}</p> : null}
        </fieldset>
        )}

        {showWebsiteType && !topicLocked ? (
          <Field id="iq-wtype" label="What type of website do you need?" error={err("websiteType")}>
            {(a) => (
              <SelectInput {...register("websiteType")} id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy}>
                <option value="">Not sure yet</option>
                {WEBSITE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </SelectInput>
            )}
          </Field>
        ) : null}

        <Field id="iq-goals" label={consultation ? "What question or decision would you like help with?" : "What are you looking to build or solve?"} required error={err("projectGoals")}>
          {(a) => <TextArea {...register("projectGoals")} id={a.id} rows={3} placeholder={consultation ? "e.g. Should we improve our current booking tool or build something custom?" : preset?.goalsPlaceholder ?? "e.g. Online booking for our clinic"} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}
        </Field>
        {preset || consultation ? (
          <details className="rounded-xl border-2 border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{consultation ? "Add background for the consultation" : "Add company, website or more details"} <span className="font-normal text-neutral-700">(optional)</span></summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {companyFields}
              <div className="sm:col-span-2">{detailsField}</div>
            </div>
          </details>
        ) : detailsField}

        {!refToken ? (
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" {...register("referralClaimed")} className="size-5 accent-accent-600" />
            Someone referred me to {companyName}
          </label>
        ) : null}

        <div>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" {...register("privacyConsent")} aria-invalid={!!err("privacyConsent")} aria-describedby={err("privacyConsent") ? "iq-consent-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-accent-600" />
            <span>
              I agree that {companyName} may use these details to respond to my inquiry, as described in the{" "}
              <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-accent-700 underline underline-offset-2">privacy notice</a>.
            </span>
          </label>
          {err("privacyConsent") ? <p id="iq-consent-error" role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{err("privacyConsent")}</p> : null}
        </div>

        {formError ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{formError}</p> : null}

        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-background px-6 pb-6 pt-4 sm:-bottom-10 sm:-mx-10 sm:-mb-10 sm:px-10 sm:pb-10">
          <PrivacyNote>We only use these details to respond to your inquiry.</PrivacyNote>
          <Button type="submit" size="lg" disabled={pending}>{pending ? <><PixelLogoLoader variant="compact" /> Sending…</> : consultation ? "Send consultation request" : "Send project inquiry"}</Button>
        </div>
      </form>
    </>
  );
}
