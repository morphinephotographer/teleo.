# iPhone microphone for voice follow

Implemented on top of production 1.4.1 (`87b8bbc` source tree). This feature is
local development work and has not been published to teleo.cc.

## Use

1. Pair the iPhone remote and approve it on the host as usual.
2. In Reader (or voice settings) select **Microphone source → iPhone remote**.
3. Press the Reader microphone. The host offers a fresh voice session for the
   current script and language; it does not turn on any microphone.
4. On the phone press **Use iPhone microphone** and grant the browser permission.
   Keep that page visible while reading. Speech moves and highlights the host
   script; the phone does not need permission to preview the script.
5. Stop on either device, use Play, leave Reader, switch script/source, or close
   the phone to stop this session. A new session needs a new host grant and a
   new tap on the phone. There is no automatic fallback to the laptop microphone.

The host can receive phone speech even if its own browser has no speech API.
Recognition still depends on the phone browser, available speech language,
Dictation/speech service and network connectivity. Browser speech recognition
may process audio using its provider's service. No raw audio is sent through
Teleo. Recognized phrases do pass through the existing paired relay in memory.

## Protocol and lifecycle

`packages/protocol/remote-voice.ts` defines four versioned, strictly validated
frames: host `voiceOffer`, bidirectional `voiceStop`, and controller-only
`voiceStatus` / `voiceTranscript`. A fresh UUID session is bound to the host's
current control target. Frames require an approved, authenticated pair. Late
sessions and duplicate/out-of-order sequence numbers are ignored. Oversized,
unknown-field or wrong-role frames are rejected. The relay stores only the offer
metadata and last sequence, never transcript frames or audio. Any connection
replacement/disconnect invalidates the grant, including across hibernation.

Phone recognition reuses `VoiceFollow`'s Safari phrase restarts and permission
handling. Sending is coalesced to at most four transcript frames per second, with
at most 600 UTF-16 code units per frame. New recognition sessions reset matching
without resetting the confirmed host position. Stop clears queued speech.

Phone status heartbeats arrive every two seconds. The host stops after seven
seconds without a status or phrase (up to one additional second for its check),
or after 30 seconds if the phone has never started. Hiding either page, pagehide,
route/unmount, permission failure and transport reconnect stop the relevant
capture/follower. A resumed WebSocket never resumes microphone permission.

## Checks

- Typecheck, lint, production-style build and diff check passed.
- 219 unit tests passed across 23 files.
- 14 focused real Durable Object tests passed: remote voice (including SQLite
  inspection for transcript retention and reconnect invalidation), existing
  numeric controls, preview permission and Quick Send. The other 16 relay
  runtime cases were not selected; a full relay-suite pass is not claimed.
- 42 browser scenarios were checked in Chromium and WebKit: 40 passed in the
  combined run, followed by both passing timeout tests after replacing an
  ineffective post-start fake-clock fixture with an actual voice-frame drop.
  The suite covers phone consent, real WebSocket forwarding, actual host text
  movement, source switching, unsupported host, denied phone permission,
  hidden phone, disconnect, repeated start, and existing desktop/iPad voice
  follow behavior. Recognition input is mocked; audio hardware is not tested.
- Visual previews are under `test-results/remote-voice/` and
  `test-results/remote-voice-layout/`.

Re-run:

```sh
npm run typecheck
npm run lint
npm run build
npx vitest run --exclude tests/relay.test.ts
npx vitest run tests/relay.test.ts -t 'remote voice|numeric controls|Quick Send relay|permission-scoped' --hookTimeout=15000
npx playwright test --config playwright.remote-voice.config.ts
```

## Physical iPhone verification still needed

Use an HTTPS staging build to pair the actual iPhone and read continuously for
several minutes. Check the intended ru/uk/en language, silence and phrase
restarts, Stop and a new start, backgrounding/lock, incoming calls, network loss,
and the supported wired/Bluetooth microphone if used. A desktop localhost
preview cannot be opened as localhost from another phone. Automated Safari
profiles do not prove uninterrupted physical microphone capture on iOS.

Publication of these changes was authorized by the owner on 7 November 2026; see the release audit for deployment evidence.
