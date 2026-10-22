import "server-only";
import { randomUUID } from "node:crypto";
import type { LeadStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireOwner } from "@/server/admin/session";
import { allow } from "@/server/security/rate-limit";
import { hmac } from "@/server/security/hash";
import { updatePrivacyRecord } from "@/server/privacy/retention";
import { deliverLoggedNotification } from "@/server/notifications/dispatch";
import { getProvider } from "@/server/notifications/provider";
import { followUpEmail } from "@/server/notifications/templates";

/*
 * Client tracker: the owner's view of inquiries, their stage, a timeline, and follow-up emails the owner reviews and
 * sends one at a time. Nothing here sends on a schedule. Follow-ups are about the person's own inquiry only (the
 * privacy notice promises no mailing list), so they are refused for closed inquiries.
 */

export const STAGES = ["NEW", "CONTACTED", "CONSULTATION_SCHEDULED", "PROPOSAL_IN_PROGRESS", "CONVERTED", "NOT_PROCEEDING"] as const satisfies readonly LeadStatus[];
/** Stages the owner can move an open inquiry to directly. Not proceeding goes through close(), which starts retention. */
export const MOVABLE: readonly LeadStatus[] = ["NEW", "CONTACTED", "CONSULTATION_SCHEDULED", "PROPOSAL_IN_PROGRESS", "CONVERTED"];
const DAY = 86_400_000;

export type FollowUpKey = "first-reply" | "check-in" | "after-call" | "proposal-nudge";
export type Suggestion = { key: FollowUpKey; label: string; reason: string; overdue: boolean };
type SuggestInput = { status: LeadStatus; closedAt: Date | null; createdAt: Date; stageChangedAt: Date | null; lastContactedAt: Date | null; lastCallEndedAt?: Date | null };

const daysSince = (date: Date, now: Date) => Math.floor((now.getTime() - date.getTime()) / DAY);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the owner should do next, if anything, from stage and quiet time. Drafts only; the owner decides. */
export function suggestFollowUp(lead: SuggestInput, now = new Date()): Suggestion | null {
  if (lead.closedAt || lead.status === "CONVERTED" || lead.status === "NOT_PROCEEDING") return null;
  const lastTouch = [lead.stageChangedAt ?? lead.createdAt, lead.lastContactedAt].filter((d): d is Date => !!d).reduce((a, b) => a > b ? a : b);
  const quiet = daysSince(lastTouch, now);
  if (lead.status === "NEW") {
    const age = daysSince(lead.createdAt, now);
    return { key: "first-reply", label: "Send a first reply", reason: age ? `Waiting ${plural(age, "day")} for a first reply` : "Arrived today", overdue: age >= 1 };
  }
  if (lead.status === "CONTACTED" && quiet >= 5) return { key: "check-in", label: "Check in", reason: `No contact for ${plural(quiet, "day")}`, overdue: quiet >= 10 };
  if (lead.status === "CONSULTATION_SCHEDULED" && lead.lastCallEndedAt && lead.lastCallEndedAt < now && (!lead.lastContactedAt || lead.lastContactedAt < lead.lastCallEndedAt)) {
    const since = daysSince(lead.lastCallEndedAt, now);
    return { key: "after-call", label: "Send next steps", reason: since ? `Meeting was ${plural(since, "day")} ago` : "Meeting ended today", overdue: since >= 2 };
  }
  if (lead.status === "PROPOSAL_IN_PROGRESS" && quiet >= 7) return { key: "proposal-nudge", label: "Follow up on the proposal", reason: `No contact for ${plural(quiet, "day")}`, overdue: quiet >= 14 };
  return null;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
/** Starting drafts. The owner edits them before anything is sent. */
export function followUpDrafts(lead: { name: string; projectGoals: string }, company: string): Record<FollowUpKey, { title: string; subject: string; body: string }> {
  const hi = `Hi ${first(lead.name)},`;
  const goal = lead.projectGoals.trim().replace(/\s+/g, " ").slice(0, 140);
  return {
    "first-reply": { title: "First reply", subject: "Your inquiry with " + company, body: `${hi}\n\nThank you for reaching out about your project.${goal ? ` You mentioned: "${goal}${lead.projectGoals.length > 140 ? "…" : ""}"` : ""} I'd like to learn a bit more before suggesting an approach.\n\nWould you be open to a short call this week? Reply with a couple of times that suit you, or answer here if email is easier.\n\nBest regards,\n${company}` },
    "check-in": { title: "Check in", subject: "Following up on your inquiry", body: `${hi}\n\nI wanted to follow up on our last conversation about your project. Is this still something you'd like to move forward with?\n\nIf the timing isn't right, just let me know and I'll close this for now — no pressure either way.\n\nBest regards,\n${company}` },
    "after-call": { title: "Next steps after the call", subject: "Next steps from our conversation", body: `${hi}\n\nThank you for your time on our call. As a quick recap, here's what I understood and what happens next:\n\n• \n• \n\nI'll follow up with [what you promised] by [date]. If I've missed anything, reply and let me know.\n\nBest regards,\n${company}` },
    "proposal-nudge": { title: "Proposal follow-up", subject: "Any questions about the proposal?", body: `${hi}\n\nI wanted to check whether you've had a chance to look over the proposal, and whether any part of it needs more detail or a different option.\n\nHappy to walk through it on a short call if that's easier.\n\nBest regards,\n${company}` },
  };
}

export const PAGE_SIZE = 50;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);
/** Last stage change (or arrival) and last contact both at or before `cutoff`: the database form of "quiet since". */
const quietSince = (cutoff: Date): Prisma.LeadWhereInput => ({ AND: [
  { OR: [{ stageChangedAt: { lte: cutoff } }, { stageChangedAt: null, createdAt: { lte: cutoff } }] },
  { OR: [{ lastContactedAt: null }, { lastContactedAt: { lte: cutoff } }] },
] });
/**
 * Overdue inquiries, mirroring suggestFollowUp. The meeting rule compares two columns (contact after the call), which
 * Prisma can't express, so those few candidates are confirmed with suggestFollowUp after loading.
 */
