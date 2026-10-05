-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONSULTATION_SCHEDULED', 'PROPOSAL_IN_PROGRESS', 'CONVERTED', 'NOT_PROCEEDING');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('DIRECT', 'REFERRAL_VERIFIED', 'REFERRAL_UNVERIFIED');

-- CreateEnum
CREATE TYPE "LeadIntent" AS ENUM ('CONVERSATION', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('NEW_PROJECT', 'REDESIGN', 'ECOMMERCE', 'CUSTOM_WEB_APP', 'INTEGRATION', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "WebsiteType" AS ENUM ('BUSINESS', 'CORPORATE', 'ECOMMERCE_STORE', 'WEB_APP', 'LANDING_PAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectInterest" AS ENUM ('NEW_WEBSITE', 'REDESIGN', 'FEATURE_OR_INTEGRATION', 'UNSURE');

-- CreateEnum
CREATE TYPE "IntroductionStatus" AS ENUM ('RECEIVED', 'REVIEWED', 'CONTACTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('LEAD_TEAM', 'LEAD_ACK', 'INTRO_TEAM', 'INTRO_REFERRER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "branding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "benefit" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCampaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "referrerName" TEXT,
    "referrerRole" TEXT,
    "referrerCompany" TEXT,
    "referrerEmail" TEXT,
    "personalMessage" TEXT,
    "showReferrerName" BOOLEAN NOT NULL DEFAULT false,
    "offerTitle" TEXT,
    "offerDescription" TEXT,
    "offerStartsAt" TIMESTAMP(3),
    "offerExpiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "currentWebsite" TEXT,
    "projectType" "ProjectType" NOT NULL,
    "websiteType" "WebsiteType",
    "projectGoals" TEXT NOT NULL,
    "additionalDetails" TEXT,
    "intent" "LeadIntent" NOT NULL DEFAULT 'CONVERSATION',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'DIRECT',
    "referralCampaignId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAttribution" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "landingPath" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralIntroduction" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "referrerName" TEXT NOT NULL,
    "referrerEmail" TEXT NOT NULL,
    "referredName" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "referredCompany" TEXT,
    "projectInterest" "ProjectInterest" NOT NULL,
    "message" TEXT,
    "referrerConsentAt" TIMESTAMP(3) NOT NULL,
    "status" "IntroductionStatus" NOT NULL DEFAULT 'RECEIVED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralIntroduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "leadId" TEXT,
    "introductionId" TEXT,
    "recipientHash" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE INDEX "Service_companyId_displayOrder_idx" ON "Service"("companyId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Service_companyId_slug_key" ON "Service"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCampaign_publicToken_key" ON "ReferralCampaign"("publicToken");

-- CreateIndex
CREATE INDEX "ReferralCampaign_companyId_active_idx" ON "ReferralCampaign"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_referralCampaignId_idx" ON "Lead"("referralCampaignId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAttribution_leadId_key" ON "LeadAttribution"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralIntroduction_idempotencyKey_key" ON "ReferralIntroduction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReferralIntroduction_campaignId_idx" ON "ReferralIntroduction"("campaignId");

-- CreateIndex
CREATE INDEX "ReferralIntroduction_status_createdAt_idx" ON "ReferralIntroduction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_referralCampaignId_fkey" FOREIGN KEY ("referralCampaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralIntroduction" ADD CONSTRAINT "ReferralIntroduction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_introductionId_fkey" FOREIGN KEY ("introductionId") REFERENCES "ReferralIntroduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
