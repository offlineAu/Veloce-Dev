-- Historical closure dates cannot be inferred safely from createdAt or updatedAt.
ALTER TABLE "Lead" ADD COLUMN "closedAt" TIMESTAMP(3), ADD COLUMN "retentionHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReferralIntroduction" ADD COLUMN "closedAt" TIMESTAMP(3), ADD COLUMN "retentionHold" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Lead_status_closedAt_idx" ON "Lead"("status", "closedAt");
CREATE INDEX "ReferralIntroduction_status_closedAt_idx" ON "ReferralIntroduction"("status", "closedAt");
