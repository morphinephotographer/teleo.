# Pairing and host-authoritative sync v0.6

## Pairing UI versus authenticated session

The transport is still RemoteLink + the existing Cloudflare Durable Object. No second socket, account system or native bridge was introduced. One-use 120-second invitation, explicit host approval, origin validation, replay protection, 1-hour session, bounded 25s/30s client/server resume and existing rate limits remain.

The UI states are idle → connecting/QR waiting → approval pending → authenticated approved ready → automatic modal dismissal + compact connected indicator. Merely opening an invitation or authenticating a pending socket is insufficient to close the host modal or enable the controller. Manual X/Escape closes only the pairing UI. It neither revokes an existing pair nor destroys a pending invitation; a later approval is still explicit and can be reopened from the host connection button. The connected event closes the modal, clears QR/invite UI and releases focus containment. Success arriving after manual close does not reopen it.

Opening connection details never allocates a new room when a session/status already exists, including terminal disconnected/unavailable. Retry/Reconnect explicitly creates a new invitation. Asynchronous room/QR completion is guarded by a generation counter; old results cannot overwrite a replacement session. End/revoke/navigation cancels outgoing text and clears receiver memory. Reconnection resynchronizes authoritative state and separately consented content; uncertain commands are not replayed.

## Existing command channel extended safely

`packages/protocol/control.ts` adds strictly validated commands within the existing command/ACK envelope:

- Existing playback commands retain their exact multiplier range 0.5–3.0 and 0.25 increment.
- `seek {target, value}` accepts finite normalized 0–1 position. The host resolves it against its current rendered scroll maximum. It preserves playing/paused state; seeking to the end retains the engine's normal end-stop behavior.
- `setPreference {target, key, value}` allowlists fontSize 16–100, lineHeight 1–3, textWidth 280–1600, countdownSeconds 0–10, and boolean horizontal/vertical mirror/guide. Unknown fields/keys, invalid types, nonfinite and out-of-range values are rejected.

`target` is a memory-only generation UUID replaced when the active script/body changes. The host rejects commands for an obsolete target by returning current state without applying them. It does not expose script content or a reusable authorization secret. The same authenticated command ID/replay ledger and server monotonic sequence protect delivery/ACKs.

Optional `state.controls` contains version 1, target, current scroll maximum and the allowlisted typography/secondary settings. Legacy three-field numeric states remain valid. Text/title are forbidden in this metadata. With preview consent, at most 12 sampled real paragraph positions are included as normalized markers, derived from actual host layout/navigation offsets; without consent these markers are omitted. Bounds and raw-frame size are validated; normal command/state frames remain under 1024 characters. No content is persisted in relay room data or WebSocket attachments.

The host applies the change through existing preference/autosave and playback handlers, recomputes layout and preserves scroll fraction for typography changes, then ACKs actual state. Direct DOM scroll updates prevent an older queued scroll event overwriting a seek. The phone's numeric values are host-confirmed; it does not create a parallel preference source of truth. Metadata updates are deduplicated and capped at 2Hz, preview position at up to 4Hz with unchanged paused positions skipped. ACK already carries authoritative state, so duplicate post-ACK broadcasts were removed to stay inside the unchanged 20 frames/sec limit.

## Timeline and privacy

Scrubbing updates a local preview; pointer release or keyboard seek commits one command. It does not send on every pointer move/animation frame. Paragraph buttons remain distinct commands. Elapsed/remaining are finite estimates from real position/maximum and engine speed (40px/sec × multiplier), clamped for zero/empty/unknown data. Speed changes recalculate estimates. Disconnected controls are disabled and text cleared; no queued unsafe stale actions.

Text preview retains v1 host-only explicit consent, epochs, SHA-256 revision/chunk bounds, session identity, sequence checks, ephemeral relay forwarding and memory-only phone assembly. Connecting does not grant text. Revocation, expiry or loss clears preview; resume requests a fresh snapshot. WSS is transport encryption, not E2EE. Haptics remain a capability-gated optional standard API; ordinary iPhone Safari has no invented Taptic support.

## Verification

Unit tests cover schema/type/bounds, compatibility, frame budget and finite time arithmetic. Relay integration covers authenticated typed forwarding, exact ACK state, replay rejection and denied text, alongside prior Origin/auth/expiry/rate/hibernation tests. Browser tests use two independent contexts and real local transport, observe routed frames directly and await each exact command ID's ACK. They exercise private/granted/revoked text, editing/switching, seek, typography, mirroring, QR manual/auto close and bounded reconnection. Actual final counts and browser/device limits are in the UI audit.
