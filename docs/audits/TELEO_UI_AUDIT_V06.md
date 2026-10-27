# TELEO v0.6 UI audit — 2026-10-27

## Scope and baseline

Read the complete TELEO_CODEX_V06_FINAL.md, TELEO_V06_REVIEW_AND_CONFLICT_CHECK.md (the supplied name of REVIEW_AND_CONFLICT_CHECK.md), and README.md before implementation. Started at clean da2dca4 on codex/teleo-v031-studio-remote; feature branch codex/teleo-v06-approved-ui. Baseline production build PASS; full unit/relay 64/64 PASS (152.59 seconds); existing browser regression 86/86 PASS (1.9 minutes). No owner data, native clients, storage schema, production or public staging was changed.

The authoritative two-state image was supplied later in chat as Screenshot 2026-10-27 at 01.57.57.png and is preserved as design-references/01_APPROVED_REMOTE_CLOSED_AND_QUICK_PANEL.png. It was visually inspected. Earlier wings/three-tab/light remote concepts are superseded. The separately named advanced-settings reference and bug-references images were not present at initial inspection; missing inputs will be recorded rather than claiming visual comparison against them.

## Menu and control inventory

| Component and placement | Change / evidence |
| --- | --- |
| Studio/help/privacy language; immersive language | Shared TeleoSelect with centered SVG chevron, localized choices, keyboard/focus/collision tests |
| Current script selector in Studio header | Same picker, live selected title/body, selection kept |
| Library folder filter | Same picker; new/rename/delete folder dialogs |
| Assigned script folder under editor | Same picker, retained data association and transactional folder removal |
| Countdown in integrated settings/narrow sheet | Same picker and actual pre-start countdown semantics |
| Physical remote profile and custom learned action | Same picker; retained HID learning/mapping tests |
| Global ellipsis navigation | TeleoMenu; Help/Privacy remain navigation destinations, absent from settings |
| Text actions | Dropdown removed by request; five inline actions in one locally scrollable toolbar |
| Import | One centered file input label, TXT/JSON validation retained; no imaginary import menu |
| Search | Existing local filtering/results retained; same radius/focus tokens |
| Settings tabs, alignment, appearance/interface mode | Existing Segmented primitive and engine preference handlers |
| Native unsupported-Popover fallback | Styled native select and dialog action menu retained/tested; OS popup pixels not controlled |
| Creation/rename folder, delete folder/script | ActionDialog + native modal focus trap, neutral actions, validation, keyboard, explicit focus restoration |
| Script creation/rename | Existing one-click creation and inline title editing; no unnecessary prompt |
| QR / connection management | Separate Sheet; X/Escape manual close; genuine authenticated approved connected event auto-dismisses |
| Remote quick typography | Only one bottom sliders entry; nonmodal dark sheet, three host-backed sliders, close/Escape |
| Remote advanced settings | Only top-right gear; separate dark Sheet, countdown, text/permission, mirrors/guide, fullscreen fallback, language, connection and capability-based feedback |
| Remote expanded text | Optional subordinate reading sheet, no primary Text tab |
| Revision history | Existing bounded editor panel, restore preserved |

## Defects found during implementation

- Original textual chevron glyph had inconsistent baseline; replaced with equal SVG grid.
- Original browser prompt/confirm flows replaced only where confirmation or a name is needed.
- Conditional modal unmount did not reliably return focus; Sheet cleanup now closes before restoring a connected trigger, and Escape is handled explicitly.
- Quick typography sheet initially covered the lower Play circle; opening now reserves room and covers only secondary controls in portrait.
- Fast controls plus redundant metadata/preview frames could reach the existing 20/sec relay limit. Removed duplicate post-ACK broadcasts and unchanged paused positions; changed metadata is bounded to 2Hz. The security limit was not relaxed.
- Previous tests assumed permanently visible pairing UI and old light/tabs/wings layout; adapted those expectations while keeping underlying transport, private preview, storage, import/export, HID and reconnect assertions.

