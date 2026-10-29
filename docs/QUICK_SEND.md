# Mobile remote Quick Send

Quick Send is available from the document-plus button beneath paragraph navigation. The adjacent sliders button keeps the existing settings panel. The remote header and other controls are unchanged. All new copy is localized in EN, UK and RU.

Both destinations require the existing approved paired session:

- **Current session:** the computer stages one received text and acknowledges delivery. A quiet review notice appears without changing the active script or playback. The receiver can review and discard it, or explicitly replace the original active script and stop playback. Application is disabled if another script is selected. The staged text is held in memory and cleared when pairing is explicitly ended.
- **New script:** the computer commits a separate script to its existing IndexedDB library before acknowledging success. Selection and playback stay unchanged. There is no Inbox. The first nonempty line supplies the title.

The textarea preserves Unicode and paragraphs. Clipboard denial keeps manual paste available. Import accepts the existing TXT and portable Teleo JSON formats; multiple JSON script bodies are joined with a blank line. Quick Send accepts up to 8,000 UTF-16 code units; files are limited to 48,000 bytes and must contain valid UTF-8. These bounds fit the existing relay frame limit even with JSON escaping. The ordinary desktop import limit is unchanged.

## Small transport and storage extension

The existing authenticated WebSocket channel now accepts `quickSend` from the approved controller and `quickSendAck` from the receiver. Existing origin checks, room credentials, explicit approval, role checks, expiration, reconnect and rate limits apply. Production uses the existing HTTPS/WSS deployment; loopback HTTP is used only in local tests.

The relay forwards text without storing it. It stores a bounded transfer ledger (up to 100 IDs per paired room), SHA-256 fingerprints and successful receipts. A reused ID with changed content is rejected. Only the destination-appropriate receipt is accepted. Failed requests may be retried; completed requests return their receipt without forwarding text again. No dependency, new cloud service or database schema upgrade was added.

The client waits ten seconds for a receiver receipt. Disconnects and timeouts produce an uncertain-delivery error, never success. Retrying unchanged text keeps the same UUID. On the computer, a new script and its transfer receipt commit in a single transaction using the existing scripts/onboarding stores. Concurrent retries cannot create duplicates, claim an unrelated script, or overwrite subsequent desktop edits.

## Changed files

- `apps/web/src/RemoteController.tsx`, `QuickSendSheet.tsx`, `ui.tsx`, `style.css`: bottom action row, text form, destination choices and confirmation sheet.
- `apps/web/src/quick-send.ts`, `i18n.ts`: bounded imports and localized copy.
- `packages/protocol/quick-send.ts`, `apps/web/src/remote.ts`, `services/remote-relay/worker.ts`: validated requests, receipts, timeouts and replay handling.
- `apps/web/src/main.tsx`, `storage.ts`: receiver review and atomic library saves.
- `tests/quick-send.test.ts`, `remote-client.test.ts`, `relay.test.ts`, `tests/e2e/quick-send.spec.ts`, `playwright.quick-send.config.ts`: protocol, persistence, transport and browser coverage.
- `tests/e2e/remote-permissions.spec.ts`: update the pause-button selector to the existing visible reader header; the auto-hiding dock is not a reliable visibility assertion.

## Verification

- `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`.
- Full Vitest suite: 16 files / 167 tests passed, including all 26 real Durable Object tests. After the final UTF-8 and transaction-abort additions, the non-relay suite passed again: 15 files / 143 tests. Together these cover all 169 current tests.
- Six Quick Send browser scenarios passed: Chromium with Android device emulation and WebKit with iPhone device emulation, each in EN/UK/RU.
- Browser coverage includes empty/filled/success sheets, equal action widths, unchanged sliders, clipboard denial, malformed JSON, TXT import, explicit receiver application, unchanged active text before confirmation, continuing playback, separate library save, missing ACK, same-ID retry without duplicates and simulated IndexedDB write failure.
- Layout inspected against the supplied PNG. Reduced viewport height checks scrolling and submit access above a simulated keyboard. Screenshots are written to `test-results/quick-send/`.
- Existing remote permission/privacy regression suite in desktop Chromium: 3/3 passed. The older dock-only pause selector initially failed because the dock hides during reading; the assertion now targets the existing visible reader header.

## Limits and visual differences

Physical iPhone/Android devices and their actual on-screen keyboards were not available. Browser emulation and WebKit are not a substitute for a physical-device Safari/Chrome check.

The confirmation copy states delivery rather than application. It has a Continue button; the mockup's secondary “Open in editor” shortcut is omitted because editing/application occurs through explicit review on the paired computer. The counter displays the 8,000-unit limit, and the sheet scrolls on smaller screens. Existing remote sizing and typography are retained.

No deployment, push or merge is performed by this change.
