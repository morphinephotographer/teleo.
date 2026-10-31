# Wide desktop layout

Source `b69ca093b5140192c115422e7699a2db4b73e75a`; production `4f661b13-d9df-4d0e-9a19-0df86695a7cc`. Previous production `5f2a5474-3e3c-4a3c-aae1-30d7f2386149`.

At widths >=1440px with hover/fine pointer, Studio keeps the library visible independently of the narrow-layout disclosure state, hides its header trigger/close control, and places workspace modes in the sidebar before creation actions. The header wordmark text measures within 2px of the 230px sidebar width. Smaller and touch layouts retain header modes and disclosure controls. Current-script selection and reader behavior are retained.

Changed: `apps/web/src/LibraryPanel.tsx`, `apps/web/src/main.tsx`, `apps/web/src/style.css`, `tests/e2e/desktop-layout.spec.ts`, `playwright.desktop-layout.config.ts`.

Typecheck, lint, production build and Wrangler dry-run passed. Four focused desktop/tablet tests passed in Chromium/WebKit, covering wide layout, resize from collapsed library, mode activation, logo size and touch tablet/phone navigation. Ten existing mobile layout tests passed. Wide screenshot inspected. Older desktop layout snapshots were not regenerated or claimed to pass.
