// Explicit test-process preload. Never imported by application code.
if (process.env.VELOCE_BOOKING_FIXTURE !== 'true') throw new Error('Cal fixture requires an explicit test process');
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== 'https://api.cal.com') return originalFetch(input, init);
  if (url.pathname === '/v2/bookings') return Response.json({ status: 'success', data: [], pagination: { nextCursor: null } });
  const uid = decodeURIComponent(url.pathname.split('/').pop());
  const reference = uid?.split('_').pop();
  if (!/^[a-f0-9]{64}$/.test(reference ?? '')) return new Response(null, { status: 404 });
  const now = Date.now();
  return Response.json({ status: 'success', data: {
    uid, eventTypeId: 42, hosts: [{ id: 7 }], status: uid.startsWith('pending_') ? 'pending' : 'accepted',
    start: new Date(now + 86400_000).toISOString(), end: new Date(now + 86400_000 + 1800_000).toISOString(),
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    attendees: [{ name: 'Calendar Fixture', email: 'calendar-fixture@example.com', timeZone: 'Asia/Manila' }],
    metadata: { veloceSession: reference }, meetingUrl: 'https://example.com/test-meeting',
  } });
};