function overdueWhere(now: Date): Prisma.LeadWhereInput {
  return { closedAt: null, OR: [
    { status: "NEW", createdAt: { lte: ago(now, 1) } },
    { status: "CONTACTED", ...quietSince(ago(now, 10)) },
    { status: "PROPOSAL_IN_PROGRESS", ...quietSince(ago(now, 14)) },
    { status: "CONSULTATION_SCHEDULED", appointments: { some: { status: "CONFIRMED", endAt: { lte: ago(now, 2) } } } },
  ] };
}
const rowSelect = { id: true, name: true, email: true, companyName: true, projectType: true, intent: true, source: true, status: true, closedAt: true, createdAt: true, stageChangedAt: true, lastContactedAt: true, appointments: { where: { status: "CONFIRMED" as const }, orderBy: { endAt: "desc" as const }, take: 1, select: { startAt: true, endAt: true } } } satisfies Prisma.LeadSelect;

export type ClientFilter = { stage?: LeadStatus | "OPEN" | "ATTENTION"; q?: string; page?: number };
export async function listClients(filter: ClientFilter = {}, now = new Date()) {
  await requireOwner();
  const q = filter.q?.trim().slice(0, 100);
  const stage = filter.stage ?? "OPEN";
  const scope: Prisma.LeadWhereInput = stage === "ATTENTION" ? overdueWhere(now) : stage === "OPEN" ? { closedAt: null, status: { not: "NOT_PROCEEDING" } } : { status: stage };
  const where: Prisma.LeadWhereInput = q ? { AND: [scope, { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] }] } : scope;
  const overdue = overdueWhere(now);
  const [total, leads, counts, simpleOverdue, meetingCandidates] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE, skip: Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE, select: rowSelect }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.lead.count({ where: { AND: [overdue, { status: { not: "CONSULTATION_SCHEDULED" } }] } }),
    db.lead.findMany({ where: { AND: [overdue, { status: "CONSULTATION_SCHEDULED" }] }, take: 500, select: rowSelect }),
  ]);
  const withSuggestion = <T extends (typeof leads)[number]>(lead: T) => {
    const call = lead.appointments[0];
    return { ...lead, nextCall: call && call.startAt > now ? call.startAt : null, suggestion: suggestFollowUp({ ...lead, lastCallEndedAt: call?.endAt }, now) };
  };
  const rows = leads.map(withSuggestion);
  const byStage = new Map(counts.map(row => [row.status, row._count._all]));
  return {
    // A meeting candidate that was already followed up is not overdue; drop it from the attention list.
    rows: stage === "ATTENTION" ? rows.filter(row => row.suggestion?.overdue) : rows,
    total, page: filter.page ?? 1, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(STAGES.map(s => [s, byStage.get(s) ?? 0])) as Record<LeadStatus, number>,
    attention: simpleOverdue + meetingCandidates.map(withSuggestion).filter(row => row.suggestion?.overdue).length,
  };
}

