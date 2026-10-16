import "dotenv/config";
import { db } from "../src/server/db";
import { analyticsDeletionReferences, confirmAnalyticsDeletion, requestAnalyticsDeletion } from "../src/server/analytics/deletion";

async function main() {
  const [action, id, confirmation, ...extra] = process.argv.slice(2);
  if (extra.length || !["request", "inspect", "confirm", "pending"].includes(action ?? "") || (action !== "pending" && !id) || (action === "confirm" ? confirmation !== "--provider-erasure-verified" : !!confirmation) || (action === "pending" && id)) {
    throw new Error("Usage: privacy:analytics -- pending | <request|inspect> <visitor-id> | confirm <visitor-id> --provider-erasure-verified");
  }
  if (action === "pending") {
    console.log(JSON.stringify(await db.analyticsVisitor.findMany({ where: { deletionRequestedAt: { not: null }, deletionConfirmedAt: null }, select: { id: true, deletionRequestedAt: true }, take: 250 }), null, 2));
    return;
  }
  if (action === "request") await requestAnalyticsDeletion([id!]);
  if (action === "confirm") {
    if (!(await confirmAnalyticsDeletion(id!)).count) throw new Error("No pending deletion changed");
  }
  console.log(JSON.stringify(await analyticsDeletionReferences(id!), null, 2));
}
void main().catch(error => {
  // Only controlled usage errors are useful here; do not print database connection details.
  console.error(error instanceof Error && error.message.startsWith("Usage:") ? error.message : "Analytics privacy operation failed. Check the visitor ID, pending state and database configuration.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
