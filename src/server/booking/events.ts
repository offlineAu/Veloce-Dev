import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/server/db';
import { getBooking } from './provider';
import { syncAppointment } from './appointments';

export const webhookSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({ uid: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) }),
});
const triggers = new Set(['BOOKING_CREATED', 'BOOKING_REQUESTED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_REJECTED']);
export async function processBookingEvent(id: string) {
  const event = await db.bookingEvent.findUniqueOrThrow({ where: { id } });
  if (event.processedAt) return;
  try {
    const booking = await getBooking(event.bookingUid);
    if ((event.trigger === 'BOOKING_CANCELLED' || event.trigger === 'BOOKING_REJECTED') && !['cancelled', 'rejected'].includes(booking.status)) {
      throw new Error('Provider transition has not committed yet');
    }
    await syncAppointment(booking);
    await db.bookingEvent.update({ where: { id }, data: { processedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
  } catch {
    await db.bookingEvent.update({ where: { id }, data: { attempts: { increment: 1 }, lastError: 'Provider lookup or appointment sync failed' } });
    throw new Error('Booking sync failed');
  }
}
export async function recordBookingEvent(body: string) {
  const input = webhookSchema.parse(JSON.parse(body));
  if (!triggers.has(input.triggerEvent)) return;
  const dedupeKey = createHash('sha256').update(body).digest('hex');
  return db.bookingEvent.upsert({ where: { dedupeKey }, create: { dedupeKey, bookingUid: input.payload.uid, trigger: input.triggerEvent }, update: {} });
}
export async function acceptBookingEvent(body: string) {
  const row = await recordBookingEvent(body);
  if (row) await processBookingEvent(row.id);
}
