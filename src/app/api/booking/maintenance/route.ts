import { timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';
import { reconcileBookings } from '@/server/booking/reconcile';
import { retryMeetingNotifications } from '@/server/notifications/retry';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const expected = env().BOOKING_CRON_SECRET;
  const received = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || expected.length < 32 || !received || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return new Response(null, { status: 401 });
  try {
    const booking = await reconcileBookings();
    const notifications = await retryMeetingNotifications();
    return Response.json({ booking, notifications }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Maintenance failed; retry required' }, { status: 503 }); }
}
