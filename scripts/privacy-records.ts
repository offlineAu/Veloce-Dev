import "dotenv/config";
import { updatePrivacyRecord, type RecordAction, type RecordKind } from "../src/server/privacy/retention";
import { db } from "../src/server/db";

// Database-owner command; not exposed through a public form or URL.
async function main() {
  const [action, kind, id, ...extra] = process.argv.slice(2);
  if (!action || !["close", "reopen", "hold", "release"].includes(action) || !kind || !["inquiry", "referral"].includes(kind) || !id || extra.length) {
    console.error("Usage: npm run privacy:record -- <close|reopen|hold|release> <inquiry|referral> <record-id>");
    process.exitCode = 1;
    return;
  }
  const result = await updatePrivacyRecord(kind as RecordKind, id, action as RecordAction);
  if (!result.count) throw new Error("No eligible record changed. Check the ID, current status and any associated booking. Closing again does not restart the retention clock.");
  console.log(JSON.stringify({ action, kind, changed: result.count }));
}
void main().catch(() => {
  console.error("Record update failed. Check command arguments, database configuration and eligibility. Booked or converted inquiries cannot be closed through this workflow.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
