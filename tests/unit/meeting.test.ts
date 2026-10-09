import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { meetingRequestSchema, meetingSessionSchema, meetingVerificationSchema } from '@/schemas/meeting';
import { suggestedDiscussion } from '@/lib/meeting';
import { verifyCalSignature, safeMeetingLocation, calBookingSchema } from '@/server/booking/provider';
import { leadAckEmail, leadTeamEmail } from '@/server/notifications/templates';

describe('meeting boundaries', () => {
  it('requires explicit consent and limits context at both entry points', () => {
    expect(meetingSessionSchema.safeParse({ entryPoint: 'workbench', privacyConsent: false }).success).toBe(false);
    expect(meetingSessionSchema.safeParse({ entryPoint: 'contact', privacyConsent: true, context: 'x'.repeat(1001) }).success).toBe(false);
    expect(meetingSessionSchema.parse({ entryPoint: 'workbench', privacyConsent: true, refToken: 'forged!' }).refToken).toBeUndefined();
  });
  it('permits meeting requests without fabricated project details', () => {
    const value = meetingRequestSchema.parse({ name: ' Alex ', email: 'A@EXAMPLE.COM', privacyConsent: true, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 3000 });
    expect(value).toMatchObject({ name: 'Alex', email: 'a@example.com' });
    expect(value.context).toBeUndefined();
  });
  it('requires a private verification token as well as a public reference', () => {
    expect(meetingVerificationSchema.safeParse({ reference: 'a'.repeat(64), uid: 'abc' }).success).toBe(false);
    expect(meetingVerificationSchema.safeParse({ reference: 'a'.repeat(64), accessToken: 'b'.repeat(64), uid: '../anything' }).success).toBe(false);
  });
  it('authenticates the exact raw webhook body', () => {
    const body = '{"payload":{"uid":"abc"}}';
    const signature = createHmac('sha256', 'test-secret').update(body).digest('hex');
    expect(verifyCalSignature(body, signature, 'test-secret')).toBe(true);
    expect(verifyCalSignature(body + ' ', signature, 'test-secret')).toBe(false);
    expect(verifyCalSignature(body, signature, 'wrong')).toBe(false);
    expect(verifyCalSignature(body, 'x', 'test-secret')).toBe(false);
    expect(verifyCalSignature(body, null, 'test-secret')).toBe(false);
  });
  it('does not treat sample times as meeting context', () => {
    expect(suggestedDiscussion({ workflow: 'booking', priority: 'first' })).toContain('choose an available time');
    expect(suggestedDiscussion({ workflow: 'booking', priority: 'later' })).toContain('automated reminders');
    expect(suggestedDiscussion({ workflow: 'approvals', priority: 'later' })).toContain('automatic escalation');
    expect(suggestedDiscussion()).toBe('');
    expect(suggestedDiscussion({ workflow: 'booking', priority: 'first' })).not.toContain('11:30');
  });
  it('does not render unsafe provider meeting links', () => {
    expect(safeMeetingLocation('javascript:alert(1)')).toBeUndefined();
    expect(safeMeetingLocation('http://example.com')).toBeUndefined();
    expect(safeMeetingLocation('https://example.com/meeting')).toBe('https://example.com/meeting');
  });
  it('rejects unknown booking states and malformed identity', () => {
    expect(calBookingSchema.safeParse({ uid: 'abc', status: 'paid' }).success).toBe(false);
  });
  it('meeting request emails describe a request rather than a reserved appointment', () => {
    expect(leadAckEmail({ company: 'Veloce', name: 'Alex', intent: 'MEETING' }).text).toContain('No appointment time has been reserved');
    expect(leadTeamEmail({ company: 'Veloce', name: 'Alex', email: 'alex@example.com', projectType: 'OTHER', goals: 'Meet', intent: 'MEETING', source: 'DIRECT' }).text).toContain('No time has been reserved');
  });
});
