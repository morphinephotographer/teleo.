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

## Follow-up: row actions and folder disclosure

The owner's screenshots exposed two incorrect interactions in the first release:
the All folders arrow opened the demo menu, and row actions used overflow menus.
The correction supersedes those details above:

- The All folders arrow now collapses/expands the folder group. Collapsing clears
  the folder filter and leaves documents searchable and visible. Clicking the
  All folders label restores the expanded group and all documents.
- The demo menu and its panel-only restoration action are removed. Saved Welcome
  documents and the existing automatic-demo preference are preserved; deleted
  documents can be restored from Trash without overwriting their edited text.
- Hovering the right edge of a folder or document reveals direct Rename and
  Trash buttons, without shifting the row. Keyboard focus reveals the same
  actions. Touch devices show the buttons without requiring hover.
- Script renaming uses the existing save/conflict/revision behavior and preserves
  draft content, document identity, preferences and the current selection.
- Local validation: **20/20** library browser scenarios, **4/4** existing
  localization/deletion/restoration browser scenarios, **46/46** focused unit
  tests, typecheck, lint, production build/dry-run and diff checks passed.
- Header/editor screenshots and geometry remain identical to the original
  baseline. No styles outside the library were changed.


The correction is published at https://teleo.cc/studio from
`656eb9c4cacdc9495b2b7ad2b2d7103717cfe787`, production Worker version
`77b38620-e412-4b94-ab91-2521963e4ffa`, deployment
`acee7259-44c5-490f-a1d7-d9f4e70864b6` at **100% traffic**.
Staging version: `a3b933f4-f888-4036-87fb-c91bb45eeb1b`.

Final public validation: **20/20** library scenarios on staging, **20/20** on
production, **2/2** production route/security/identity checks, and **4/4** raw HTTPS
asset hashes on each origin. Public browser screenshot crops of both sets of
right-edge buttons were inspected and retained under `docs/screenshots/` as
`library-script-actions-live.png` and `library-folder-actions-live.png`.
Evidence is in `docs/audits/evidence/library-panel-fixes/`.

The preceding production version for rollback is
`52224e49-4a54-452a-acaf-d512ae9182a7`. No storage migration, dependency, domain,
namespace, analytics-setting change or GitHub push was performed. Physical device
behavior remains unverified; touch access was checked in browser emulation.

## Follow-up: six visual refinements

The owner's next request updates six specific details:

1. Created folders use an ellipsis instead of a disclosure arrow. Hovering its
   right-edge area reveals Rename and Trash; overlapping metadata hides while
   the actions are visible. The All folders disclosure remains unchanged.
2. Action groups and hovered action buttons have transparent backgrounds.
3. Selected documents have no filled row background. A small circular marker
   appears to the left of the file icon; selection still uses `aria-current`.
4. Only the outer, duplicate border around Reader alignment is removed. The
   shared alignment component retains its single border and all three actions.
5. The Connect phone button is removed from Reader's top row. The Editor phone
   control and pairing/session logic remain available.
6. The two Appearance symbols in Settings have circular 44px backgrounds.

Local Chromium/WebKit validation: **24/24** scenarios passed, including live
play/pause, center alignment, mobile Reader, selection-marker movement,
transparent hover states, ellipsis/actions, all previous library operations,
keyboard and touch. Typecheck, lint, production build/dry-run and diff checks
passed. Cropped screenshots of the changed controls were inspected.


Published refinement source: `873a480fa5dcd1d191ea76cb72b49c459eeffe50`.
Production Worker: `9f96a6e5-2c9f-4e59-b000-066413a4b292`, deployment
`8f61bd0c-f20d-4f4b-ae32-13090da38769`, confirmed **100% traffic**.
Staging Worker: `fcede12f-11f0-41e9-85b0-e201332beea9`.
Previous production version for rollback: `77b38620-e412-4b94-ab91-2521963e4ffa`.

Public validation: **24/24** library/reader/settings scenarios on staging and
**24/24** on production in Chromium/WebKit; **2/2** production
route/security/identity checks; **4/4** raw HTTPS asset hashes per origin match
local build files. Updated control screenshots were inspected and saved as
`docs/screenshots/refined-*-live.png`. Evidence is under
`docs/audits/evidence/library-visual-refinements/`. No storage, protocol,
dependency, namespace or domain configuration changes were made.
