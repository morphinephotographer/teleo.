# Teleo — Firefox preview reflow correction

2026-10-28. Follow-up during the owner's authorized production publication. The first published update was source `4e068b9`, Worker `72bc431a-6fc2-4a09-8643-f3449b37778e`. Production post-deploy verification found a real Firefox preview-follow defect; that publication was not reported as fully verified.

## Reproduction and correction

The existing paired Reader scenario steps speed, seeks to paragraph 11, opens inline typography and sets font size to 68. On production Firefox the active preview paragraph stayed outside the phone viewport. The original visibility assertion failed in both the complete public Reader cohort (14/15) and an unchanged isolated rerun. The captured phone frame showed paragraph 10 while the host was reading paragraph 11.

The preview's paragraphs use `content-visibility: auto` with estimated offscreen sizes. A passive scroll effect could use geometry before reflow/paragraph realization finished, while native scroll anchoring could also adjust the offset. The correction keeps the active paragraph explicitly laid out, disables native anchoring only inside the controlled preview, and follows it in a layout effect plus two bounded animation-frame passes. Pending frames are canceled on dependency changes/unmount. No permanent scroll loop or observer was added, and manual preview scrolling is not continually overridden.

Approved layout, colors and controls are unchanged. Host reading anchors, playback, transport, permission epochs, server rate limits, script storage and dependencies are unchanged. Only `RemoteController.tsx`, two CSS declarations and a Reader test assertion change the implementation. The existing visible-active-paragraph assertion remains in place; the test additionally checks that the active paragraph is measurable instead of virtualized.

## Verification

- Candidate staging Worker `87fcc0fd-79da-4bcb-9364-738a7905e2b5`: the original public Firefox scenario passed **3/3**, with no skipped/relaxed visibility assertion. Actual fixed public screenshot inspected.
- Full unit/integration: **147/147**.
- Complete local browser regression: **220/220**.
- Final local Reader **15/15**, R400/permissions **36/36**, production Worker matrix **32/32**. Typecheck, lint, build and production dry-run passed; no bindings/routes changed.
- An initial cold local three-repeat run had two passes and one later pointer-cancel timeout after the visibility assertion; this is retained separately. Subsequent final cohorts are the release gates, rather than treating that partial run as a pass.

All public tests use normal client identity and bounded room-creation cohorts. Native Safari/physical R400/iPhone acceptance remains manual, as in the [parent audit](TELEO_REMOTE_PERMISSIONS_R400_CONTEXT.md).

[Original production failure](evidence/preview-follow/initial-production-reader-failure.txt) · [unchanged public reproduction](evidence/preview-follow/initial-production-firefox-reproduction.txt) · [initial cold local run](evidence/preview-follow/initial-local-cold-repeat.txt) · [staging candidate](evidence/preview-follow/staging-candidate-deploy.txt) · [staging Firefox 3/3](evidence/preview-follow/staging-firefox-repeat.txt) · [unit](evidence/preview-follow/unit.txt) · [regression](evidence/preview-follow/regression.txt) · [Reader](evidence/preview-follow/reader.txt) · [R400/permissions](evidence/preview-follow/r400-permissions.txt) · [local production](evidence/preview-follow/production-local.txt) · [typecheck/build/dry-run](evidence/preview-follow/production-dry-run.txt) · [lint](evidence/preview-follow/lint.txt) · [candidate hashes](evidence/preview-follow/tested-assets.json).

Actual corrected public staging screenshot: [Firefox active paragraph after typography change](../screenshots/preview-follow-stage-firefox.png).

## Corrected production publication

- Application source `0396bba0b01cf5dc743aecfc8fdece4e1d8063b4`, branch `codex/remote-permissions-r400-context`; published using the existing interactive `npm run deploy:production` from a clean committed checkout.
- Production Worker `ccdbbb4c-40e5-432a-89fe-62ab11645b85` on `https://teleo.cc/studio`, confirmed at 100% traffic. Package remains 1.2.0. No GitHub push, DNS override, infrastructure, credential or storage migration changes.
- All five build files match the candidate staging artifacts. Four public served files also match their SHA-256 hashes and exact production commit/version headers. Staging candidate `87fcc0fd-79da-4bcb-9364-738a7905e2b5` contains these same assets and passed the public Firefox scenario 3/3.
- Prior versions `72bc431a-6fc2-4a09-8643-f3449b37778e` (first feature update) and `d32f4a4f-5ac8-4462-bf8c-cb9915697a9c` (original 1.2.0) are preserved; no rollback performed.
- Final production validation: **61/61 PASS** — 3 EN/UK/RU permission cases, 16 route/editor/security cases, 15 Reader cases including the original Firefox failure, and 27 R400 cases. Permission, Reader and R400 cohorts were sequential and respected the unchanged 10 new rooms/minute/IP limit, with a verified 100.6-second interval after the nine-room permission cohort. No synthetic public client-IP headers. No unresolved automated release-gate failures remain.
- The final documentation commit records publication evidence only; application source stays the commit above.

Production identity/evidence: [interactive deployment](evidence/preview-follow/production-deploy.txt), [100% version readback](evidence/preview-follow/production-deployments.txt), [staging asset hashes](evidence/preview-follow/staging-assets.txt), [production matching files/headers](evidence/preview-follow/production-assets.txt), [EN permission](evidence/preview-follow/production-permission-en.txt), [UK permission](evidence/preview-follow/production-permission-uk.txt), [RU permission](evidence/preview-follow/production-permission-ru.txt), [16 route/editor/security checks](evidence/preview-follow/production-routes.txt).

Final public suites: [Reader 15/15](evidence/preview-follow/production-reader.txt), [R400 27/27](evidence/preview-follow/production-r400.txt). Actual production screenshots: [QR and consent](../screenshots/preview-follow-production-qr.png), [revoked preview with working controls](../screenshots/preview-follow-production-revoked.png), [corrected Firefox preview](../screenshots/preview-follow-production-firefox.png), [phone Reader](../screenshots/preview-follow-production-reader-phone.png), [WebKit DOM fullscreen](../screenshots/preview-follow-production-fullscreen.png), [paused R400 reflow](../screenshots/preview-follow-production-paused-reflow.png). Captures are from the running public release; historical screenshots restored after tests.
