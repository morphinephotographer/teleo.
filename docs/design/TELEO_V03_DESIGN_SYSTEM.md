# teleo. v0.3.1 design system

The reviewed implementation brief and annotated phone image supersede the preceding separate-preview Studio layout. This update retains the React/TS/Vite stack, portable script model, IndexedDB, existing intro and command engine. No dependency or native app is added.

## Tokens and primitives

White #FFFFFF, secondary #F5F5F7, ink #111111, border #E5E5E7, secondary text #73737A, reader #080809 / #F8F8FA. Blue is reserved for focus/current-text emphasis; green identifies a live connection. Controls use 14px radius, menus 20–22px, panels 22–28px, sheets 28–30px, with full capsules and true circles where appropriate. System sans-serif typography remains local/offline.

- Existing `Icon`, `IconButton`, `Segmented`, `Sheet` remain shared primitives.
- `Popover` in apps/web/src/menus.tsx owns native top-layer placement, collision handling, focus and keyboard navigation.
- `TeleoSelect` uses the same popover/listbox for every picker. A button combobox controls selected, disabled and localized options; selected items form an ink capsule. A real native select with styled trigger is the functional fallback when the Popover API is absent. This does not promise pixel-identical OS pickers or Firefox customizable-native-select support.
- `TeleoMenu` uses the same surface and positioning for application navigation and script actions, with real menuitems. Without the Popover API, action menus reuse the focus-contained native dialog Sheet; selectors fall back to native selects. API-absence emulation tests both paths.
- Labels/toggles/primary controls use 44px targets where feasible. Narrow-screen controls reorganize or scroll internally rather than becoming unusably small.

## Menus

White/dark inherited surface, thin border, quiet elevation, 6px inner padding, 44px options, clear pressed/hover/focus states, and 160ms opacity/transform reveal. Opening positions synchronously before paint; native top layer escapes ancestor overflow without escalating z-index. Menus remain inside their owning dialog in the DOM, preserving top-layer accessibility and inherited theme.

Positioning uses the anchor and current VisualViewport clamped to layout viewport dimensions, aligns within a 12px gutter, opens above when space below is insufficient, and bounds list height with internal scrolling. Resize/scroll listeners exist only while open. Native light-dismiss handles outside clicks; Escape closes and restores trigger focus. Arrow keys, Home/End, Enter/Space and type-ahead are supported. Reduced motion removes the reveal.

## Studio

At >=1180px, Studio has library/editor/integrated settings. Right tabs are Playback (localized compact label), Text and Appearance. The same settings render in the native dialog sheet on narrower screens or while reading. Playback speed/countdown, typography/alignment, mirror/focus/theme and real keyboard profile learning retain existing handlers. The old static preview column is replaced by functional settings. Plain-text editing is retained; no pretend formatting toolbar was added.

Creation selects the new document immediately while the previous write finishes in the existing serial autosave coordinator. Edit mode pauses without revoking the approved remote, allowing live text edits and script switches. The explicit Exit reader action still ends authorization. Phone commands can return the host to reading and are acknowledged after application to the same engine, guarded against stale socket epochs.

See TELEO_REMOTE_V03.md and the menu inventory/visual evidence in docs/audits/TELEO_V03_UI_AUDIT.md. Physical-device accessibility and Safari keyboard/chrome behavior require manual validation.
