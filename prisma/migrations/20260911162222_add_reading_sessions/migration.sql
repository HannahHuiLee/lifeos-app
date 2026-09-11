-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learningUnitId" TEXT,
    "materialTitle" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "analysis" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingSession_learningUnitId_fkey" FOREIGN KEY ("learningUnitId") REFERENCES "LearningUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReadingSession_learningUnitId_idx" ON "ReadingSession"("learningUnitId");
