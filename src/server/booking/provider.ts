import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { bookingSettings } from './config';

export const calBookingSchema = z.object({
  uid: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  eventTypeId: z.number().int(),
  hosts: z.array(z.object({ id: z.number().int() })).min(1),
  status: z.enum(['accepted', 'pending', 'cancelled', 'rejected']),
  start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  attendees: z.array(z.object({ name: z.string().min(1).max(100), email: z.email().max(254), timeZone: z.string().max(100) })).min(1),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  bookingFieldsResponses: z.record(z.string(), z.unknown()).nullish(),
  location: z.string().max(2000).nullish(), meetingUrl: z.string().max(2000).nullish(),
  rescheduledFromUid: z.string().nullish(), rescheduledToUid: z.string().nullish(),
});
export type CalBooking = z.infer<typeof calBookingSchema>;
export function verifyCalSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
async function calGet(path: string, apiVersion = '2026-02-25') {
  const c = bookingSettings();
  if (!c.configured) throw new Error('Booking provider unavailable');
  const res = await fetch(`${c.apiBase}${path}`, {
    headers: { Authorization: `Bearer ${c.apiKey}`, 'cal-api-version': c.local ? '2024-08-13' : apiVersion },
    cache: 'no-store', signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Booking provider returned ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error('Booking provider rejected lookup');
  return body;
}
export async function getBooking(uid: string): Promise<CalBooking> {
  return calBookingSchema.parse((await calGet(`bookings/${encodeURIComponent(uid)}`)).data);
}
export async function listBookings(after: Date, before: Date, cursor?: string) {
  const params = new URLSearchParams({ eventTypeId: String(bookingSettings().eventTypeId), afterUpdatedAt: after.toISOString(), beforeUpdatedAt: before.toISOString(), sortUpdatedAt: 'asc', limit: '100' });
  const local = bookingSettings().local;
  if (local) {
    params.delete('limit'); params.set('take', '100');
    params.set('status', 'upcoming,recurring,past,cancelled,unconfirmed');
    if (cursor && !/^\d+$/.test(cursor)) throw new Error('Invalid local booking cursor');
    params.set('skip', cursor || '0');
  } else if (cursor) params.set('cursor', cursor);
  const body = await calGet(`bookings?${params}`, '2026-05-01');
  const bookings = z.array(calBookingSchema).parse(body.data);
  return { bookings, nextCursor: local ? (bookings.length === 100 ? String(Number(cursor || '0') + 100) : null) : z.string().nullish().parse(body.pagination?.nextCursor) };
}
export function safeMeetingLocation(value?: string) {
  if (!value) return undefined;
  try { const u = new URL(value); return u.protocol === 'https:' ? u.toString() : undefined; } catch { return undefined; }
}
