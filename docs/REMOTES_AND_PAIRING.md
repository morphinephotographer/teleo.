# Remotes and pairing

All input adapters dispatch validated commands to the host engine. No click simulation, global event taps, Bluetooth scanning or device identification is used.

## Physical keyboard/HID

Pair using OS Bluetooth settings. Standard: Space Play/Pause, Up/Down speed, Left/Right paragraph, R restart, M mirror (reader only). Browser mapping uses `event.code` plus `event.key` diagnostics, ignores editor/input/select/contenteditable/dialog targets, composition, repeats, Command/Ctrl/Alt. Standard, Two-button and Custom profiles are locally persisted. Two-button A defaults to toggle and B cycles configurable speed presets. Key learning detects conflicts; test mode shows only the actual delivered event, not hardware identity. Learning times out after 10 seconds in web. Reserved media/volume keys may never arrive.

Native SwiftUI onKeyPress is scoped to reader focus or explicit learning/test focus, down phase only, no global key capture. App-only keyboard events require no accessibility entitlement. Physical iPhone HID focus behavior and iPhone Safari key delivery must be tested on devices; Simulator automation is not hardware certification. Native learning has no timed cancellation yet; exit settings to cancel. Native mapping and speed presets are local UserDefaults, independent from CloudKit.

## Browser phone remote

Run `npm run relay` and `npm run dev`. Open Studio, create a script, enter Read, Connect phone. Scan QR or open the invitation link in an independent browser context. Host allows or denies. Capability has 256-bit entropy, is one-use for 120 seconds, and lives in the fragment, not query/path. The public Durable Object ID is not the capability. Controller removes the fragment after reading. The socket authenticates in its first frame; Origin is allowlisted. No body/title goes to the relay.

Host emits ACK after applying commands. Controller accepts numeric state only with an increasing relay sequence. Host sends a fresh snapshot on pairing/resume and while connected once per second; local host changes reach the phone without a remote request. No script text/title enters these snapshots.

One controller/host, one-hour absolute session TTL, 20 messages/sec, 1024-character messages, 1000 request IDs and 50 outstanding requests. Browser heartbeats run every 15 seconds and reconnect after 35 seconds without pong. After an approved peer's transport loss, the relay retains authorization for **30 seconds**; the browser retries with bounded exponential backoff (250ms–4s, at most eight attempts) for at most **25 seconds**. Both UI languages and all pairing state survive a reconnect because locale is independent from transport state.

Each role generates an independent 256-bit resume capability before initial authentication. The capability travels only in the first encrypted WebSocket auth/resume frame, stays only in the tab's memory, and is hashed in durable storage. Original host/invitation capabilities cannot be reused for resume. Resume works only after host approval; reload/navigation loses the capability and requires a new invite. Durable connection IDs replace stale sockets and ignore their delayed close callbacks. Deadlines, role hashes, connection IDs, request ledger and monotonic state sequence survive hibernation. Expiry/revoke/protocol rejection invalidate the session; explicit Revoke stops local retries immediately. If the relay is unreachable, server-side invalidation occurs at the bounded grace expiry; an offline host cannot process commands in the meantime.

There is **no offline command queue or automatic retransmission**. A lost ACK leaves the action's outcome unknown; the UI warns and requests current host state instead of repeating toggle/restart/jump. Pending ACKs are invalidated on a connection change even if a very fast peer resume arrives before a disconnect event. Duplicate request IDs remain suppressed across resume. Local text and playback survive relay outages; reaching script end or an explicit pause still stop normally. The browser recovery implementation is independent from native LAN, which still requires new native pairing after disconnect.

## Native iPhone → Mac

Mac reader: Allow iPhone Remote. On iPhone: iPhone remote → Find nearby Mac. Bonjour service `_teleo._tcp` lists hosts. Transfer the private base64 invitation securely (e.g. copy via a trusted owner-controlled channel), paste into SecureField, Request control. The invite binds service name, session ID, 256-bit PSK, 120-second expiration. Mac visibly approves. TLS 1.2 PSK (AES-128-GCM) via NWConnection/NWListener provides encrypted key-possession authentication; no permissive certificate callback/plaintext fallback. Older Network.framework APIs intentionally preserve iOS 17/macOS 14 compatibility. No QUIC/TLS 1.3 PSK claim.

Commands use newline-framed JSON, maximum 1024-byte frame, 4096-byte buffered receive, 20 frames/sec, 1000 requests/session. Strict fields; UUID session/request IDs, replay gate, host authorization and one-hour maximum. ACKs contain numeric position/speed and playing flag only. Heartbeat every 10 seconds, 30-second liveness cutoff, 5-second command ACK timeout. Revoke/background/reader close cancels network authorization. Local playback state survives disconnect. New pairing is required after disconnect; native QR scanning/handoff is not implemented. Local-network permissions and firewall rules are required. No iCloud or public internet is used by this transport.

A real same-Mac TLS loopback test covers successful enrollment, approval, command/ACK/revoke and wrong-key rejection where verified in QA. This does not certify Bonjour discovery, physical iPhone, firewall UX or sleep behavior. Native transport status/errors and physical matrix must be reviewed before shipping.

References reviewed: [Apple TN3213](https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework), [onKeyPress](https://developer.apple.com/documentation/swiftui/view/onkeypress(_:action:)), [Cloudflare WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

After explicit revoke, the host panel offers Reconnect instead of a redundant Revoke button. This starts a fresh invitation/approval flow and never resumes the revoked authorization. Opening that new invitation in the same phone tab is supported through fragment-change handling; a page refresh is not required.