## Final executed verification

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript (web + both Worker configs) | PASS | npm run typecheck |
| ESLint | PASS | npm run lint |
| Production staging build + Worker dry-run | PASS | npm run staging:check; no publication |
| Full unit/relay | PASS — 70/70, seven files, 153.12s | Includes 21 real relay cases, schema/bounds/compatibility/time arithmetic and existing auth/expiry/replay/hibernation/storage tests |
| Full browser regression after final application fixes | PASS — 102/102, 2.1 minutes | Both projects; no snapshot updates |
| Detailed placement/viewport capture cohort | PASS — 10/10, 27.7s | Existing menu/preview + approved phone tests, added actual placement screenshots |
| Direct phone scrolling/toolbar fix verification | PASS — 2/2, 12.3s | Internal settings scroll with Close in viewport; all toolbar actions in a single row and reachable |
| Additional playing seek/panel/host keyboard assertions | PASS — 6/6, 25.6s | Each locale in both projects; no snapshot updates, same final application code |
| Visual goldens | PASS | Three language surfaces + four closed/quick phone images, compared without updates |
| Native Apple build / real Bluetooth hardware | NOT RUN | Native sources unchanged; no physical accessory supplied |
| Physical iPhone Safari, Taptic, VoiceOver, real camera QR scan | NOT RUN | No hardware/browser session available for this iteration; emulation is not certification |
| WebKit / Firefox | NOT RUN | Runtimes not installed; Chromium and API-absence fallback were actually exercised |
| Public v0.6 HTTPS/WSS | NOT RUN | Deployment and remote push explicitly prohibited; real local transport was tested |
| Secondary advanced-settings / bug-reference image comparison | NOT RUN | Files not supplied/found; fixes follow written specification and actual repository/browser evidence |

## Browser and viewport matrix

Chromium desktop and Chromium iPhone emulation: Studio/menu matrix at 1440×900, 1280×800, 1024×768, 834×1112, 390×844, 375×667, 844×390; retained compact cases also cover 320×568 and browser keyboard-size simulation. Connected phone is actually rendered at 390×844, 375×667 and 844×390, with closed/quick layouts and nonoverlap checks. Editor, library, settings and text scroll internally; the document shell does not overflow. Tablet normal editor and open drawer are both captured. Keyboard-open checks simulate VisualViewport geometry, not physical iOS browser chrome.

## Visual review actually performed

Viewed actual browser-generated files for: approved closed/quick phone states; short phone and landscape closed/quick; EN/UK/RU advanced settings, text/revocation/disconnected states; QR before approval and the unobstructed host after readiness; Studio at every requested size plus normal tablet editor/drawer; import alignment; custom folder dialog; inline action row; language/filter/assigned-folder/script/profile/custom-mapping/navigation menus; immersive language; dark settings/countdown; phone language inside dark advanced sheet; unsupported-Popover fallback action sheet. New evidence uses docs/screenshots/v06-*; older release screenshots are preserved. Before images come from the clean starting commit. Generated QA scripts only, plus the approved design artwork; no private owner script library was read.

Final screenshot inspection caught two defects that simple functional checks missed: a legacy mobile display:block override allowed toolbar buttons to wrap, and the advanced sheet lacked a touch-scrollable body. Removed the obsolete override, added geometric single-row/action-reachability checks, and added a bounded scroll body with fixed heading/Close plus direct scrolling/viewport assertions. Rebuilt and reran the full 102-case suite after those fixes. No unresolved critical failure remains in the executed local checks.

Intermediate failures/interrupted runs (legacy selectors/layout assertions, in-flight state duplicates, focus restoration, mobile toolbar wrapping and the scroll container) are not accepted as passes. One JSON test initially assumed reload preserved active-script selection; existing behavior opens the first stored script, so it now explicitly selects the imported script and verifies preserved text. Data was not lost and selection behavior was not silently changed.

## Limits and intentional adaptations

The authoritative two-state reference is available and was used; the secondary settings/bug images remain missing. Therefore no pixel-accurate claim is made for those missing references. Actual scripts, host values and scroll-based time estimates replace mock text/timestamps. The phone does not draw a fake device frame, status bar or hardware identity. Short portrait views reduce text space; landscape quick settings occupy the text side while playback remains usable. On narrow Studio screens action buttons scroll locally in one row; they are not hidden. Countdown remains the pre-start feature, and explicit revoke requires a fresh host invitation. Standard vibration is capability-gated; ordinary iPhone Safari has no invented Taptic API.

## Local delivery

Feature branch: codex/teleo-v06-approved-ui. Verified application source: **bc3bb08**. Follow-up local evidence commit records final tests and screenshots. No push, force-push, deployment, main modification, production DNS/account-plan change or native-data migration was performed. The existing public staging still runs the preceding release. Source/files and screenshot families are listed in TELEO_V06_CHANGED_FILES.md.

Local review server started after verification: Vite at http://127.0.0.1:5173 and local relay at 8787. This is a Mac-local development preview, not a physical-iPhone reachable deployment. Final application corrections were verified by the 102-case suite before source commit bc3bb08; subsequent expanded assertions changed tests only and passed six focused cases.
