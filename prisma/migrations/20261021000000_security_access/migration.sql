CREATE TABLE "SecuritySession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SecuritySession_kind_expiresAt_idx" ON "SecuritySession"("kind", "expiresAt");
CREATE TABLE "PrivateCaseStudy" (
  "slug" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "images" JSONB NOT NULL
);
CREATE TABLE "PrivateAccessGrant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "caseSlug" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateAccessGrant_caseSlug_fkey" FOREIGN KEY ("caseSlug") REFERENCES "PrivateCaseStudy"("slug") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrivateAccessGrant_tokenHash_key" ON "PrivateAccessGrant"("tokenHash");
CREATE INDEX "PrivateAccessGrant_caseSlug_expiresAt_idx" ON "PrivateAccessGrant"("caseSlug", "expiresAt");
