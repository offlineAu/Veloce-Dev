'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PixelLogoLoader } from '@/components/brand/pixel-logo-loader';
import { startMeetingAction, verifyMeetingAction } from '@/server/actions/meetings';
import { suggestedDiscussion, type MeetingResult as Result, type MeetingSession } from '@/lib/meeting';
import { prefersReducedMotion } from '@/lib/use-reduced-motion';
import { useMeeting } from './meeting-provider';
import { MeetingRequestForm } from './meeting-request-form';
import { MeetingResult } from './meeting-result';
const SchedulerEmbed = dynamic(() => import('./scheduler-embed'), { ssr: false, loading: () => <p role="status" className="mt-4">Loading calendar…</p> });
export function MeetingPanel() {
  const meeting = useMeeting();
  const [context, setContext] = useState(() => suggestedDiscussion(meeting.context));
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState<MeetingSession>();
  const [result, setResult] = useState<Result>();
  const [uid, setUid] = useState<string>();
  const [fallback, setFallback] = useState(!meeting.config.enabled);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  // This panel loads on demand, so the provider's scroll/focus may run before it exists: do it once on first mount too.
  useEffect(() => {
    if (!meeting.open) return;
    const panel = document.getElementById('veloce-meeting-panel');
    panel?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
    document.getElementById('veloce-meeting-title')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const complete = useCallback((bookingUid: string) => {
    if (!session) return;
    setUid(bookingUid);
    setError('');
    startTransition(async () => {
      const checked = await verifyMeetingAction({ reference: session.reference, accessToken: session.accessToken, uid: bookingUid }).catch(() => null);
      if (checked?.ok && checked.meeting) setResult(checked.meeting);
      else setError('The scheduler received your booking. We could not verify its latest details here yet. Check the provider confirmation before booking again.');
    });
  }, [session]);
  function start() {
    if (!consent || pending) return;
    setError('');
    startTransition(async () => {
      const p = new URLSearchParams(location.search);
      const response = await startMeetingAction({ privacyConsent: true, context, entryPoint: meeting.entryPoint, refToken: meeting.refToken, utmSource: p.get('utm_source') ?? undefined, utmMedium: p.get('utm_medium') ?? undefined, utmCampaign: p.get('utm_campaign') ?? undefined }).catch(() => null);
      if (response?.ok) setSession(response.session);
      else setError('Scheduling is unavailable right now. Please retry or request a meeting by email.');
    });
  }
  return <div id="veloce-meeting-panel" hidden={!meeting.open} inert={!meeting.open} data-meeting-panel className="min-w-0">
    <div className="mb-5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-sage-800"><CalendarDays aria-hidden className="size-4" />Meeting with Veloce</span><button type="button" onClick={meeting.back} className="inline-flex min-h-11 items-center gap-2 text-sm underline"><ArrowLeft aria-hidden className="size-4" />Back to example</button></div>
    <h3 id="veloce-meeting-title" tabIndex={-1} className="text-[clamp(24px,2.6vw,32px)] outline-none">{meeting.config.enabled ? 'Book a meeting with Veloce' : 'Request a meeting with Veloce'}</h3>
    <p className="mt-3 text-sm text-muted">Talk through your idea, current workflow, or an existing system with our team.</p>
    {meeting.config.enabled ? <p className="mt-3 text-sm font-semibold">{meeting.config.duration} minutes · {meeting.config.format}<br />{meeting.config.costLabel}</p> : null}
    {result ? <><MeetingResult meeting={result} />{uid ? <Button variant="outline" className="mt-4" disabled={pending} onClick={() => complete(uid)}>Check latest meeting details</Button> : null}</> : <>
      {fallback ? <div className="mt-5"><MeetingRequestForm context={context} refToken={meeting.refToken} contactEmail={meeting.contactEmail} /></div> : <>
        {!session ? <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold">What would you like to discuss? <span className="font-normal text-muted">Optional. Suggested from your example choices; edit or remove it.</span><textarea value={context} onChange={e => setContext(e.target.value)} maxLength={1000} rows={3} className="rounded-xl border border-line bg-surface p-3 font-normal" /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-accent-600" /><span>I agree that Veloce and its scheduling provider may use my details to arrange this meeting, as described in the <a href="/privacy" target="_blank" rel="noopener" className="underline">privacy notice</a>.</span></label>
          <Button onClick={start} disabled={!consent || pending}>Choose a real meeting time</Button>
        </div> : <div hidden={!!uid} inert={!!uid}><SchedulerEmbed session={session} onComplete={complete} /></div>}
        {uid && session ? <div className="mt-4 flex flex-col gap-3"><a href={`https://cal.com/booking/${encodeURIComponent(uid)}`} target="_blank" rel="noopener noreferrer" className="text-sm underline">View the provider confirmation</a><Button variant="outline" onClick={() => complete(uid)} disabled={pending}>Check meeting status</Button></div> : null}
        {!uid ? <button type="button" className="mt-5 min-h-11 text-sm underline" onClick={() => setFallback(true)}>No suitable time? Request a meeting by email</button> : null}
      </>}
    </>}
    {pending ? <p role="status" className="mt-4 flex items-center gap-2 text-sm"><PixelLogoLoader variant="compact" />{uid ? 'Checking your meeting…' : 'Preparing the calendar…'}</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm">{error}</p> : null}
    {fallback && meeting.config.enabled && !result ? <button type="button" onClick={() => setFallback(false)} className="mt-4 min-h-11 text-sm underline">Return to scheduling</button> : null}
  </div>;
}
