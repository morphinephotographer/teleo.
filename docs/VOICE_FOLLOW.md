# Voice follow (web Reader)

Status: implemented on branch `claude/voice-follow`, verified locally with a simulated recognizer. **Not verified with a real microphone and browser speech service yet**; not deployed.

## Behaviour

- Reader top bar → microphone button (shown only when the browser exposes `SpeechRecognition` / `webkitSpeechRecognition`: Chrome, Edge, Safari; not Firefox).
- Reading aloud moves the text so the next unread word sits on the focus guide; already-read text dims (CSS Custom Highlight API, no DOM changes; without it the text still follows).
- Text in `[square brackets]` is never expected to be spoken and is skipped.
- Tap a word to continue from it. Wheel/swipe or line/paragraph/seek controls take over; ~1.2 s after they stop, tracking continues from the word at the guide.
- Play (button, Space, remote) switches back to steady scrolling and turns voice follow off. Leaving Reader or changing the script turns it off.
- Settings → Follow my voice: speech language (Automatic from the script's letters — Ukrainian ґ є і ї vs Russian ы э ъ ё vs Latin — or explicit uk-UA / ru-RU / en-US / en-GB). Stored per device as `teleo.voiceLanguage`.
- Screen stays awake while listening (Wake Lock, as during playback).

## Design

- `packages/protocol/speech-follow.ts` — `SpeechFollower`, pure and unit-tested (`tests/speech-follow.test.ts`). Positions are UTF-16 offsets in the unmodified script body, the same coordinate as the Reader's paragraph blocks (`paragraphs()`), so `scrollToTextOffset` / `textOffsetAtView` are reused.
  - Each recognizer result is the whole transcript of the current session. A word-level fuzzy scan from the last confirmed position sets the candidate (always a word boundary); a character-level scan only confirms it. Commit if both scans progressed, the step is ≤ 15 characters, a cue was skipped, or 2 of the last 3 candidates agree (±10). Never moves backwards except by an explicit jump.
  - Fuzzy words: ≤ 2 letters exact; prefix match (≥ 3 letters); shared prefix ≥ 60 %; Levenshtein ≤ 1 (≤ 4 letters), ≤ 2 (≤ 8), ≤ ⅓ length beyond. "ё" folds to "е".
  - Jumps ignore the transcript spoken before them and results arriving within 300 ms.
  - Deliberate deviation from Textream: Textream averages the two scans, which left the position mid-word after one misrecognized letter and let unrelated speech nudge it forward.
- `apps/web/src/voice-follow.ts` — `VoiceFollow` keeps one continuous, interim-results recognition session alive, restarting it when the browser ends it (silence/time limits) with a short backoff; more than five empty sessions under 1.5 s in a row stop with an error. Errors map to localized messages (permission, microphone, network, language, failed).
- `main.tsx` — the Reader frame loop eases the viewport toward the spoken position (exponential, ~4/s) while voice follow runs; manual-scroll detection uses input events only (wheel, touchmove, line/paragraph/seek), never scroll events, because layout changes also scroll.

## Privacy

teleo. does not receive, send or store audio or transcripts; nothing is added to the relay protocol. The browser's own speech recognition may process audio on its vendor's servers (for example Google in Chrome, Apple in Safari). This is stated in Settings and on `/privacy` and `/help` in en/uk/ru. `SpeechRecognition.processLocally` is experimental and not used.

## Verification

```sh
npx vitest run tests/speech-follow.test.ts
npx playwright test --config playwright.voice.config.ts   # simulated recognizer, desktop + phone viewport
```

Still to verify on real devices: Chrome/Edge on Mac with a real microphone (uk/ru/en), Safari on Mac, Safari on iPhone (continuous recognition there is less reliable), behaviour in noisy rooms, long scripts.
