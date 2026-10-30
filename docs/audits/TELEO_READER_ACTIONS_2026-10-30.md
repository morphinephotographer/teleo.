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

Typing, menus, dialogs, composition and modifier-key combinations remain guarded.
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
