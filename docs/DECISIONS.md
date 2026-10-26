# Architecture decisions — 2026-10-26

1. Empty dedicated Git workspace; no prior v0.2 source or references found in workspace/Downloads. React/TypeScript/Vite; native SwiftUI, no WebViews. System fonts only.
2. Native minimum iOS 17/macOS 14 for SwiftData and onKeyPress. Installed Xcode 27.1, SDK iOS 27.1/macOS 27, Swift 6.4. Never require the SDK's OS version at runtime.
3. Separate IndexedDB and SwiftData libraries. Versioned JSON contract, immutable recovery revisions, retained tombstones. Never advertise browser/native automatic sync.
4. CloudKit private database is opt-in build configuration until owner supplies signing/container capabilities. Models have defaults, no unique constraints or relationships. Local saved status never implies cloud delivery. No destructive fallback on storage errors.
5. Authoritative host command engine: 40 points/second × speed, delta capped at 50ms. HID is focused keyboard input only; typing, IME, modifiers and repeats excluded.
6. Browser WSS relay uses Cloudflare Durable Objects, persistent state and WebSocket attachments. Native LAN transport is independent Network.framework; no CloudKit command transport or deprecated MultipeerConnectivity.
7. One-use 256-bit invite in fragment, 120 seconds, host approval, no script content, bounded commands, session expiry and revocation. No secure-pairing claim without encrypted authenticated transport.
8. Full website en/uk/ru dictionaries from first implementation; locale independent of script and playback state. Query locale URLs with canonical/hreflang; pairing fragments unchanged.
9. No Android, accounts, subscriptions, recording or AI. No production deployment/DNS changes or push authorized. Owner approval is required only for deployment, not local implementation.
10. Follow the master priority: build/test a persistent vertical slice before claiming breadth. Missing P0 work must remain explicitly incomplete in QA_REPORT.

11. Native LAN uses the older supported NWConnection/NWListener API and TLS 1.2 PSK. Apple TN3213 explicitly documents that PSK is unsupported by TLS 1.3/QUIC/new generic Network APIs. A 256-bit ephemeral key transferred privately binds peers; do not downgrade to plaintext. Loopback tests must wait for listener readiness and a nonzero assigned port.
12. Both transports fail closed on disconnection and require new invitations. This is an explicit release deviation from seamless bounded reconnect, not an implied completed feature.
13. Native Mac reader is a separate SwiftUI WindowGroup, backed by the same model container. Native text layout caches attributed text between display ticks and converts UTF-16 character ranges to glyph ranges for Unicode paragraph navigation.
14. Production offline assets ignore Vary when matching their precached immutable URLs, avoiding Origin-dependent misses; API/socket traffic is excluded from caches. Cache activation deletes only old teleo-prefixed caches.
15. Relay mutation handlers use a Durable Object concurrency gate across crypto and storage awaits; simultaneous invitations must not both enroll. State survives forced hibernation in integration tests.

16. Supersedes decision 12 for **browser WSS only**: approved pairs can resume for 30 seconds with separate per-role client-generated 256-bit capabilities, hashed server-side and memory-only client-side. Browser retry budget is 25 seconds/eight attempts. No command retransmission: uncertain ACKs are reported; host state is refreshed and sequence checked. Connection IDs handle late close races; capabilities/TTLs/replay IDs survive hibernation. Native LAN still uses fresh invitations after disconnect. No Apple Team or deployment is needed for local browser verification.
