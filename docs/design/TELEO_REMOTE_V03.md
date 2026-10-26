# Browser remote v0.3.1

## Approved layout and geometry

RemoteController.tsx renders Remote / Text / Settings, the honest paired-screen status, language/settings access and (only when preview is allowed) the current script title. The peer is called Studio; no Mac hardware identity, battery level or native bridge is invented.

One black circle sends explicit Play or Pause based on acknowledged host state. The multiplier is the existing 0.5–3.0 model in 0.25 increments. Speed wings are sampled smooth cubic Bezier contours, tapered toward the center and mirrored left/right. CSS clip-path applies to the semantic HTML button itself, clipping both visible surface and pointer hit-testing. Transparent bounding-box corners and the middle speed label cannot intercept Play/Pause or another wing. Focus uses a visible blue surface. Paragraph controls are equal rounded rectangles, never tapered/triangular. Landscape reorganizes the stage and navigation; short phone screens may scroll the primary panel internally to keep targets usable.

Text renders complete authorized text in an internally scrolling view, highlights the authoritative paragraph in pale blue and only follows when the new active paragraph is outside the viewport. Nodes are memoized; offscreen text uses content-visibility as an enhancement. No fragile visual line numbers are sent. Settings covers connection, preview status, appearance, supported feedback, Restart and Disconnect.

## Protocol: optional permissioned preview v1

Existing QR/approval/WSS/ACK/replay/reconnect transport is reused. Default pairing authorizes commands only. Host `previewPermission {version:1, allowed}` is accepted only after approval, only from the authenticated host. Relay assigns a monotonic consent epoch and echoes it to both peers with the public room session ID. UI waits for acknowledgement for transmission; consent controls show a pending state. Revoking consent immediately cancels local outgoing chunks and clears phone text after the relay's false permission frame. Phone cannot grant itself permission.

Messages:

| Message | Contents |
| --- | --- |
| previewPermission | version, allowed, epoch, sessionId |
| previewContent | version, epoch, script {id, SHA-256 revision, title}, index, total, text chunk |
| previewPosition | version, epoch, script {id, revision}, numeric playback state, speedUnit=multiplier, paragraph index, UTF-16 character offset, host timestamp |
| previewUnavailable | version, epoch, reason=tooLarge |
| previewRequest | version only, from authenticated approved controller; host resends only if consent is on |

Relay adds sessionId and increasing sequence to content/position/unavailable envelopes. The receiver enforces session, epoch, version, schema and sequence; buffers one bounded revision and never combines chunks from different revisions. Hash revision covers script ID, title and body, so editing/title/script selection triggers a new snapshot. Text is sent once after grant, changed revision or resync, with 180ms edit debounce. Chunks are at most 8192 UTF-16 units, paced every 150ms; positions are at most 4Hz, ordinary numeric state 1Hz. Commands retain the prior 1024-character message budget; the larger 52000-character raw-frame ceiling is restricted to validated host previewContent (JSON escaping included). Common rate limits remain 20 frames/sec. Snapshots are capped at 256 chunks / 2097152 UTF-16 units / 5000 paragraphs; larger texts remain fully editable/readable locally and remote commands still work, with an honest unavailable notice.

## Privacy and lifecycle

Only consent bits/epochs, authorization, replay ledger and counters are durable. Text, title, hashes/offsets from preview frames and chunk buffers are not assigned to Durable Object storage or WebSocket attachments. The relay forwards ephemeral frames to the paired phone and does not log payloads. Tests inspect actual test SQLite stores for private body/title markers and exercise authorization, revocation and hibernation.

This is TLS transport, not end-to-end encryption: the relay operator can see authorized forwarded content while processing it. The host library stays local at rest; phone preview is memory-only (no IndexedDB/localStorage script copy). Transport interruption clears the phone preview immediately. Bounded resume retains the already-approved session/consent, requests a fresh authoritative snapshot and never replays uncertain commands. Explicit Disconnect/Revoke/expiry invalidates the session and clears preview. A new invitation starts with permission off. Best-effort memory cleanup is not a claim of physical RAM erasure.

## Feedback and platform limits

feedback.ts centralizes optional standards-based navigator.vibrate(12), local preference and safe no-op on absence/failure. The toggle appears only when the API exists; the label says where supported because hardware response cannot be verified from API presence. Ordinary iPhone Safari has no supported Vibration API and no native bridge exists here. It shows a truthful limitation and universal visual press feedback. No hidden switch, undocumented Taptic trick, fake native API or hardware certification is used.

Automated tests use Chromium desktop and iPhone emulation, with real local/public app transport where recorded. Physical iPhone, Safari/WebKit, Firefox, VoiceOver, real Bluetooth HID and physical vibration are not claimed as verified. See audit for final executed counts and screenshot review.
