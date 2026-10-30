# Library panel update — 2026-10-30

Only the web library panel was restyled. The workspace columns, editor, header,
reader, remote controls and settings retain their existing layout and styles.

## Result

- Dark rounded panel; adjacent light creation buttons; icon search field.
- All folders, unfilled folder rows with real counts, expandable indented
  documents, file icons, dates, dividers and document overflow menus.
- Separate pinned trash row above the pinned import and Open last buttons.
  Only the folder/document list scrolls.
- Trash uses the existing `deletedAt` field. Restore preserves content, folders,
  preferences and revisions. Permanent deletion requires explicit confirmation
  and refuses stale entries that another tab has restored or changed.
- TXT and JSON reuse the existing importer and validation. Open last uses the
  existing selected-document persistence and opens the editor; it is disabled
  when no document is available.
- Russian labels follow the handoff. English and Ukrainian labels and live
  locale switching are preserved.
- No Welcome block appears in the panel. Existing saved Welcome documents are
  normal library data; the prior demo restoration action remains available in
  the menu beside All folders.

## Reference and visual checks

The original 1024 × 1536 reference was inspected. Its bytes were copied unchanged
from the supplied ZIP to
`design-references/04_APPROVED_LIBRARY_PANEL.png`; SHA-256 comparison confirmed
an identical copy. The runtime uses actual data, never the illustrative examples.

The running app was inspected at 1024 × 1536 and on mobile. The panel adapts the
reference to the existing sidebar widths; expanding the desktop sidebar to the
illustration's width would change the editor layout. Screenshots:

- `docs/screenshots/library-panel-ru-1024.png`
- `docs/screenshots/library-panel-ru-375.png`

A separate seeded 1440 × 1000 browser session captured the header and editor
before and after implementation. Their bounding boxes and PNG bytes matched
exactly in the light theme. These checks used disposable test documents.

## Changed implementation files

- `apps/web/src/LibraryPanel.tsx`: isolated panel and its menus.
- `apps/web/src/style.css`: sidebar-scoped layout, palette and responsive rules.
- `apps/web/src/main.tsx`: panel integration, existing document selection,
  trash state and confirmation handling.
- `apps/web/src/storage.ts`: deleted-document listing and guarded permanent
  deletion; no database schema or portable data-format changes.
- `apps/web/src/i18n.ts`: new strings in all three supported locales.
- `apps/web/src/ui.tsx`: additional icons used by the panel.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: passed.
- `npm test`: 172 tests passed across 17 files, including the real relay timer
  and reconnect checks.
- `npx playwright test --config playwright.library.config.ts`: 14 passed in
  Chromium and WebKit. Covers reference order, 1440/1024/375/320 pixel widths,
  fixed footer/trash with 45 documents, all locales, locale switching, keyboard
  menus, search, folder CRUD, opening/creation, restore, permanent deletion and
  cancellation, both import formats and invalid JSON, last-document persistence
  and empty-library behavior.
- Existing `reading-polish.spec.ts` Welcome localization/edit/deletion/restoration
  and chosen-document deletion scenarios: passed in Chromium and WebKit after
  adapting their selectors to the new overflow menus.
- Storage tests cover preservation of revisions/preferences, scoped permanent
  deletion and protection against another tab restoring a trash entry.

Browser checks use isolated sessions and synthetic documents. Physical-device
testing was not performed. Historical release-specific browser suites were not
run in full.


## Publication — 2026-10-30

Published after the owner's explicit request to publish. Production is live at
https://teleo.cc/studio from source
`7d3089ad06b433e56d92b686ab5d9a3f5e4c7047`.

- Production Worker version: `52224e49-4a54-452a-acaf-d512ae9182a7`.
- Cloudflare deployment: `cdc7d097-5edd-47a2-8319-1f47abeb464b`;
  readback confirms **100% traffic**.
- Staging Worker version: `83b1dd9f-6e49-485a-bfa8-49925534d89f`.
- Previous production version for rollback:
  `c717575e-f7f4-4a7f-a04b-055140ab8fc3` (source `3170960`).

The existing interactive `npm run deploy:production` workflow ran from the clean
source commit. Production build and Cloudflare dry-run passed. Domain routes,
Durable Object namespaces, storage schemas and dependencies were unchanged.

Public validation:

- Staging library scenarios: **14/14**, Chromium and WebKit.
- Production library scenarios: **14/14**, Chromium and WebKit.
- Production routes, HTTPS, security headers, Origin checks, www redirect and
  exact source/version identity: **2/2**, Chromium and WebKit.
- HTML, CSS, JavaScript and service-worker raw HTTPS hashes: **4/4** match the
  checked local build on staging and production.
- Browser CSS/JS/service-worker bytes match too. Cloudflare adds a beacon script
  to production browser HTML; removing only that precisely identified insertion
  reproduces the original HTML bytes. The initial raw browser HTML hash mismatch
  was investigated rather than reported as an exact match. No Cloudflare
  analytics or CSP settings were changed.

Public screenshots were inspected:
`docs/screenshots/library-panel-live-ru-1024.png` and
`docs/screenshots/library-panel-live-ru-375.png`.
Release identity, traffic and asset checks are retained under
`docs/audits/evidence/library-panel-publication/`.

For rollback, use the existing `wrangler rollback` workflow with the previous
production version above, without deleting namespaces or stored data. No rollback
was needed. A subsequent documentation commit does not change the published
application source. No GitHub push was performed.
