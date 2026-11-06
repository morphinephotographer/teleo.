# Disabled Quick Send — 7 November 2026

The user reported visible text on the iPhone, working Play/speed controls, but an
inactive Send button when paired with Windows Chrome. The character count was
not remembered, so the exact cause of that historical incident is unconfirmed.

## Confirmed on the public 1.4.1 build

A disposable approved pair was created on teleo.cc. The host ran Chromium with
a Windows Chrome user-agent and the phone ran WebKit with a mobile viewport.
These engines ran on macOS; physical Windows/iPhone hardware was not tested.

- 8,000 characters: Send enabled.
- 8,001 characters: Send disabled, with no explanatory status.
- A short Unicode/multiline script transferred successfully. The computer showed
  the review UI, and the text applied after explicit replacement confirmation.

This reproduces a silent validation problem, not an OS-specific transfer
failure. The shared Wi-Fi network is not required: the existing approved pair
uses the hosted relay over the Internet. That does not prove the user's earlier
text exceeded the limit; an embedded NUL or other form state could also explain
an inactive button.

## Local fix

`quickSendBodyIssue` is shared by message validation and the form. Empty text,
over-limit text, embedded NUL, and missing approved connection now have explicit
ru/uk/en guidance associated with the editor and Send button. The counter and
editor indicate invalid content. Long clipboard text remains visible for editing
and shows the true length error, instead of being incorrectly reported as a
clipboard-access failure. An actual clipboard denial focuses the editor for
manual paste. Text is never silently truncated. The 8,000-character transport
limit and acknowledgement/review safeguards are unchanged.

Validation: typecheck, lint, build and 220 unit tests passed. Five focused browser
cases cover all three localizations, actual WebKit-to-Chromium pairing/transfer,
long clipboard text, recovery by shortening, host confirmation, disconnected
state and clipboard denial. The public test was a separate check of the already
published 1.4.1 build. The fix is local alongside the pending phone-microphone
feature and has not been deployed.

Publication of these changes was authorized by the owner on 7 November 2026; see the release audit for deployment evidence.
