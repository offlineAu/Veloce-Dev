import 'server-only';
import { db } from '@/server/db';
import { env } from '@/config/env';
import { hmac } from '@/server/security/hash';
import { getProvider } from './provider';
import { deliverLoggedNotification } from './dispatch';
import { leadAckEmail, leadTeamEmail } from './templates';

export async function retryMeetingNotifications(leadId?: string) {
  if (!getProvider().delivers) return { sent: 0, failed: 0, configured: false };
  const rows = await db.notificationLog.findMany({
    where: { leadId, status: { in: ['PENDING', 'FAILED', 'SKIPPED'] }, attempts: { lt: 5 }, lead: { intent: 'MEETING' }, updatedAt: { lt: new Date(Date.now() - 120_000) } },
    include: { lead: { include: { company: true, campaign: true } } }, orderBy: { createdAt: 'asc' }, take: 25,
  });
  let sent = 0, failed = 0;
  for (const row of rows) {
    const lead = row.lead;
    if (!lead || (row.kind !== 'LEAD_TEAM' && row.kind !== 'LEAD_ACK')) continue;
    const to = row.kind === 'LEAD_ACK' ? lead.email : env().NOTIFY_TEAM_EMAIL ?? lead.company.contactEmail;
    // Changing configuration must not silently reroute an existing recipient's outbox row.
    if (hmac(`rcpt:${to.toLowerCase()}`) !== row.recipientHash) { failed++; continue; }
    const message = row.kind === 'LEAD_ACK' ? leadAckEmail({ company: lead.company.name, name: lead.name, intent: 'MEETING' }) : leadTeamEmail({
      company: lead.company.name, name: lead.name, email: lead.email, goals: lead.projectGoals,
      projectType: 'Introductory meeting', intent: 'MEETING', source: lead.source, campaignName: lead.campaign?.name,
    });
    const result = await deliverLoggedNotification(row.id, to, message, row.dedupeKey);
    if (result === 'SENT') sent++;
    if (result === 'FAILED') failed++;
  }
  return { sent, failed, configured: true };
}
