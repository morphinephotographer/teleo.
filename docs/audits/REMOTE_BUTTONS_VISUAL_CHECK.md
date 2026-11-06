# Remote button styling review

Compared the uncommitted filled-button styling with published 1.5.0 source
(`HEAD`) using the same JavaScript and separately intercepted before/after CSS.

- 72 screen comparisons: WebKit and Chromium, 390×844, 375×667 and 844×390,
  English and Russian; main remote, settings, connection, keyboard focus,
  Quick Send and quick controls.
- Waited for sheets to become visible before measuring and capturing.
- No button count changes, geometry drift over 1 CSS pixel, new horizontal
  overflow or page JavaScript errors observed. Back and language controls match
  in background, size and radius in the earlier focused check.
- Keyboard Tab focus remains visible as an inset grey cue. Touch/programmatic
  focus does not produce the former white outer outline.
- Five Quick Send integration scenarios passed, including WebKit→Chromium
  transfer and ru/uk/en messages. Typecheck, lint, build and diff checks passed.

Snapshots and measurements: `test-results/remote-buttons-audit/`. Automated
browser profiles are not physical iPhone validation. Existing landscape settings
remain centered with the previous 560px maximum width; this patch does not change
that layout. No new functional or visual regression was found in this scope.

Included in the 1.5.1 release; see TELEO_151_SITE_AUDIT.md for the broader review.
