import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(), allow: vi.fn(), delivers: { value: true }, deliver: vi.fn(), privacy: vi.fn(),
  findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), activity: vi.fn(), log: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/admin/session", () => ({ requireOwner: mocks.owner }));
vi.mock("@/server/security/rate-limit", () => ({ allow: mocks.allow }));
vi.mock("@/server/security/hash", () => ({ hmac: (v: string) => `h(${v})` }));
vi.mock("@/server/privacy/retention", () => ({ updatePrivacyRecord: mocks.privacy }));
vi.mock("@/server/notifications/dispatch", () => ({ deliverLoggedNotification: mocks.deliver }));
vi.mock("@/server/notifications/provider", () => ({ getProvider: () => ({ delivers: mocks.delivers.value }) }));
vi.mock("@/server/notifications/templates", () => ({ followUpEmail: (d: object) => ({ ...d, text: "", html: "" }) }));
vi.mock("@/server/db", () => {
  const tx = { lead: { updateMany: mocks.updateMany, update: mocks.update }, leadActivity: { create: mocks.activity } };
  return { db: { ...tx, lead: { ...tx.lead, findUnique: mocks.findUnique }, notificationLog: { create: mocks.log }, $transaction: (work: unknown) => typeof work === "function" ? work(tx) : Promise.all(work as Promise<unknown>[]) } };
});
import { addNote, changeStage, closeClient, followUpDrafts, sendFollowUp, suggestFollowUp } from "@/server/clients/tracker";

const now = new Date("2026-10-22T10:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = { closedAt: null, stageChangedAt: null, lastContactedAt: null };
const requestId = "8f14e45f-ceea-467a-9a3c-2a4b1d1e1f10";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue(undefined); mocks.allow.mockResolvedValue(true); mocks.delivers.value = true;
  mocks.log.mockResolvedValue({ id: "log1" }); mocks.deliver.mockResolvedValue("SENT");
  mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.update.mockResolvedValue({}); mocks.activity.mockResolvedValue({});
});

describe("follow-up suggestions", () => {
  it("asks for a first reply on new inquiries, overdue after a day", () => {
    expect(suggestFollowUp({ ...base, status: "NEW", createdAt: daysAgo(0) }, now)).toMatchObject({ key: "first-reply", overdue: false, reason: "Arrived today" });
    expect(suggestFollowUp({ ...base, status: "NEW", createdAt: daysAgo(3) }, now)).toMatchObject({ key: "first-reply", overdue: true, reason: "Waiting 3 days for a first reply" });
  });
  it("uses the latest of stage change and contact to measure quiet time", () => {
    expect(suggestFollowUp({ ...base, status: "CONTACTED", createdAt: daysAgo(30), stageChangedAt: daysAgo(20), lastContactedAt: daysAgo(4) }, now)).toBeNull();
    expect(suggestFollowUp({ ...base, status: "CONTACTED", createdAt: daysAgo(30), stageChangedAt: daysAgo(6) }, now)).toMatchObject({ key: "check-in", overdue: false });
    expect(suggestFollowUp({ ...base, status: "PROPOSAL_IN_PROGRESS", createdAt: daysAgo(30), stageChangedAt: daysAgo(15) }, now)).toMatchObject({ key: "proposal-nudge", overdue: true });
  });
  it("suggests next steps only after a meeting that hasn't been followed up", () => {
    const lead = { ...base, status: "CONSULTATION_SCHEDULED" as const, createdAt: daysAgo(10) };
    expect(suggestFollowUp({ ...lead, lastCallEndedAt: daysAgo(-1) }, now)).toBeNull();
    expect(suggestFollowUp({ ...lead, lastCallEndedAt: daysAgo(3) }, now)).toMatchObject({ key: "after-call", overdue: true });
    expect(suggestFollowUp({ ...lead, lastCallEndedAt: daysAgo(3), lastContactedAt: daysAgo(1) }, now)).toBeNull();
  });
  it("never suggests anything for won or closed inquiries", () => {
    expect(suggestFollowUp({ ...base, status: "CONVERTED", createdAt: daysAgo(40) }, now)).toBeNull();
    expect(suggestFollowUp({ ...base, status: "CONTACTED", createdAt: daysAgo(40), closedAt: daysAgo(1) }, now)).toBeNull();
  });
  it("drafts address the person by first name and quote a short goal", () => {
    const drafts = followUpDrafts({ name: "Maria Santos", projectGoals: "A booking site for my clinic" }, "Veloce");
    expect(drafts["first-reply"].body).toMatch(/^Hi Maria,/);
    expect(drafts["first-reply"].body).toContain('"A booking site for my clinic"');
  });
});

