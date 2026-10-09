import 'server-only';
import { db } from '@/server/db';
import { bookingSettings } from './config';
import { getBooking, safeMeetingLocation, type CalBooking } from './provider';
import { tokenHash } from './sessions';
import type { MeetingResult } from '@/lib/meeting';

export async function syncAppointment(booking: CalBooking) {
  const c = bookingSettings();
  if (booking.eventTypeId !== c.eventTypeId || booking.hosts.length !== 1 || booking.hosts[0]?.id !== c.hostId) return null;
  const startAt = new Date(booking.start), endAt = new Date(booking.end), version = new Date(booking.updatedAt);
  if (endAt <= startAt) throw new Error('Invalid booking interval');
  const reference = booking.metadata?.veloceSession;
  return db.$transaction(async tx => {
    // Serialize callback, webhook and reconciliation processing for the same booking.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`cal:${booking.uid}`}))::text`;
    const existing = await tx.appointment.findUnique({ where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: booking.uid } } });
    if (existing && existing.providerUpdatedAt > version) return existing;
    const previous = booking.rescheduledFromUid ? await tx.appointment.findUnique({ where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: booking.rescheduledFromUid } } }) : null;
    const session = existing ? await tx.bookingSession.findUnique({ where: { id: existing.sessionId } })
      : typeof reference === 'string' && /^[a-f0-9]{64}$/.test(reference) ? await tx.bookingSession.findUnique({ where: { referenceHash: tokenHash(reference) } })
      : previous ? await tx.bookingSession.findUnique({ where: { id: previous.sessionId } }) : null;
    if (!session || session.eventTypeId !== booking.eventTypeId || session.hostId !== c.hostId) return null;
    // Historical sync remains possible after session expiry, but a new booking must originate within its lifetime.
    if (!existing && !previous && (new Date(booking.createdAt) < session.createdAt || new Date(booking.createdAt) > session.expiresAt)) return null;
    const attendee = booking.attendees[0]!;
    try { new Intl.DateTimeFormat('en', { timeZone: attendee.timeZone }); } catch { throw new Error('Invalid booking timezone'); }
    const replacementId = booking.rescheduledToUid ?? existing?.replacementId ?? undefined;
    const status = replacementId ? 'RESCHEDULED' : booking.status === 'accepted' ? 'CONFIRMED' : booking.status === 'pending' ? 'REQUESTED' : 'CANCELLED';
    const campaign = session.campaignId ? await tx.referralCampaign.findUnique({ where: { id: session.campaignId } }) : null;
    const notes = booking.bookingFieldsResponses?.notes;
    const data = {
      eventTypeId: booking.eventTypeId, hostId: c.hostId, startAt, endAt, timezone: attendee.timeZone,
      location: booking.meetingUrl ?? booking.location, status, providerUpdatedAt: version,
      previousBookingId: booking.rescheduledFromUid, replacementId,
    } as const;
    let leadId = existing?.leadId ?? previous?.leadId;
    if (!leadId) {
      const lead = await tx.lead.create({ data: {
        companyId: session.companyId, name: attendee.name, email: attendee.email.toLowerCase(),
        projectType: 'OTHER', projectGoals: typeof notes === 'string' && notes.trim() ? notes.slice(0, 1000) : 'Introductory meeting with Veloce',
        intent: 'MEETING', status: status === 'CONFIRMED' ? 'CONSULTATION_SCHEDULED' : 'NEW',
        source: campaign ? 'REFERRAL_VERIFIED' : 'DIRECT', referralCampaignId: campaign?.id,
        consentAt: session.consentAt, idempotencyKey: `cal:${booking.uid}`,
        attribution: { create: { landingPath: '/', utmSource: session.utmSource, utmMedium: session.utmMedium, utmCampaign: session.utmCampaign } },
      }, select: { id: true } });
      leadId = lead.id;
    }
    const row = await tx.appointment.upsert({
      where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: booking.uid } },
      create: { ...data, providerBookingId: booking.uid, sessionId: session.id, leadId }, update: data,
    });
    if (previous) await tx.appointment.update({ where: { id: previous.id }, data: { status: 'RESCHEDULED', replacementId: booking.uid } });
    if (status === 'CONFIRMED') await tx.lead.updateMany({ where: { id: leadId, status: { in: ['NEW', 'CONTACTED'] } }, data: { status: 'CONSULTATION_SCHEDULED' } });
    return row;
  }, { timeout: 20_000 });
}
export async function verifiedMeeting(reference: string, accessToken: string, uid?: string): Promise<MeetingResult | null> {
  const session = await db.bookingSession.findUnique({ where: { referenceHash: tokenHash(reference) } });
  if (!session || session.accessHash !== tokenHash(accessToken)) return null;
  if (uid) {
    const booking = await getBooking(uid);
    const existing = await db.appointment.findUnique({ where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: uid } } });
    const previous = booking.rescheduledFromUid ? await db.appointment.findUnique({ where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: booking.rescheduledFromUid } } }) : null;
    if (booking.metadata?.veloceSession !== reference && existing?.sessionId !== session.id && previous?.sessionId !== session.id) return null;
    await syncAppointment(booking);
  }
  const row = await db.appointment.findFirst({ where: { sessionId: session.id, replacementId: null }, orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }] });
  if (!row) return null;
  return { status: row.status, start: row.startAt.toISOString(), end: row.endAt.toISOString(), timezone: row.timezone,
    location: safeMeetingLocation(row.location ?? undefined) ?? (row.location?.startsWith('http') ? undefined : row.location ?? undefined),
    manageUrl: `${bookingSettings().webOrigin}/booking/${encodeURIComponent(row.providerBookingId)}` };
}
