-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "BuilderTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "websiteType" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "package" JSONB NOT NULL,
    "css" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "thumbnails" JSONB NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploaderIpHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderTemplateAsset" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "BuilderTemplateAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuilderTemplate_slug_key" ON "BuilderTemplate"("slug");

-- CreateIndex
CREATE INDEX "BuilderTemplateVersion_status_idx" ON "BuilderTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderTemplateVersion_templateId_version_key" ON "BuilderTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderTemplateAsset_versionId_path_key" ON "BuilderTemplateAsset"("versionId", "path");

-- AddForeignKey
ALTER TABLE "BuilderTemplateVersion" ADD CONSTRAINT "BuilderTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BuilderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderTemplateAsset" ADD CONSTRAINT "BuilderTemplateAsset_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BuilderTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

