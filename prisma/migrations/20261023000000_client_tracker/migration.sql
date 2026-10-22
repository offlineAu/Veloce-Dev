ALTER TYPE "NotificationKind" ADD VALUE 'LEAD_FOLLOW_UP';
CREATE TYPE "LeadActivityKind" AS ENUM ('STAGE_CHANGED', 'NOTE', 'CONTACT_LOGGED', 'EMAIL_SENT', 'EMAIL_FAILED');
ALTER TABLE "Lead" ADD COLUMN "stageChangedAt" TIMESTAMP(3), ADD COLUMN "lastContactedAt" TIMESTAMP(3);
CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "kind" "LeadActivityKind" NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus",
  "subject" TEXT,
  "body" TEXT,
  "notificationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
