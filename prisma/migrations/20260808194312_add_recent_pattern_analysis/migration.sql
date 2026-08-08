-- CreateTable
CREATE TABLE "RecentPatternAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reflectionIds" TEXT NOT NULL,
    "reflectionCount" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
