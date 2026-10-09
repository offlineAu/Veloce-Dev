'use server';
import { z } from 'zod';
import { clientKey } from '@/server/security/request';
import { allow } from '@/server/security/rate-limit';
import { startMeetingSession } from '@/server/booking/sessions';
import { verifiedMeeting } from '@/server/booking/appointments';
import { meetingRequestSchema, meetingVerificationSchema } from '@/schemas/meeting';
import { submitInquiry } from '@/server/services/lead';
import type { ActionResult } from '@/server/services/result';
import type { MeetingResult, MeetingSession } from '@/lib/meeting';

export async function startMeetingAction(input: unknown): Promise<ActionResult<{ session: MeetingSession }>> {
  try { return { ok: true, session: await startMeetingSession(input, await clientKey()) }; } catch { return { ok: false, code: 'UNAVAILABLE' }; }
}
export async function verifyMeetingAction(input: unknown): Promise<ActionResult<{ meeting: MeetingResult | null }>> {
  const parsed = meetingVerificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    if (!await allow(`meeting:verify:${await clientKey()}`, 60, 3600_000)) return { ok: false, code: 'RATE_LIMITED' };
    return { ok: true, meeting: await verifiedMeeting(parsed.data.reference, parsed.data.accessToken, parsed.data.uid) };
  } catch { return { ok: false, code: 'UNAVAILABLE' }; }
}
export async function requestMeetingAction(input: unknown): Promise<ActionResult> {
  const parsed = meetingRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'VALIDATION', fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { context, ...data } = parsed.data;
  return submitInquiry({ ...data, intent: 'MEETING', projectType: 'OTHER', projectGoals: context ?? 'Introductory meeting with Veloce', landingPath: '/' }, { clientKey: await clientKey() });
}
