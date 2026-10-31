# Wide desktop layout

Latest sizing refinement: source `48a372d38fe0b5bd7cef3c2a7032bf5a27ef58bf`, production `e859711e-aaa1-4933-bd77-3101d80a2f56`. Wide desktop header is fixed to 52px including padding; wordmark is 44px with 44px line-height within the existing grid column. Logo growth does not change header or column sizing. Four desktop/tablet Chromium/WebKit tests, typecheck, lint and production build passed. Narrow/touch layouts remain outside the media rule.

Follow-up supersedes the header arrangement below: source `e489ee5abbc5f16c378211e74ea9a37dfd1cf268`, production `78355d10-043f-45fb-b453-bf0e30c5c055`. Current-script dropdown is hidden on wide desktop; workspace modes return to the header with their left edge aligned to the editor; wordmark returns to its original 30px size and header height. Library stays visible without disclosure/close controls. Four updated Chromium/WebKit desktop/tablet tests, typecheck, lint and production build passed. Narrow/touch layout retains its original header elements.

Source `b69ca093b5140192c115422e7699a2db4b73e75a`; production `4f661b13-d9df-4d0e-9a19-0df86695a7cc`. Previous production `5f2a5474-3e3c-4a3c-aae1-30d7f2386149`.

At widths >=1440px with hover/fine pointer, Studio keeps the library visible independently of the narrow-layout disclosure state, hides its header trigger/close control, and places workspace modes in the sidebar before creation actions. The header wordmark text measures within 2px of the 230px sidebar width. Smaller and touch layouts retain header modes and disclosure controls. Current-script selection and reader behavior are retained.

Changed: `apps/web/src/LibraryPanel.tsx`, `apps/web/src/main.tsx`, `apps/web/src/style.css`, `tests/e2e/desktop-layout.spec.ts`, `playwright.desktop-layout.config.ts`.

Typecheck, lint, production build and Wrangler dry-run passed. Four focused desktop/tablet tests passed in Chromium/WebKit, covering wide layout, resize from collapsed library, mode activation, logo size and touch tablet/phone navigation. Ten existing mobile layout tests passed. Wide screenshot inspected. Older desktop layout snapshots were not regenerated or claimed to pass.
