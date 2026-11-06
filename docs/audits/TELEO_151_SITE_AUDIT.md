# Teleo 1.5.1 site review

Scope: editor/library, imports, persistence, offline shell, intro/tour, settings,
Reader typography/playback/keyboard/voice, remote permissions and microphone,
responsive phone/tablet/desktop layouts, routes and security headers.

Changes:
- Filled remote button surfaces, including a round Back button matching Language.
  Touch focus no longer leaves a white outer outline; keyboard focus has a grey inset.
- Fixed a pre-existing settings layout collision: Open Welcome and Replay tour
  occupied the same grid cell. They now have separate cells in one compact row. Short windows retain vertical scrolling so every control remains reachable.
- Updated browser fixtures for current settings/dock controls, CSS asset paths,
  reduced-motion geometry measurement, native WebKit undo grouping and offline language switching.

Validation:
- Typecheck, lint, production build and deployment dry run passed.
- 220 unit tests plus all 30 relay tests passed, including real invitation expiry,
  reconnect, revocation, Quick Send and remote voice permissions.
- Initial broad Chromium/WebKit pass: 208 passed, 2 skipped, 20 failures.
  Failures were investigated rather than ignored: the overlapping Welcome action
  was a real CSS issue; others involved obsolete control selectors, floating-point
  geometry/transition timing, CSS interception bypassed by the service worker,
  source-module imports against a release server, and native WebKit undo behavior.
- Corrected mobile Welcome, safe-area rotation, library layout, production
  persistence/playback/locales and alignment cases passed on repeat.
- Source-dependent phone text-position scenario passed in both browsers against
  Vite; production offline reload, saved Unicode text and language switching also
  passed in both engines (4 supplemental cases).
- 72 before/after remote screen comparisons found no geometry regression,
  horizontal overflow or JavaScript errors. Ten additional settings layouts
  (320, 390, 844, 834 and 1440px, both engines) had separate clickable actions.
- Five Quick Send integration checks passed before the broad review.

Limitations: browser engines/device profiles are automated simulations, not a
physical iPhone/iPad/Windows hardware run. WebKit may natively group successive
Find/Replace operations into one undo step; Chromium undoes each replacement. Undo tests start from persisted text, since automation value replacement is not a reliable native undo boundary.

Final verification: the broad repeat completed with 222 passes, 2 skipped wide
layout fixtures and 4 failures in settings overflow / automation undo fixtures.
After the compact-row refinement and fixture corrections, all 16 targeted
checks passed on the final build, including both previously skipped wide layouts,
all four failures, mobile Welcome and library/trash persistence. Together these
runs cover all 228 production scenarios; 4 source/offline checks and 5 Quick Send
checks also passed. The final 72-screen remote comparison returned no issues.
Settings overflow validation now checks that the panel fits the viewport and
that each control can be scrolled into view, rather than requiring no vertical
scrolling when more actions are present. No application JavaScript was changed.
