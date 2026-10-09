-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED');

-- AlterEnum
ALTER TYPE "LeadIntent" ADD VALUE 'MEETING';

-- CreateTable
CREATE TABLE "BookingSession" (
    "id" TEXT NOT NULL,
    "referenceHash" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventTypeId" INTEGER NOT NULL,
    "hostId" INTEGER NOT NULL,
    "entryPoint" TEXT NOT NULL,
    "campaignId" TEXT,
    "context" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CAL',
    "providerBookingId" TEXT NOT NULL,
    "eventTypeId" INTEGER NOT NULL,
    "hostId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "location" TEXT,
    "status" "AppointmentStatus" NOT NULL,
    "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
    "previousBookingId" TEXT,
    "replacementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "bookingUid" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSync" (
    "key" TEXT NOT NULL,
    "through" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSync_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingSession_referenceHash_key" ON "BookingSession"("referenceHash");

-- CreateIndex
CREATE INDEX "BookingSession_createdAt_idx" ON "BookingSession"("createdAt");

-- CreateIndex
CREATE INDEX "Appointment_sessionId_idx" ON "Appointment"("sessionId");

-- CreateIndex
CREATE INDEX "Appointment_status_updatedAt_idx" ON "Appointment"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_provider_providerBookingId_key" ON "Appointment"("provider", "providerBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingEvent_dedupeKey_key" ON "BookingEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "BookingEvent_processedAt_createdAt_idx" ON "BookingEvent"("processedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BookingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

