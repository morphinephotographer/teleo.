# Web UI architecture

## Audit and retained boundaries

The app uses React 19, TypeScript and Vite, pathname/history routing, local React state plus a shared `Playback` instance, typed EN/UK/RU dictionaries, IndexedDB schema v1 and local recovery checkpoints. `RemoteLink` manages secure browser WSS sessions; a Cloudflare Durable Object owns authorization, ACK routing and recovery. Keyboard/HID inputs share the command domain. Native Apple UI and transport are separate and unchanged.

Source owners:

| File | Responsibility |
| --- | --- |
| apps/web/src/main.tsx | application composition, scripts/preferences, host playback, input adapter, routes |
| apps/web/src/ui.tsx | icon buttons, segmented groups, native modal sheet |
| apps/web/src/Intro.tsx | session entry animation and accessible dismissal |
| apps/web/src/style.css | tokens, components, responsive layout, reduced motion |
| apps/web/src/storage.ts | unchanged IndexedDB/revision/tombstone logic |
| apps/web/src/remote.ts | unchanged pairing/reconnect/ACK protocol |
| packages/protocol/domain.ts | unchanged command semantics and portable model |

## Entry and composition

`/` and `/studio` render the same application workspace. `/help`, `/privacy` and `/remote` remain supported. The old HomePreview and marketing JSX are removed. Existing stored scripts require no migration. New labels use all three existing dictionaries.

The header contains the brand, library toggle, current-script selector, Script/Read segment, phone/settings actions, contextual route menu and locale selector. The library can be collapsed. Desktop editing pairs a document surface with a large reading preview; narrower viewports use one primary document surface. Read mode replaces that surface with the host-owned text viewport and dock. Header script/locale controls remain available. Underlying editing content is inert while reading. Fullscreen switches to a viewport-filling reader; unsupported or rejected browser fullscreen still gets the immersive CSS layout.

Settings reuse existing preference/mapping handlers inside a native modal dialog. New interface theme, guide position and optional surrounding-text dimming are local presentation preferences, not new portable fields. Countdown/restart/ACK semantics remain unchanged. Plain-text editing intentionally avoids a fake formatting toolbar; TXT/JSON export, revisions, title, folder, duplicate and delete retain their handlers. Counts use whitespace-delimited words; duration is explicitly approximate at 150 words/minute adjusted by speed, not a measured physical speaking time.

## Performance and lifecycle

The requestAnimationFrame engine continues applying time-based scroll each frame. React playback displays update at most every 100 ms; local position checkpoints at most every 250 ms. Script paragraph strings and word counts are memoized by body. This separates scrolling from rebuilding all UI each display frame. No FPS guarantee or performance benchmark is claimed. Existing elapsed-delta clamp, pause/background handling, HID scope, command validation, storage flushing and relay security remain in place.

VisualViewport listeners resize the mobile editor shell when a keyboard changes the visible viewport; listeners, timers and animation frames are removed on cleanup. Modal settings prevent ordinary reader shortcuts; explicit hardware learning/test remains functional. Closing settings cancels learning/testing. The separate phone controller is retained from the preceding phase, including its existing optional vibration behavior.
