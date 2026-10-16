CREATE TABLE "AnalyticsVisitor" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "noticeVersion" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "identifiedAt" TIMESTAMP(3),
  "deletionRequestedAt" TIMESTAMP(3), "deletionConfirmedAt" TIMESTAMP(3),
  CONSTRAINT "AnalyticsVisitor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsVisitor_reference_key" ON "AnalyticsVisitor"("reference");
CREATE INDEX "AnalyticsVisitor_expiresAt_idx" ON "AnalyticsVisitor"("expiresAt");
ALTER TABLE "Lead" ADD COLUMN "analyticsVisitorId" TEXT, ADD COLUMN "analyticsLinkedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_analyticsVisitorId_fkey" FOREIGN KEY ("analyticsVisitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Lead_analyticsVisitorId_idx" ON "Lead"("analyticsVisitorId");
ALTER TABLE "ReferralIntroduction" ADD COLUMN "analyticsVisitorId" TEXT, ADD COLUMN "analyticsLinkedAt" TIMESTAMP(3);
ALTER TABLE "ReferralIntroduction" ADD CONSTRAINT "ReferralIntroduction_analyticsVisitorId_fkey" FOREIGN KEY ("analyticsVisitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ReferralIntroduction_analyticsVisitorId_idx" ON "ReferralIntroduction"("analyticsVisitorId");
ALTER TABLE "BookingSession" ADD COLUMN "analyticsVisitorId" TEXT, ADD COLUMN "analyticsLinkedAt" TIMESTAMP(3);
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_analyticsVisitorId_fkey" FOREIGN KEY ("analyticsVisitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BookingSession_analyticsVisitorId_idx" ON "BookingSession"("analyticsVisitorId");
ALTER TABLE "BookingSession" ADD COLUMN "analyticsContext" JSONB;
ALTER TABLE "Lead" ADD COLUMN "analyticsBookingConfirmedAt" TIMESTAMP(3);
