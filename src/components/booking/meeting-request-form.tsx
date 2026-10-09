'use client';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { meetingRequestClientSchema } from '@/schemas/meeting';
import { requestMeetingAction } from '@/server/actions/meetings';
import { Field, TextInput, TextArea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { PixelLogoLoader } from '@/components/brand/pixel-logo-loader';
import { Honeypot } from '@/components/forms/form-parts';

type Values = z.input<typeof meetingRequestClientSchema>;
export function MeetingRequestForm({ context, refToken, contactEmail }: { context: string; refToken?: string; contactEmail: string }) {
  const [key] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => Date.now());
  const [received, setReceived] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError: fieldError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(meetingRequestClientSchema), defaultValues: { name: '', email: '', context, privacyConsent: false as unknown as true, contactFax: '' } });
  const submit = handleSubmit(data => {
    if (pending) return;
    setError('');
    startTransition(async () => {
      const params = new URLSearchParams(location.search);
      const result = await requestMeetingAction({ ...data, refToken, idempotencyKey: key, startedAt, utmSource: params.get('utm_source') ?? undefined, utmMedium: params.get('utm_medium') ?? undefined, utmCampaign: params.get('utm_campaign') ?? undefined }).catch(() => ({ ok: false, code: 'UNAVAILABLE' }) as const);
      if (result.ok) setReceived(true);
      else if (result.code === 'VALIDATION') for (const [k, messages] of Object.entries(result.fieldErrors)) fieldError(k as keyof Values, { message: messages?.[0] });
      else setError(result.code === 'RATE_LIMITED' ? 'Too many requests. Please try again later.' : 'Your request could not be saved. Please try again or email us directly.');
    });
  });
  if (received) return <div role="status" className="rounded-xl bg-surface p-5"><h4 className="text-xl">Meeting request received</h4><p className="mt-3 text-sm">No appointment time has been reserved. Our team will reply to arrange a time and confirm the meeting details.</p></div>;
  return <>
    <p className="text-sm text-muted">Send a request and we’ll arrange a meeting by email. No time is reserved by this form.</p>
    <span role="status" className="sr-only">{pending ? 'Sending meeting request…' : ''}</span>
    <form onSubmit={submit} noValidate aria-busy={pending} className="mt-5 flex flex-col gap-4">
      <Honeypot {...register('contactFax')} />
      <Field id="meeting-name" label="Name" required error={errors.name?.message as string | undefined}>{a => <TextInput {...register('name')} id={a.id} autoComplete="name" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}</Field>
      <Field id="meeting-email" label="Email" required error={errors.email?.message as string | undefined}>{a => <TextInput {...register('email')} id={a.id} type="email" autoComplete="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} />}</Field>
      <Field id="meeting-context" label="What would you like to discuss?" error={errors.context?.message as string | undefined}>{a => <TextArea {...register('context')} id={a.id} rows={3} aria-invalid={a.invalid} aria-describedby={a.describedBy} />}</Field>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" {...register('privacyConsent')} className="mt-1 size-5 shrink-0 accent-accent-600" aria-invalid={!!errors.privacyConsent} aria-describedby={errors.privacyConsent ? 'meeting-consent-error' : undefined} /><span>I agree that Veloce may use these details to arrange a meeting, as described in the <a href="/privacy" target="_blank" rel="noopener" className="underline">privacy notice</a>.</span></label>
      {errors.privacyConsent ? <p id="meeting-consent-error" role="alert" className="text-sm text-danger">{errors.privacyConsent.message}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? <><PixelLogoLoader variant="compact" />Sending…</> : 'Send meeting request'}</Button>
      <a href={`mailto:${contactEmail}`} className="text-center text-sm underline">Or email us directly</a>
    </form>
  </>;
}
