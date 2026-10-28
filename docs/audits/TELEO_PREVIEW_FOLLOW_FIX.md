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

Publication source identity, final public checks and screenshots are appended after the corrected release is published. All public tests use normal client identity and bounded room-creation cohorts. Native Safari/physical R400/iPhone acceptance remains manual, as in the [parent audit](TELEO_REMOTE_PERMISSIONS_R400_CONTEXT.md).

[Original production failure](evidence/preview-follow/initial-production-reader-failure.txt) · [unchanged public reproduction](evidence/preview-follow/initial-production-firefox-reproduction.txt) · [initial cold local run](evidence/preview-follow/initial-local-cold-repeat.txt) · [staging candidate](evidence/preview-follow/staging-candidate-deploy.txt) · [staging Firefox 3/3](evidence/preview-follow/staging-firefox-repeat.txt) · [unit](evidence/preview-follow/unit.txt) · [regression](evidence/preview-follow/regression.txt) · [Reader](evidence/preview-follow/reader.txt) · [R400/permissions](evidence/preview-follow/r400-permissions.txt) · [local production](evidence/preview-follow/production-local.txt) · [typecheck/build/dry-run](evidence/preview-follow/production-dry-run.txt) · [lint](evidence/preview-follow/lint.txt) · [candidate hashes](evidence/preview-follow/tested-assets.json).

Actual corrected public staging screenshot: [Firefox active paragraph after typography change](../screenshots/preview-follow-stage-firefox.png).
