-- CreateTable
CREATE TABLE "DataModule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dmCode" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "techName" TEXT NOT NULL,
    "infoName" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DataModule_dmCode_key" ON "DataModule"("dmCode");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_partNumber_key" ON "SparePart"("partNumber");
