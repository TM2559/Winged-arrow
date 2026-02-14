-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "personnel" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "dmId" INTEGER,
    "partId" INTEGER,
    CONSTRAINT "MaintenanceTask_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "DataModule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceTask_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTask_taskCode_key" ON "MaintenanceTask"("taskCode");
