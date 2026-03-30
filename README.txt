
HM Live Khakhara Website

GitHub Pages setup:
1) Push all files in this folder to your GitHub repo.
2) Enable GitHub Pages in repository settings.

Catalog source:
- Website reads products from `catalog.json`.
- Update flavours by editing `catalog.json` directly, or use local sync server below.

Local WhatsApp/Meta catalog sync server:
1) Copy `.env.example` to `.env` and fill:
   - META_ACCESS_TOKEN
   - META_CATALOG_ID
2) Start server:
   - npm run start:catalog-sync
3) Trigger sync:
   - Dry run:  GET  http://localhost:8787/sync?dryRun=1
   - Sync + git commit: POST http://localhost:8787/sync
   - Sync + commit + push: POST http://localhost:8787/sync?push=1

Notes:
- Requires Node 18+.
- Server commits only `catalog.json` when content changes.
- If you only have a `wa.me/c/...` link, get `META_CATALOG_ID` from Meta Business Manager.
