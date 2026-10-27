# Teleo. — Welcome onboarding (v0.8, not deployed)

## Copy and scope

The title is exactly **Welcome** in en/uk/ru. The owner's explicit Welcome request, supplied Russian text and subsequent instruction to spell **Teleo.** with a capital T take precedence over the older translated titles and shorter copy in the pasted v0.8 brief. The approved Russian wording is bundled with natural English and Ukrainian equivalents in `apps/web/src/welcome.ts`; paragraph breaks make paragraph navigation useful. No runtime translation or external service is used.

Existing interface branding, layouts, design tokens, playback, remote and pairing are unchanged. The existing Settings control now works with an empty library and contains one compact, collapsible **Getting started** section with the required preference and restore/open action. No additional gear, onboarding popup or new screen. The baseline repository did not yet contain automatic demo creation or demo preferences; this implements those required paths.

## Genuine first use and migration

IndexedDB `teleo` version 2 adds only the `onboarding` store; existing script, revision and folder stores and records are preserved. Upgrading **any v1 database**, including an empty one, marks onboarding handled, so returning users are not given a new script.

For a newly created database, automatic initialization occurs only on Studio entry, when all conditions hold:

- Onboarding has not been handled.
- Automatic creation is enabled.
- There are no scripts (including soft-deleted records), revisions or folders.
- There are no recovered drafts or pre-existing workspace settings/history hints.

The UI locale is taken from the existing preference/detection system immediately before initialization. Locale and the demo preference alone are not returning-workspace hints. If storage history cannot be inspected safely, automatic insertion is conservatively skipped; manual restoration remains available.

The handled marker and script insertion commit in **one read/write transaction** covering scripts, revisions, folders and onboarding. Initialization is serialized across tabs and normal writes. The initial demo has a fixed UUID; `add`, not `put`, prevents overwriting a collision. A handled marker persists even when creation was skipped or disabled. Repeated launches, reloads, locale changes and enabling the preference do not reset it.

Old open tabs may hold v1 connections and block the upgrade. This is reported with a localized instruction to close older Teleo. tabs and reload; no data is deleted and no other browser tab is forcibly closed. New connections release themselves on future version-change events. Unit coverage includes both blocked migration and a later non-destructive upgrade.

## Preferences, edits and selection

The existing settings-storage convention is retained: `teleo.demo.auto` in localStorage, mirrored in onboarding metadata. The checkbox updates immediately, stores the choice synchronously for immediate reload, and persists the database copy. New installs default to enabled. Turning it off does not delete any content; turning it on does not immediately create or select anything. A previously handled or deleted sample stays handled.

`teleo.selectedScript` preserves the selected script across reloads, with the previous first-script fallback when no valid selection exists. Reading-position keys and script playback preferences are unchanged. No saved script is renamed, translated or replaced when UI language changes. An existing script titled Welcome is user content unless its stable ID belongs to onboarding metadata.

## Explicit restoration

The explicit action works with automatic creation disabled and with a completely empty library. It waits for pending edits to be saved before looking up a sample.

- If a live, unmodified sample already exists, the action offers **Open Welcome**. It opens that saved script, including its existing language and preferences; it does not silently translate it or create another copy.
- If none exists, **Restore demo script** creates a fresh Welcome in the current UI language, with a fresh UUID, then selects it after the explicit action.
- Edited or deleted samples remain untouched. Their stable IDs and original content baselines are retained in onboarding metadata. Edited copies can coexist with one fresh restored sample; repeated or simultaneous restoration reuses the unmodified sample.
- Changes to typography alone are preserved when opening an existing sample, rather than resetting its preferences.

Restoration merges only its selected/new record into UI state; it does not replace another local edit with a fetched library snapshot. Script titles are never used alone to identify demos.

## Verification

- New storage tests: initial en/uk/ru, exact title/content, serialized concurrent initialization/restoration, existing user content, old empty v1 databases, blocked upgrade, future version changes, existing workspace/recovery evidence, disabled preference, delete/no recreation, edited samples and formatting preservation.
- New browser suite: fresh launches in three locales, reload and manual locale selection, preserving edited text, simultaneous tabs, returning selection, disabling/enabling without injection, deletion, restore with auto disabled, current-locale restoration, preservation of modified content, playback and paragraph navigation; actual old v1 empty/populated libraries and reading-position preservation.
- Browser coverage: desktop Chromium and iPhone-profile WebKit. This is emulation, not a physical iPhone claim.
- Legacy browser scenarios explicitly disable demo auto-creation in their isolated fixtures to preserve their intended empty-workspace setup; the new onboarding suite uses genuine fresh storage. No test-only application branch is added.
- Screenshots: `docs/screenshots/welcome-*-{en,uk,ru}-editor.png`, `welcome-*-reader.png`, `welcome-*-settings-empty.png`. Editor, reader and settings images inspected.

Initial local implementation gates PASS (2026-10-27; before the comprehensive audit release):

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; original CSS asset hash unchanged |
| `npm test` | **96/96**, 10 files, 153.35s; includes real relay/TTL integration |
| `npx vitest run tests/welcome.test.ts` | **14/14**, including migration/concurrency and enabled-preference deletion checks |
| `npx playwright test --config playwright.welcome.config.ts` | **18/18**, 14.7s; desktop Chromium + iPhone-profile WebKit |
| `npm run test:e2e` | **174/174**, 2.8m; legacy regressions and onboarding on desktop/mobile |
| `npx playwright test --config playwright.approved.config.ts` | **32/32**, 42.7s; existing Chromium/WebKit UI, pairing, preview and alignment |

The existing image baselines required no changes. Earlier screenshots regenerated by regression tests were restored; only ten new Welcome editor/reader/settings captures are retained. Deliberate network-failure scenarios can produce development proxy Event logs; all final browser assertions passed. No production checks or deployments were run during that initial local-only implementation. Public release verification follows below.

## Limitations and release status

Clearing all site data intentionally removes both content and onboarding history; the browser then behaves as a new installation. Clearing only the database while retaining workspace hints conservatively suppresses auto-creation. A legacy database held open by older application code must be released by closing that older tab; this feature never forces it closed.

This feature is now published on https://teleo.cc/studio as part of **v1.0.2**, deployed source `ed6df817f6f53dae6ad266ee62374357a61239ef`. The owner explicitly authorized this production release. Welcome passed **18/18** public staging and **18/18** public production scenarios; total release verification passed 50 staging and 62 production checks. See [audit verification and deployment evidence](../audits/TELEO_FIX_VERIFICATION.md). Manual restoration that opens an existing untouched sample keeps its saved language, while a newly created restoration uses the current UI language.
