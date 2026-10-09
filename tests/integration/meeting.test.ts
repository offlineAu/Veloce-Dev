import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
vi.mock('@/server/booking/config', () => ({ bookingSettings: () => ({ enabled: true, configured: true, eventTypeId: 42, hostId: 7, url: new URL('https://cal.com/veloce/intro'), apiKey: 'fake' }) }));
const { providerBooking, providerList } = vi.hoisted(() => ({ providerBooking: vi.fn(), providerList: vi.fn() }));
vi.mock('@/server/booking/provider', async importOriginal => ({ ...await importOriginal<object>(), getBooking: providerBooking, listBookings: providerList }));
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
const reachable = await client.connect().then(() => client.end().then(() => true), () => false);
const suite = reachable ? describe : describe.skip;
suite('meeting lifecycle on PostgreSQL', () => {
  let db: typeof import('@/server/db').db;
  let sync: typeof import('@/server/booking/appointments');
  let sessions: typeof import('@/server/booking/sessions');
  let events: typeof import('@/server/booking/events');
  let sessionId: string, reference: string, accessToken: string;
  const uids: string[] = [];
  const sessionIds: string[] = [];
  const requestKeys: string[] = [];
  const fixture = (overrides: object = {}) => {
    const uid = `meeting_test_${crypto.randomUUID()}`; uids.push(uid);
    return { uid, eventTypeId: 42, hosts: [{ id: 7 }], status: 'accepted' as const,
      start: new Date(Date.now() + 86400_000).toISOString(), end: new Date(Date.now() + 86400_000 + 1800_000).toISOString(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      attendees: [{ name: 'Test Visitor', email: 'meeting-fixture@example.com', timeZone: 'Asia/Manila' }], metadata: { veloceSession: reference }, ...overrides };
  };
  beforeEach(async () => {
    providerBooking.mockReset(); providerList.mockReset();
    ({ db } = await import('@/server/db'));
    sync = await import('@/server/booking/appointments'); sessions = await import('@/server/booking/sessions'); events = await import('@/server/booking/events');
    await db.rateLimit.deleteMany();
    const session = await sessions.startMeetingSession({ entryPoint: 'workbench', privacyConsent: true }, 'meeting-tests');
    reference = session.reference; accessToken = session.accessToken;
    sessionId = (await db.bookingSession.findUniqueOrThrow({ where: { referenceHash: sessions.tokenHash(reference) } })).id;
    sessionIds.push(sessionId);
  });
  afterAll(async () => {
    if (!db) return;
    const leads = await db.appointment.findMany({ where: { providerBookingId: { in: uids } }, select: { leadId: true } });
    await db.appointment.deleteMany({ where: { providerBookingId: { in: uids } } });
    await db.lead.deleteMany({ where: { id: { in: leads.map(l => l.leadId) } } });
    await db.lead.deleteMany({ where: { idempotencyKey: { in: requestKeys } } });
    await db.bookingEvent.deleteMany({ where: { bookingUid: { in: uids } } });
    await db.bookingSession.deleteMany({ where: { id: { in: sessionIds } } });
    (await import('@/server/notifications/provider')).setProviderForTests(undefined);
    await db.$disconnect();
  });
  it('opening scheduling stores no lead, and hashes separate public/private tokens', async () => {
    const session = await db.bookingSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.referenceHash).not.toBe(reference);
    expect(session.accessHash).not.toBe(accessToken);
    expect(session.referenceHash).not.toBe(session.accessHash);
    expect(await db.appointment.count({ where: { sessionId } })).toBe(0);
  });
  it('deduplicates concurrent confirmations and verifies private ownership', async () => {
    const booking = fixture();
    await Promise.all([sync.syncAppointment(booking), sync.syncAppointment(booking)]);
    expect(await db.appointment.count({ where: { sessionId } })).toBe(1);
    const row = await db.appointment.findFirstOrThrow({ where: { sessionId }, include: { lead: true } });
    expect(row.lead.intent).toBe('MEETING'); expect(row.status).toBe('CONFIRMED');
    expect(await sync.verifiedMeeting(reference, 'c'.repeat(64))).toBeNull();
    expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'CONFIRMED', timezone: 'Asia/Manila' });
  });
  it('rejects another event, host, forged metadata and bookings initiated after expiry', async () => {
    expect(await sync.syncAppointment(fixture({ eventTypeId: 99 }))).toBeNull();
    expect(await sync.syncAppointment(fixture({ hosts: [{ id: 99 }] }))).toBeNull();
    expect(await sync.syncAppointment(fixture({ metadata: { veloceSession: 'f'.repeat(64) } }))).toBeNull();
    await db.bookingSession.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await sync.syncAppointment(fixture())).toBeNull();
  });
  it('keeps awaiting approval distinct and ignores stale updates', async () => {
    const booking = fixture({ status: 'pending' }); await sync.syncAppointment(booking);
    expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'REQUESTED' });
    await sync.syncAppointment({ ...booking, status: 'cancelled', updatedAt: new Date(Date.now() + 1000).toISOString() });
    await sync.syncAppointment(booking);
    expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'CANCELLED' });
  });
  it('rescheduling to an earlier time displays the replacement and cannot be regressed by the old event', async () => {
    const old = fixture(); await sync.syncAppointment(old);
    const replacement = fixture({ rescheduledFromUid: old.uid, start: new Date(Date.now() + 3600_000).toISOString(), end: new Date(Date.now() + 5400_000).toISOString() });
    await sync.syncAppointment(replacement); await sync.syncAppointment(old);
    expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'CONFIRMED', start: replacement.start });
    expect((await db.appointment.findUniqueOrThrow({ where: { provider_providerBookingId: { provider: 'CAL', providerBookingId: old.uid } } })).status).toBe('RESCHEDULED');
  });
  it('failed provider events remain recoverable and duplicate deliveries do not duplicate bookings', async () => {
    const booking = fixture(); const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: booking.uid } });
    providerBooking.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(events.acceptBookingEvent(body)).rejects.toThrow();
    expect(await db.bookingEvent.count({ where: { bookingUid: booking.uid, processedAt: null } })).toBe(1);
    providerBooking.mockResolvedValue(booking);
    await events.acceptBookingEvent(body); await events.acceptBookingEvent(body);
    expect(await db.appointment.count({ where: { sessionId } })).toBe(1);
    expect(await db.bookingEvent.count({ where: { bookingUid: booking.uid } })).toBe(1);
  });
  it('a browser completion for another session cannot expose or confirm its meeting', async () => {
    const booking = fixture({ metadata: { veloceSession: 'f'.repeat(64) } });
    providerBooking.mockResolvedValue(booking);
    expect(await sync.verifiedMeeting(reference, accessToken, booking.uid)).toBeNull();
    expect(await db.appointment.count({ where: { sessionId } })).toBe(0);
  });
  it('does not acknowledge a cancellation as processed while the provider still reports accepted', async () => {
    const booking = fixture();
    await sync.syncAppointment(booking);
    const body = JSON.stringify({ triggerEvent: 'BOOKING_CANCELLED', payload: { uid: booking.uid } });
    providerBooking.mockResolvedValue(booking);
    await expect(events.acceptBookingEvent(body)).rejects.toThrow();
    expect(await db.bookingEvent.count({ where: { bookingUid: booking.uid, processedAt: null } })).toBe(1);
    providerBooking.mockResolvedValue({ ...booking, status: 'cancelled', updatedAt: new Date(Date.now() + 1000).toISOString() });
    await events.acceptBookingEvent(body);
    expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'CANCELLED' });
  });
  it('confirmed bookings do not send duplicate inquiry notifications', async () => {
    const row = await sync.syncAppointment(fixture());
    expect(await db.notificationLog.count({ where: { leadId: row!.leadId } })).toBe(0);
  });
  it('two recovery workers claim each failed meeting notification once', async () => {
    const provider = await import('@/server/notifications/provider');
    const { submitInquiry } = await import('@/server/services/lead');
    const { retryMeetingNotifications } = await import('@/server/notifications/retry');
    const key = crypto.randomUUID(); requestKeys.push(key);
    provider.setProviderForTests({ delivers: true, send: async () => { throw new Error('Temporary failure'); } });
    expect(await submitInquiry({ name: 'Retry Fixture', email: 'retry-fixture@example.com', intent: 'MEETING', projectType: 'OTHER', projectGoals: 'Introductory meeting with Veloce', privacyConsent: true, idempotencyKey: key, startedAt: Date.now() - 5000 }, { clientKey: 'meeting-retry-test' })).toEqual({ ok: true });
    const lead = await db.lead.findUniqueOrThrow({ where: { idempotencyKey: key } });
    await db.notificationLog.updateMany({ where: { leadId: lead.id }, data: { updatedAt: new Date(Date.now() - 180_000) } });
    let sent = 0;
    provider.setProviderForTests({ delivers: true, send: async () => { sent++; return { providerRef: 'retry-fixture' }; } });
    await Promise.all([retryMeetingNotifications(lead.id), retryMeetingNotifications(lead.id)]);
    expect(sent).toBe(2);
    expect(await db.notificationLog.count({ where: { leadId: lead.id, status: 'SENT', attempts: 2 } })).toBe(2);
    await retryMeetingNotifications(lead.id); expect(sent).toBe(2);
    provider.setProviderForTests(undefined);
  });
  it('reconciliation resumes a bounded cursor window and repairs a missing webhook', async () => {
    const { reconcileBookings } = await import('@/server/booking/reconcile');
    const original = await db.bookingSync.findUnique({ where: { key: 'CAL' } });
    try {
      await db.bookingSync.deleteMany({ where: { key: 'CAL' } });
      for (let i = 1; i <= 10; i++) providerList.mockResolvedValueOnce({ bookings: [], nextCursor: `cursor-${i}` });
      expect(await reconcileBookings()).toMatchObject({ complete: false });
      const checkpoint = await db.bookingSync.findUniqueOrThrow({ where: { key: 'CAL' } });
      expect(checkpoint.cursor).toBe('cursor-10');
      const booking = fixture();
      providerList.mockResolvedValueOnce({ bookings: [booking], nextCursor: null });
      expect(await reconcileBookings()).toMatchObject({ complete: true, bookings: 1 });
      expect(providerList.mock.calls[10]?.[2]).toBe('cursor-10');
      expect(providerList.mock.calls[10]?.[1]).toEqual(checkpoint.windowEnd);
      expect(await sync.verifiedMeeting(reference, accessToken)).toMatchObject({ status: 'CONFIRMED' });
      expect((await db.bookingSync.findUniqueOrThrow({ where: { key: 'CAL' } })).cursor).toBeNull();
    } finally {
      await db.bookingSync.deleteMany({ where: { key: 'CAL' } });
      if (original) await db.bookingSync.create({ data: original });
    }
  });
});
