import 'server-only';
import { db } from '@/server/db';
import { bookingSettings } from './config';
import { getBooking, listBookings } from './provider';
import { syncAppointment } from './appointments';
import { processBookingEvent } from './events';

export async function reconcileBookings() {
  const settings = bookingSettings();
  if (!settings.configured) return { enabled: false, events: 0, bookings: 0, failures: 0 };
  let events = 0, bookings = 0, failures = 0;
  const pending = await db.bookingEvent.findMany({ where: { processedAt: null, attempts: { lt: 10 } }, orderBy: { createdAt: 'asc' }, take: 25 });
  for (const event of pending) {
    try { await processBookingEvent(event.id); events++; } catch { failures++; }
  }
  const now = new Date();
  const key = settings.local ? `CAL_LOCAL:${settings.webOrigin}:${settings.eventTypeId}` : 'CAL';
  const checkpoint = await db.bookingSync.upsert({ where: { key }, create: { key, through: new Date(now.getTime() - 7 * 86400_000) }, update: {} });
  const through = checkpoint.windowEnd ?? now;
  const after = new Date(checkpoint.through.getTime() - 3600_000);
  let cursor = checkpoint.cursor ?? undefined;
  let complete = false;
  // Resume the same snapshot/cursor next run if the bounded window does not finish.
  for (let page = 0; page < 10; page++) {
    const batch = await listBookings(after, through, cursor);
    let pageFailed = false;
    for (const booking of batch.bookings) {
      if (booking.eventTypeId !== settings.eventTypeId) continue;
      try {
        await syncAppointment(booking);
        if (booking.rescheduledFromUid) await syncAppointment(await getBooking(booking.rescheduledFromUid));
        bookings++;
      } catch { failures++; pageFailed = true; }
    }
    if (pageFailed) break;
    if (!batch.nextCursor) {
      complete = true;
      await db.bookingSync.update({ where: { key }, data: { through, cursor: null, windowEnd: null } });
      break;
    }
    cursor = batch.nextCursor;
    await db.bookingSync.update({ where: { key }, data: { cursor, windowEnd: through } });
  }
  return { enabled: true, events, bookings, failures, complete };
}