export async function getClient(id: string, now = new Date()) {
  await requireOwner();
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } }, campaign: { select: { name: true } }, attribution: true, siteDraft: { select: { token: true } },
      appointments: { orderBy: { startAt: "desc" }, select: { id: true, startAt: true, endAt: true, status: true, timezone: true, location: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      notifications: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, status: true, createdAt: true } },
    },
  });
  if (!lead) return null;
  const lastCall = lead.appointments.find(a => a.status === "CONFIRMED" && a.endAt < now);
  return {
    lead,
    suggestion: suggestFollowUp({ ...lead, lastCallEndedAt: lastCall?.endAt }, now),
    drafts: followUpDrafts(lead, lead.company.name),
    emailReady: getProvider().delivers,
  };
}

export class TrackerError extends Error {}
const open = (lead: { closedAt: Date | null; status: LeadStatus }) => !lead.closedAt && lead.status !== "NOT_PROCEEDING";

export async function changeStage(id: string, to: LeadStatus, note?: string, now = new Date()) {
  await requireOwner();
  if (!MOVABLE.includes(to)) throw new TrackerError("Use Close to mark an inquiry as not proceeding.");
  const lead = await db.lead.findUnique({ where: { id }, select: { status: true, closedAt: true } });
  if (!lead) throw new TrackerError("This inquiry no longer exists.");
  if (!open(lead)) throw new TrackerError("Reopen this inquiry before changing its stage.");
  if (lead.status === to) return;
  await db.$transaction(async tx => {
    // Guard on the stage we read, so two tabs can't record conflicting moves.
    const moved = await tx.lead.updateMany({ where: { id, status: lead.status, closedAt: null }, data: { status: to, stageChangedAt: now } });
    if (!moved.count) throw new TrackerError("This inquiry changed in the meantime. Refresh and try again.");
    await tx.leadActivity.create({ data: { leadId: id, kind: "STAGE_CHANGED", fromStatus: lead.status, toStatus: to, body: note || null, createdAt: now } });
  });
}

export async function closeClient(id: string, note?: string, now = new Date()) {
  await requireOwner();
  const lead = await db.lead.findUnique({ where: { id }, select: { status: true } });
  if (!lead) throw new TrackerError("This inquiry no longer exists.");
  // Same rule as the privacy close workflow: never close a won client or one with a booking.
  const closed = await updatePrivacyRecord("inquiry", id, "close", now);
  if (!closed.count) throw new TrackerError("This inquiry can't be closed: it is already closed, won, or has a booking.");
  await db.lead.update({ where: { id }, data: { stageChangedAt: now } });
  await db.leadActivity.create({ data: { leadId: id, kind: "STAGE_CHANGED", fromStatus: lead.status, toStatus: "NOT_PROCEEDING", body: note || null, createdAt: now } });
}

export async function reopenClient(id: string, now = new Date()) {
  await requireOwner();
  const reopened = await updatePrivacyRecord("inquiry", id, "reopen", now);
  if (!reopened.count) throw new TrackerError("Only closed inquiries can be reopened.");
  await db.lead.update({ where: { id }, data: { stageChangedAt: now } });
  await db.leadActivity.create({ data: { leadId: id, kind: "STAGE_CHANGED", fromStatus: "NOT_PROCEEDING", toStatus: "NEW", createdAt: now } });
}

