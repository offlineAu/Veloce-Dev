import { bookingSettings } from '@/server/booking/config';
import { after } from 'next/server';
import { verifyCalSignature } from '@/server/booking/provider';
import { recordBookingEvent, processBookingEvent } from '@/server/booking/events';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = bookingSettings().webhookSecret;
  if (!secret) return new Response(null, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > 65536) return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 65536) return new Response(null, { status: 413 });
  if (!verifyCalSignature(body, request.headers.get('x-cal-signature-256'), secret)) return new Response(null, { status: 401 });
  try {
    const event = await recordBookingEvent(body);
    if (event && !event.processedAt) after(async () => {
      // Cal can await our response before committing its booking transition.
      await new Promise(resolve => setTimeout(resolve, 250));
      try { await processBookingEvent(event.id); } catch { /* The journal retains the failure for maintenance. */ }
    });
    return new Response(null, { status: 204 });
  }
  catch { return new Response(null, { status: 503 }); }
}
