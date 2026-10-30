# Reader actions and settings — 2026-10-30

Open last now enters the paused Reader, rather than reselecting the document
already visible in Editor. `teleo.lastReadScript` records the most recently read
document separately from Editor selection. Its existing saved position is reused.
Without reading history, the current document is used; a missing/deleted document
falls back to an available one. Empty libraries disable the action. Drafts must
save successfully before the action refreshes the saved library.

Browser Reader keys now work independently of optional hardware profiles and
the hardware-enable checkbox:

- Space toggles play/pause.
- Left/right move backward/forward by the article's actual rendered line height.
- Up/down increase/decrease speed with existing bounds and persistence.

Typing, menus, dialogs, composition and Ctrl/Alt/Meta combinations remain guarded.
Native repeats are consumed without repeated toggling or browser-page scrolling.
R400-specific Period/PageUp/PageDown/F5 behavior is preserved.

Only Reading appearance and Interface theme change from submenus to direct
clicks. Reading appearance toggles dark/light; Interface cycles Auto → Light →
Dark → Auto. Language selection, hardware configuration and playback sliders
retain their previous interactions, as clarified by the owner. Main Settings
uses available viewport height instead of the shared 400px menu cap. Compact
portrait/landscape layouts keep the default settings and all their text visible
without internal scrolling; advanced hardware configuration is unchanged.

Implementation: `main.tsx`, `LibraryPanel.tsx`, `reader-keyboard.ts`, `menus.tsx`
and scoped settings CSS. No database schema, portable data format, relay protocol
or dependency changes.

Local validation:

- 34 Chromium/WebKit browser scenarios passed, including saved-position resume,
  fallback after deletion, keyboard behavior across Standard/R400/Custom with
  hardware keys disabled, settings at 1440/375/320/844px, and prior library flows.
- Six existing localization/settings/playback/deletion browser scenarios passed.
- 88 focused unit tests passed, including key safety and unchanged R400 behavior.
- Final Open last/empty-library recheck: four passed.
- Typecheck, lint, production build/dry-run and diff checks passed.
- Portrait and landscape settings screenshots were inspected.


Initial staging validation found an existing first-load race: programmatic TXT
import could run before library initialization completed, then the initial empty
snapshot replaced the optimistic document list. Creation/import controls now
wait for library readiness (including the empty-state creation button); `add`
also refuses pre-initialization mutations. The file-input test now waits for the
same enabled state a user needs to open the picker. The importer and validation
formats are unchanged. Initial staging results were 33/34, not a release pass.


## Verified publication

Live at https://teleo.cc/studio from final source
`3cc58bc5430c0c483b3e9bf891e906ac05b1f99d` (reader behavior `37b5a0e` plus
initialization guard). Production Worker version:
`a087690b-b83e-464c-ab24-9ca5e171c7e7`; Cloudflare readback confirms **100% traffic**.
Final staging version: `4338ebe3-906b-481b-b2d4-a87c66683a09`.

- Final staging browser cohort: **34/34** passed.
- Production browser cohort: **34/34** passed in Chromium/WebKit.
- Production routes, HTTPS, Origin/security, redirect and exact identity: **2/2**.
- Raw HTML/CSS/JS/service-worker hashes: **4/4** match on each origin. The existing
  Cloudflare browser HTML insertion is checked separately from raw source bytes.
- Import/creation/resume readiness recheck before publication: **6/6** passed.

Production Settings screenshots were saved as
`docs/screenshots/reader-actions-settings-*-live.png`; the compact portrait view
was inspected. Release evidence is in
`docs/audits/evidence/reader-actions-publication/`.

Previous production version for rollback:
`9f96a6e5-2c9f-4e59-b000-066413a4b292`. No rollback, GitHub push, data migration,
namespace/domain mutation or dependency change was performed. Physical hardware
and real mobile-device testing remain separate from browser emulation.