export async function addNote(id: string, body: string, contacted = false, now = new Date()) {
  await requireOwner();
  const text = body.trim();
  if (!text && !contacted) throw new TrackerError("Write a note first.");
  if (text.length > 4000) throw new TrackerError("Keep notes under 4,000 characters.");
  const lead = await db.lead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) throw new TrackerError("This inquiry no longer exists.");
  await db.$transaction(async tx => {
    await tx.leadActivity.create({ data: { leadId: id, kind: contacted ? "CONTACT_LOGGED" : "NOTE", body: text || null, createdAt: now } });
    if (!contacted) return;
    await tx.lead.update({ where: { id }, data: { lastContactedAt: now } });
    await markContacted(tx, id, now, "Moved automatically after the first logged contact.");
  });
}
/** A first reply, by email or logged by hand, moves a new inquiry to Contacted. */
async function markContacted(tx: Prisma.TransactionClient, id: string, now: Date, reason: string) {
  const moved = await tx.lead.updateMany({ where: { id, status: "NEW", closedAt: null }, data: { status: "CONTACTED", stageChangedAt: now } });
  if (moved.count) await tx.leadActivity.create({ data: { leadId: id, kind: "STAGE_CHANGED", fromStatus: "NEW", toStatus: "CONTACTED", body: reason, createdAt: new Date(now.getTime() + 1) } });
}

export type FollowUpResult = { sent: true } | { sent: false; error: string };
/**
 * Sends one owner-approved follow-up. `requestId` comes from the form so a double submit can't send twice: it is part of
 * the outbox dedupe key. A first successful email moves a new inquiry to Contacted.
 */
export async function sendFollowUp(input: { id: string; subject: string; body: string; requestId: string }, now = new Date()): Promise<FollowUpResult> {
  await requireOwner();
  const subject = input.subject.trim().replace(/\s+/g, " "), body = input.body.trim();
  if (!subject || subject.length > 150) return { sent: false, error: "Write a subject of up to 150 characters." };
  if (!body || body.length > 5000) return { sent: false, error: "Write a message of up to 5,000 characters." };
  if (!/^[0-9a-f-]{36}$/.test(input.requestId)) return { sent: false, error: "Refresh the page and try again." };
  const lead = await db.lead.findUnique({ where: { id: input.id }, select: { id: true, email: true, status: true, closedAt: true, company: { select: { name: true } } } });
  if (!lead) return { sent: false, error: "This inquiry no longer exists." };
  if (!open(lead)) return { sent: false, error: "Follow-ups can't be sent for a closed inquiry." };
  if (!getProvider().delivers) return { sent: false, error: "Email isn't set up on the server, so nothing was sent." };
  if (!await allow(`follow-up:${lead.id}`, 3, DAY)) return { sent: false, error: "You've sent 3 follow-ups to this person today. Try again tomorrow." };
  const dedupeKey = `LEAD_FOLLOW_UP:${lead.id}:${input.requestId}`;
  let logId: string;
  try {
    logId = (await db.notificationLog.create({ data: { kind: "LEAD_FOLLOW_UP", leadId: lead.id, recipientHash: hmac(`rcpt:${lead.email.toLowerCase()}`), dedupeKey }, select: { id: true } })).id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { sent: false, error: "This follow-up was already sent." };
    throw error;
  }
  const result = await deliverLoggedNotification(logId, lead.email, followUpEmail({ company: lead.company.name, subject, body }), dedupeKey);
  if (result !== "SENT") {
    await db.leadActivity.create({ data: { leadId: lead.id, kind: "EMAIL_FAILED", subject, body, notificationId: logId, createdAt: now } });
    return { sent: false, error: result === "SKIPPED" ? "Email isn't set up on the server, so nothing was sent." : "The email couldn't be delivered. It was saved in the timeline; try again shortly." };
  }
  await db.$transaction(async tx => {
    await tx.leadActivity.create({ data: { leadId: lead.id, kind: "EMAIL_SENT", subject, body, notificationId: logId, createdAt: now } });
    await tx.lead.update({ where: { id: lead.id }, data: { lastContactedAt: now } });
    await markContacted(tx, lead.id, now, "Moved automatically after the first follow-up.");
  });
  return { sent: true };
}

export const newRequestId = () => randomUUID();
