# Development Context

Long-term memory for AI and developers. Update this file as the project evolves.

- **Repository**: [https://github.com/TM2559/Winged-arrow](https://github.com/TM2559/Winged-arrow)

---

## 1. Current Project State
## 🚀 Current Status (Ready for Demo)
- **Architecture**: Node.js/TypeScript backend with Express.
- **Documentation**: Swagger UI fully functional at `/api-docs`.
- **S2000M Module**: 
  - Implements `POST /import` for spare parts.
  - Secured with **Zod validation** (rejects invalid data).
  - Correctly handles array-based imports (`{ parts: [...] }`).
- **S1000D Module**: 
  - Implements `POST /upload` for XML Data Modules.
  - **XML Parser**: Successfully extracts metadata (DMC, TechName) from raw S1000D XML, including attributes.
  - Generates deep links to the Viewer.
- **Frontend**: Basic HTML Viewer for visualization.

## 🎯 Current Goals (Immediate)
1.  **DEMO DAY**: Present the MVP to Škoda IT/Management.
    - Demonstrate S2000M validation (Security).
    - Demonstrate S1000D XML parsing (Integration).
2.  **Acquire Access**: Get credentials for the Maximo Sandbox environment.
3.  **Next Sprint**: Connect the middleware to the real Maximo API.

---

## 2. Tech Stack

| Technology      | Version / Notes                          |
|-----------------|------------------------------------------|
| Node.js         | >= 18.0.0 (engines in package.json)       |
| TypeScript      | ^5.6.3                                   |
| Express         | ^4.21.0                                  |
| fast-xml-parser | ^5.3.5 (S1000D XML parsing)              |
| axios           | ^1.7.7 (Maximo HTTP client)               |
| multer          | ^2.0.2 (S1000D file upload)              |
| winston         | ^3.15.0 (logging)                        |
| dotenv          | ^16.4.5 (env config)                     |
| nodemon         | ^3.1.7 (dev)                             |
| ts-node         | ^10.9.2 (dev)                            |

- **Build**: `npm run build` → `tsc` → output in `dist/`.
- **Run**: `npm start` (production) or `npm run dev` (nodemon + ts-node).

---

## 3. Working Features

- **Health**: `GET /health` → `{ status: 'ok', timestamp }`.
- **S1000D**
  - **Link by Work Order**: `GET /api/v1/s1000d/link?wo=WO1001` → JSON with `workOrder`, `asset`, `dmc`, `viewerUrl`. Only `WO1001` is currently known (in-controller mock).
  - **Upload XML**: `POST /api/v1/s1000d/upload` (multipart, field `xml` or `file`) → parses S1000D XML, returns `dmc`, `title`, `model`, `viewerUrl`.
- **S2000M**
  - **Import provisioning**: `POST /api/v1/s2000m/import` with body `{ parts: [{ partNumber, description, unitOfMeasure }] }` → maps to Maximo Item Master shape, returns `success`, `imported`, `items`; **no real Maximo call** (logs payload only).
- **Mock Viewer**: `GET /viewer/index.html?dmc=...&model=...` shows DMC/model in a simple card UI; no real CSDB or full MAXIMO Mobile Gateway backend.
- **Sample data**: `data/samples/S1000D_sample.xml`, `data/samples/s2000m_sample.json` for manual/API testing.

**Not covered by automated tests**: no test suite (e.g. Jest/Vitest) present; features are manually verified.

---

## 4. Mocked vs Real

| Area                    | Current state | Notes |
|-------------------------|---------------|--------|
| S1000D WO → DMC/link    | **Mocked**    | In-controller `MOCK_DB` in `s1000dController.ts`; only WO1001. `maximoClient.getWorkOrderByNum()` exists (MOCK/REAL) but is **not** used by the link route. |
| S1000D XML parsing      | **Real**      | `xmlParser.ts` + fast-xml-parser; extracts DMC and title from S1000D XML. |
| S1000D Viewer           | **Mocked**    | Static HTML in `mocks/viewer/`; displays query params only, no CSDB. |
| S2000M → Maximo Item    | **Mocked**    | Mapping and response are real; **sending to Maximo is simulated** (payload logged, no HTTP call). |
| Maximo API (OSLC)       | **Optional**  | `maximoClient.ts` supports `APP_MODE=MOCK` (static data) or `APP_MODE=REAL` (axios to `MAXIMO_URL`). Not used by S1000D link or S2000M import today. |
| Jython WO script        | **Standalone**| Uses hardcoded `https://ips-viewer.skoda.cz/view`; does not call this Node service. |

---

## 5. Last Commit Summary

**2026-02-14** — feat: Completed MVP with Native Viewer and Database persistence (Prisma/SQLite, styled HTML viewer).
**2026-02-11** — af701f2 Initial commit: Škoda IPS-Maximo Integration MVP



*(Run `node scripts/update-context.js` to refresh.)*

---

## 🎯 Current Goals (Immediate)
1.  **DEMO DAY**: Present the MVP to Škoda IT/Management.
    - Demonstrate S2000M validation (Security).
    - Demonstrate S1000D XML parsing (Integration).
2.  **Acquire Access**: Get credentials for the Maximo Sandbox environment.
3.  **Next Sprint**: Connect the middleware to the real Maximo API.
---

## 7. Technical Debt / Issues

- **No tests**: No unit or integration tests; add tests for `xmlParser`, `s2000mService`, and API routes when stabilizing.
- **S1000D link duplication**: Link endpoint uses its own `MOCK_DB`; `maximoClient` has equivalent mock and REAL implementation but is unused for this flow — consolidate to avoid drift.
- **S2000M**: No actual HTTP call to Maximo Item Master API; implement when environment and API contract are fixed.
- **Multer types**: S1000D upload uses `(req as Request & { file?, files? })`; consider proper Multer typings or a small wrapper.
- **Jython script**: Base URL and integration point (this service vs external viewer) to be aligned when deploying.
- **Config**: `APP_MODE` and `MAXIMO_*` are only used by `maximoClient`; document in `.env.example` that they apply to future REAL integration.

---

## 8. Project Structure

```
.
├── data/
│   └── samples/
│       ├── S1000D_sample.xml
│       └── s2000m_sample.json
├── mocks/
│   └── viewer/
│       └── index.html
├── scripts/
│   ├── maximo/
│   │   └── WO_S1000D_LINK.py
│   └── update-context.js
├── src/
│   ├── config/
│   │   └── index.ts
│   ├── controllers/
│   │   ├── s1000dController.ts
│   │   └── s2000mController.ts
│   ├── routes/
│   │   ├── s1000dRoutes.ts
│   │   └── s2000mRoutes.ts
│   ├── services/
│   │   ├── maximoClient.ts
│   │   └── s2000mService.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── xmlParser.ts
│   └── server.ts
├── DEVELOPMENT_CONTEXT.md
├── package.json
├── PRESENTATION.md
└── tsconfig.json
```


---

*Update this file when completing goals, adding tests, or switching mocked parts to real integrations.*
