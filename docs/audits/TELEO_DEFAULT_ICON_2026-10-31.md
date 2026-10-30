# White glossy installation default — 2026-10-31

Supersedes the selectable/manual installation UI described in
`TELEO_MAC_INSTALL_2026-10-31.md`, following the owner's updated request.

The Settings Install button and its dialog, state hook, styles and translated
copy were removed. Editor, library, reader and settings implementation/styles
are restored to their pre-picker versions. The old `teleo.macIcon` preference
is left untouched but no longer read, so any previous selection cannot override
the default. No document, folder, reading-position or other preference is changed.

HTML now declares a static `/manifest.webmanifest`, white glossy 1024px touch
icon and white glossy 32px favicon from the initial response, before JavaScript.
The manifest declares only white glossy icons, retaining the same `/studio` id,
start URL, app name and scope. Existing ICNS/PNG assets and historical manifest
URLs remain available; they are no longer selected by the website.

The supplied `~/Downloads/teleo_icons_icns/teleo_white_glossy.icns`
matches the retained original byte-for-byte (SHA-256
`c6d240e552c36876739231c0aa5d7c04057d0093637c4737c5b5e6b49508bf04`).
32/256/512/1024px PNGs are the exact embedded representations. A standard `sips`
resize adds 192px for Chromium installation metadata, preserving the source
shape, transparency and colors without redrawing. Reproduction remains in
`scripts/prepare-mac-icons.py`; no dependencies were added.

Browser metadata follows [WebKit icon guidance](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
and [Chromium manifest guidance](https://web.dev/articles/add-manifest).
The original rounded transparent image uses `purpose: any`, without claiming
it is a full-bleed maskable asset.

Native **Safari 27.2** was checked at `http://localhost:5173/studio`, an origin
not used for the previous picker test. File → Add to Dock automatically showed
the white glossy icon. The custom icon picker was never used. The sheet was
canceled and the test tab closed; no native app was installed/replaced/edited.
The local screenshot is retained in ignored
`test-results/default-icon-native/safari-auto-white-glossy-local.png`.

Validation: typecheck, ESLint, 58 focused unit tests, six EN/UK/RU Chromium/WebKit
default-icon/Settings scenarios, 34 existing library/reader/settings scenarios,
production build and Wrangler dry-run. Settings fit all four tested sizes with
no new controls or scrolling. Chromium's actual parsed app manifest has no
errors and matches the shipped manifest; a full OS-level Chrome/Edge installation
was not performed. An initial dev-server response-body fixture race was fixed
by fetching the HTML after navigation rather than reusing an invalidated response.

Previous production rollback target: `ab9beb76-203a-4321-95bb-fe94d5b52eae`.
