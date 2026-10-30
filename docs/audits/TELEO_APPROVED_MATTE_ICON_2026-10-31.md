# Approved larger matte icon

Owner selected the previous image, `output/imagegen/teleo-white-matte-larger-1024.png`,
not the subsequent largest variant. Its exact PNG bytes are now the 1024px website
icon. SHA-256: `3000b0ba67a097cb30b179b0941e2491d283864c8b31667a3732968ed245f135`.
Smaller 32/192/256/512px images use standard sips resizing. The opaque full-bleed
icons are declared `any maskable`; touch icon and favicon use the same artwork.
App id/start URL remain `/studio`. HTML/metadata/assets only; editor CSS and JS
bundle hashes remain unchanged. Original ICNS files remain unchanged.

Published source: `baf446cb3602c2e3fd8168a0ad05ecb0729ef7ee`.
Production version: `0e17f9ca-0a54-481d-8d04-63515c3628c2`.
Rollback target: `a6e63bfa-75a9-4bf3-81da-b9cc56a7c9d0`.

Passed typecheck, lint, five asset integrity tests, production build/dry-run,
six local and six production Chromium/WebKit metadata/settings scenarios in
EN/UK/RU. Chromium parsed manifest reports no errors. All four core release
assets match the local build and exact release identity. Production 1024px PNG
hash matches the selected source above.

Real Safari Add to Dock on https://teleo.cc/studio automatically displayed the
matte artwork after its temporary loading placeholder. No manual file picker
was used. The sheet was canceled, the test tab closed, and no app was installed
or replaced. This supersedes the previous glossy default.
