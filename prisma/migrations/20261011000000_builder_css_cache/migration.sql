-- CreateTable
CREATE TABLE "BuilderCssCache" (
    "key" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderCssCache_pkey" PRIMARY KEY ("key")
);

