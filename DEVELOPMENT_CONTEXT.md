# Development Context

Long-term memory for AI and developers. Update this file as the project evolves.

---

## 1. Current Project State

**Škoda Transportation IPS Integration** — Proof of Concept for ASD S-Series (S1000D & S2000M) integration with IBM Maximo 9 (MAS).

- **Phase**: MVP / PoC. Middleware provides documentation linking (S1000D) and material provisioning (S2000M) flows.
- **Backend**: Node.js + Express + TypeScript, single server entry point (`src/server.ts`).
- **APIs**: REST under `/api/v1/s1000d` and `/api/v1/s2000m`.
- **Viewer**: Static mock IETP viewer at `/viewer` (served from `mocks/viewer/`).
- **Automation**: Jython script for Maximo (Object Launch Point on WORKORDER) to append S1000D viewer URL to WO long description; not yet wired to this service (uses hardcoded base URL).
- **Deployment target**: Docker / Red Hat OpenShift (MAS 9).

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
- **Mock Viewer**: `GET /viewer/index.html?dmc=...&model=...` shows DMC/model in a simple card UI; no real CSDB or IETP.
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

**2026-02-11** — af701f2 Initial commit: Škoda IPS-Maximo Integration MVP



*(Run `node scripts/update-context.js` to refresh.)*

---

## 6. Current Goals

- Complete S1000D/S2000M PoC for demo (link generation + mock viewer + S2000M import flow).
- Optionally wire S1000D link to `maximoClient.getWorkOrderByNum()` so one code path supports MOCK and REAL.
- Prepare for Škoda DEV access: VPN, Maximo admin, real S1000D CSDB and Maximo API integration.
- (Roadmap) Real S1000D CSDB integration; expand S3000L (Logistics Support Analysis).

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
