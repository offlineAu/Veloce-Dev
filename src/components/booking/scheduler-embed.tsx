'use client';
import { useEffect, useState } from 'react';
import Cal, { getCalApi, type EmbedEvent } from '@calcom/embed-react';
import type { MeetingSession } from '@/lib/meeting';
import { PixelLogoLoader } from '@/components/brand/pixel-logo-loader';
const namespace = 'veloce-meeting';
export default function SchedulerEmbed({ session, onComplete }: { session: MeetingSession; onComplete: (uid: string) => void }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    const timeout = window.setTimeout(() => { if (active) setError(true); }, 20_000);
    void getCalApi({ namespace, embedJsUrl: session.embedJsUrl }).then(cal => {
      if (!active) return;
      const ready = () => { window.clearTimeout(timeout); setReady(true); setError(false); };
      const failed = () => { window.clearTimeout(timeout); setError(true); };
      const complete = (event: EmbedEvent<'bookingSuccessfulV2'>) => { const uid = event.detail.data.uid; if (uid) onComplete(uid); };
      cal('on', { action: 'linkReady', callback: ready });
      cal('on', { action: 'linkFailed', callback: failed });
      cal('on', { action: 'bookingSuccessfulV2', callback: complete });
      cleanup = () => {
        cal('off', { action: 'linkReady', callback: ready });
        cal('off', { action: 'linkFailed', callback: failed });
        cal('off', { action: 'bookingSuccessfulV2', callback: complete });
      };
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; window.clearTimeout(timeout); cleanup?.(); };
  }, [onComplete, session.embedJsUrl]);
  return <div className="mt-5 min-w-0">
    {!ready && !error ? <p role="status" className="flex items-center gap-3 text-sm"><PixelLogoLoader variant="compact" />Loading available meeting times…</p> : null}
    {error ? <p role="alert" className="mb-4 text-sm">The calendar is taking longer to load. You can open the booking page below or request a meeting by email.</p> : null}
    <Cal namespace={namespace} calLink={session.calLink} calOrigin={session.calOrigin} embedJsUrl={session.embedJsUrl} config={session.config} style={{ width: '100%', minHeight: 650, overflow: 'auto' }} />
    <a href={session.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm underline">Open the Veloce booking page in a new tab</a>
  </div>;
}
