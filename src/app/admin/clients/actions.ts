"use server";
import { refresh } from "next/cache";
import type { LeadStatus } from "@/generated/prisma/client";
import { addNote, changeStage, closeClient, MOVABLE, reopenClient, sendFollowUp, TrackerError } from "@/server/clients/tracker";

export type ActionState = { error?: string; ok?: string };
const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" ? value : ""; };
const id = (form: FormData) => { const value = text(form, "id"); if (!/^[a-z0-9]{10,40}$/.test(value)) throw new TrackerError("Unknown inquiry."); return value; };

/** Runs a tracker change and turns expected refusals into a message. Owner checks happen inside each tracker call. */
async function run(work: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await work();
    refresh();
    return { ok: ok || "Saved." };
  } catch (error) {
    if (error instanceof TrackerError) return { error: error.message };
    if (error instanceof Error && error.message === "Owner session required") return { error: "Your session has ended. Sign in again." };
    return { error: "Something went wrong. Please try again." };
  }
}

export async function moveStage(_: ActionState, form: FormData) {
  return run(async () => {
    const to = text(form, "status") as LeadStatus;
    if (!MOVABLE.includes(to)) throw new TrackerError("Choose a stage.");
    await changeStage(id(form), to, text(form, "note").trim().slice(0, 1000));
    return "Stage updated.";
  });
}

export async function closeInquiry(_: ActionState, form: FormData) {
  return run(async () => { await closeClient(id(form), text(form, "note").trim().slice(0, 1000)); return "Closed. It will be deleted after the retention period unless reopened."; });
}

export async function reopenInquiry(_: ActionState, form: FormData) {
  return run(async () => { await reopenClient(id(form)); return "Reopened as New."; });
}

export async function saveNote(_: ActionState, form: FormData) {
  return run(async () => {
    const contacted = form.get("contacted") === "on";
    await addNote(id(form), text(form, "note"), contacted);
    return contacted ? "Contact logged." : "Note saved.";
  });
}

export async function sendFollowUpAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const result = await sendFollowUp({ id: id(form), subject: text(form, "subject"), body: text(form, "body"), requestId: text(form, "requestId") });
    if (!result.sent) throw new TrackerError(result.error);
    return "Follow-up sent.";
  });
}