describe("sending follow-ups", () => {
  const lead = { id: "lead1", email: "Maria@Example.com", status: "NEW", closedAt: null, company: { name: "Veloce" } };
  const send = () => sendFollowUp({ id: "lead1", subject: "Hello", body: "Hi Maria", requestId }, now);
  it("sends once, logs it, records contact and moves a new inquiry to Contacted", async () => {
    mocks.findUnique.mockResolvedValue(lead);
    expect(await send()).toEqual({ sent: true });
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "LEAD_FOLLOW_UP", dedupeKey: `LEAD_FOLLOW_UP:lead1:${requestId}`, recipientHash: "h(rcpt:maria@example.com)" }) }));
    expect(mocks.deliver).toHaveBeenCalledWith("log1", "Maria@Example.com", expect.objectContaining({ subject: "Hello" }), `LEAD_FOLLOW_UP:lead1:${requestId}`);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastContactedAt: now } });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1", status: "NEW", closedAt: null }, data: { status: "CONTACTED", stageChangedAt: now } }));
    expect(mocks.activity.mock.calls.map(([arg]) => arg.data.kind)).toEqual(["EMAIL_SENT", "STAGE_CHANGED"]);
  });
  it("refuses closed inquiries, missing email setup, the daily cap and repeats", async () => {
    mocks.findUnique.mockResolvedValue({ ...lead, status: "NOT_PROCEEDING", closedAt: daysAgo(1) });
    expect(await send()).toEqual({ sent: false, error: "Follow-ups can't be sent for a closed inquiry." });
    mocks.findUnique.mockResolvedValue(lead); mocks.delivers.value = false;
    expect((await send()).sent).toBe(false);
    mocks.delivers.value = true; mocks.allow.mockResolvedValue(false);
    expect(await send()).toMatchObject({ error: expect.stringContaining("3 follow-ups") });
    mocks.allow.mockResolvedValue(true); mocks.log.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await send()).toEqual({ sent: false, error: "This follow-up was already sent." });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("records a failed delivery without marking the person contacted", async () => {
    mocks.findUnique.mockResolvedValue(lead); mocks.deliver.mockResolvedValue("FAILED");
    expect((await send()).sent).toBe(false);
    expect(mocks.activity.mock.calls[0]![0].data.kind).toBe("EMAIL_FAILED");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects bad input and requires the owner before reading anything", async () => {
    expect(await sendFollowUp({ id: "lead1", subject: "", body: "x", requestId }, now)).toMatchObject({ sent: false });
    expect(await sendFollowUp({ id: "lead1", subject: "x", body: "x", requestId: "not-a-uuid" }, now)).toMatchObject({ sent: false });
    mocks.owner.mockRejectedValue(new Error("Owner session required"));
    await expect(send()).rejects.toThrow("Owner session required");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});

describe("stage changes", () => {
  it("moves a new inquiry to Contacted when a contact is logged, but not for a plain note", async () => {
    mocks.findUnique.mockResolvedValue({ id: "lead1" });
    await addNote("lead1", "Quick note", false, now);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    await addNote("lead1", "Called her", true, now);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastContactedAt: now } });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", status: "NEW", closedAt: null }, data: { status: "CONTACTED", stageChangedAt: now } });
  });
  it("moves open inquiries only, guarding on the stage that was read", async () => {
    mocks.findUnique.mockResolvedValue({ status: "CONTACTED", closedAt: null });
    await changeStage("lead1", "PROPOSAL_IN_PROGRESS", "Sent quote", now);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", status: "CONTACTED", closedAt: null }, data: { status: "PROPOSAL_IN_PROGRESS", stageChangedAt: now } });
    await expect(changeStage("lead1", "NOT_PROCEEDING")).rejects.toThrow("Use Close");
    mocks.findUnique.mockResolvedValue({ status: "NOT_PROCEEDING", closedAt: daysAgo(1) });
    await expect(changeStage("lead1", "NEW")).rejects.toThrow("Reopen");
  });
  it("closes through the privacy workflow and explains refusals", async () => {
    mocks.findUnique.mockResolvedValue({ status: "CONVERTED" });
    mocks.privacy.mockResolvedValue({ count: 0 });
    await expect(closeClient("lead1")).rejects.toThrow("can't be closed");
    expect(mocks.privacy).toHaveBeenCalledWith("inquiry", "lead1", "close", expect.any(Date));
  });
});

