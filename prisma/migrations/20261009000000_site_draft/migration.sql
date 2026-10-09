CREATE TABLE "SiteDraft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "templateId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteDraft_leadId_key" ON "SiteDraft"("leadId");
CREATE UNIQUE INDEX "SiteDraft_token_key" ON "SiteDraft"("token");

ALTER TABLE "SiteDraft" ADD CONSTRAINT "SiteDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
