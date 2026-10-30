# Mac web app icon selection — 2026-10-31

Settings now contains a compact Install entry alongside its existing heading.
It opens a separate dialog with four labeled previews, a visible selected state,
PNG download, original ICNS download and manual Safari instructions in EN/UK/RU.
The choice uses only `teleo.macIcon`, independently of interface/reading themes.
The main Settings menu retains its previous controls and fits without scrolling.

## Installation behavior and native Safari evidence

Supported flow: Settings → Install on Mac → choose a variant → Download icon PNG.
In Safari on Mac choose File → Add to Dock, click the icon, select that downloaded
PNG and then Add. The website does not install an app or replace an existing app.
It does not promise to update the icon of an already installed application.

Real **Safari 27.2 on this Mac** was tested against local `/studio`. After selecting
white glossy on the page, the native Add to Dock sheet retained the initial black
matte icon. Dynamic manifest/touch-icon metadata is therefore **not a reliable
automatic selection mechanism** in the tested setup, and the UI explicitly gives
the manual file-selection flow. This conclusion is from native Safari, not
Playwright WebKit. It does not claim universal behavior across Safari releases.

Clicking the native icon picker and choosing the exact 1024px white glossy PNG
successfully changed the real Add to Dock preview to white glossy. See
[native preview](evidence/mac-install/safari-manual-white-glossy.png).
The sheet was canceled and the test tab closed. Add was never clicked; no app
was installed, replaced or edited. Browser tests separately verify all eight
downloads byte-for-byte against the source assets.

All four manifests retain `id: /studio`, `start_url: /studio`, scope `/` and the
same app name. Each describes one variant at available native sizes, with `any`
purpose to preserve transparent corners. The page updates manifest/touch-icon
links as best-effort metadata only. Multiple icons/manifest links are not treated
as a native selection menu or evidence of automatic Safari support.

## Assets and preservation

The four ICNS originals from `teleo_icons_icns.zip` are unchanged. They already
contain 32/128/256/512/1024px PNG representations, so preparation extracts those
exact bytes without scaling, drawing, color conversion or alpha changes.
`design-references/mac-icons-provenance.json` records SHA-256 for originals and
every PNG. Reproduce with:

```sh
python3 scripts/prepare-mac-icons.py /path/to/teleo_icons_icns.zip
```

No dependencies, database schemas, data formats, documents, folders, reader
positions, relay behavior or existing settings interactions were changed.

## Validation

- Typecheck and ESLint passed.
- 58 focused unit tests passed, including five asset/identity/fallback tests.
- 12 installation browser scenarios passed in Chromium and WebKit: all four
  previews/downloads/persisted selections in EN/UK/RU, theme independence,
  manifest links, invalid-selection fallback, keyboard arrows/Home/End,
  Tab/Shift+Tab containment, Escape and focus restoration, data preservation.
- Main Settings and installation dialog checked in each language at 1440×900,
  375×667, 320×568 and 844×390. The separate dialog scrolls where needed; main
  Settings does not. [Small screen](evidence/mac-install/install-320x568.png),
  [desktop](evidence/mac-install/install-desktop.png).
- 34 existing library/reader/settings regression scenarios passed in both engines.
- Production build and Wrangler dry-run passed.
- Native Safari manual PNG preview passed; automatic selection was unreliable.

Early test runs exposed a locale-fixture initialization mistake and waiting for
a hidden mobile library; both test fixtures were corrected. Actual browser
differences also exposed WebKit centering and default Tab link skipping. The
dialog now centers without transforms/animation and explicitly includes download
links in its local Tab order. Final results above are after those fixes.

## Changed files

- `apps/web/src/main.tsx`: compact Settings entry and dialog integration.
- `apps/web/src/MacInstallSheet.tsx`: preview, downloads, manual guide, keyboard.
- `apps/web/src/mac-icons.ts`: local choice, validation, metadata links.
- `apps/web/src/i18n.ts`: all new EN/UK/RU copy.
- `apps/web/src/style.css`: scoped entry/dialog styles and compact header layout.
- `apps/web/index.html`: default manifest, touch icon and favicon.
- `apps/web/public/mac-icons/`: four unchanged ICNS, twenty exact PNGs, four manifests.
- `scripts/prepare-mac-icons.py`, `design-references/mac-icons-provenance.json`:
  repeatable extraction and hashes.
- `tests/mac-icons.test.ts`, `tests/e2e/mac-install.spec.ts`,
  `playwright.mac-install.config.ts`: integrity and browser validation.
- This report, three evidence screenshots and release verification records.

Previous production version for rollback: `a087690b-b83e-464c-ab24-9ca5e171c7e7`.

## Verified publication

Live at https://teleo.cc/studio from source
`61e5b37fe9d6c4057fd41352d146cfd973bf7119`.
Production Worker version `ab9beb76-203a-4321-95bb-fe94d5b52eae`, with 100% traffic
confirmed by Wrangler deployment readback and exact commit/version headers on
normal public browser responses. Staging version:
`1eea7f51-fe3f-4d21-af2d-f69044987163`.

- Installation cohort: **12/12 staging**, **12/12 production**, Chromium/WebKit.
- Production routes, HTTPS, strict Origin, security, redirects and identity: **2/2**.
- On each origin, all **28 icon files** match local SHA-256 byte-for-byte.
- On each origin, all **four HTML/CSS/JS/SW files** match raw HTTPS source bytes.
  The existing Cloudflare browser HTML insertion was identified separately.
- Verification records are in `evidence/mac-install/*assets.json` and
  `production-deployment.txt`.

Native Safari validation above used the local origin. Public browser checks and
asset hashes verify the deployed feature and files; they do not extend the native
test claim to every Safari/macOS version. No installed Mac app was modified.
No GitHub push, data migration, dependency, domain or namespace change was made.
