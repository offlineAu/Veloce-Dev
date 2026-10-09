import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '@/server/db';
import { allow } from '@/server/security/rate-limit';
import { findCampaign } from '@/server/services/campaign';
import { ensureCompanyId } from '@/server/services/company';
import { meetingSessionSchema } from '@/schemas/meeting';
import { bookingSettings } from './config';
import type { MeetingSession } from '@/lib/meeting';

export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function startMeetingSession(raw: unknown, clientKey: string): Promise<MeetingSession> {
  const input = meetingSessionSchema.parse(raw);
  const c = bookingSettings();
  if (!c.enabled || !c.url) throw new Error('Scheduling unavailable');
  if (!await allow(`meeting:start:${clientKey}`, 12, 3600_000)) throw new Error('Please try again later');
  const reference = randomBytes(32).toString('hex');
  const accessToken = randomBytes(32).toString('hex');
  const campaign = await findCampaign(input.refToken);
  await db.bookingSession.create({ data: {
    referenceHash: tokenHash(reference), accessHash: tokenHash(accessToken),
    companyId: await ensureCompanyId(), eventTypeId: c.eventTypeId, hostId: c.hostId,
    entryPoint: input.entryPoint, campaignId: campaign?.id, context: input.context,
    utmSource: input.utmSource, utmMedium: input.utmMedium, utmCampaign: input.utmCampaign,
    consentAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600_000),
  } });
  const config: Record<string, string> = { 'metadata[veloceSession]': reference, layout: 'month_view' };
  if (input.context) config.notes = input.context;
  const url = new URL(c.url);
  for (const [k, v] of Object.entries(config)) url.searchParams.set(k, v);
  return { reference, accessToken, url: url.toString(), calLink: c.url.pathname.slice(1), config,
    ...(c.local ? { calOrigin: c.webOrigin, embedJsUrl: c.embedUrl } : {}) };
}
