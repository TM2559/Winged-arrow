-- DataModule: drop infoName, make techName and issueDate nullable; store issueDate as string
CREATE TABLE "DataModule_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dmCode" TEXT NOT NULL,
    "techName" TEXT,
    "issueDate" TEXT,
    "xmlContent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "DataModule_new" ("id", "dmCode", "techName", "issueDate", "xmlContent", "createdAt", "updatedAt")
SELECT "id", "dmCode", "techName", datetime("issueDate"), "xmlContent", "createdAt", "updatedAt" FROM "DataModule";

DROP TABLE "DataModule";

ALTER TABLE "DataModule_new" RENAME TO "DataModule";

CREATE UNIQUE INDEX "DataModule_dmCode_key" ON "DataModule"("dmCode");

-- SparePart: description -> name, add unit, remove importedAt
CREATE TABLE "SparePart_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT
);

INSERT INTO "SparePart_new" ("id", "partNumber", "name", "quantity", "unit")
SELECT "id", "partNumber", "description", "quantity", NULL FROM "SparePart";

DROP TABLE "SparePart";

ALTER TABLE "SparePart_new" RENAME TO "SparePart";

CREATE UNIQUE INDEX "SparePart_partNumber_key" ON "SparePart"("partNumber");
