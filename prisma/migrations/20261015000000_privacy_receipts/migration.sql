-- Do not backfill historical consent with a notice that was never shown.
ALTER TABLE "Lead" ADD COLUMN "privacyNoticeVersion" TEXT, ADD COLUMN "consentPurpose" TEXT;
ALTER TABLE "ReferralIntroduction" ADD COLUMN "privacyNoticeVersion" TEXT, ADD COLUMN "consentPurpose" TEXT;
ALTER TABLE "BookingSession" ADD COLUMN "privacyNoticeVersion" TEXT, ADD COLUMN "consentPurpose" TEXT;
