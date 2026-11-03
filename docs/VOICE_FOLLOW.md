# Voice follow (web Reader)

Status: implemented on branch `claude/voice-follow`, verified locally with a simulated recognizer. **Not verified with a real microphone and browser speech service yet**; not deployed.

## Behaviour

- Reader top bar → microphone button (shown only when the browser exposes `SpeechRecognition` / `webkitSpeechRecognition`: Chrome, Edge, Safari; not Firefox).
- Reading aloud moves the text so the next unread word sits on the focus guide; already-read text dims (CSS Custom Highlight API, no DOM changes; without it the text still follows).
- Text in `[square brackets]` is never expected to be spoken and is skipped.
- **Skip and go back by voice:** stop mid-sentence and continue further on, start another paragraph, or go back and re-read. When the latest spoken words (at least 3, ≥ 10 letters; up to 8 compared) occur together elsewhere in the script but not where you are, the Reader jumps there after one more confirming word. The longest matching run wins, then the occurrence nearest the current position. Off-script talk does not move it.
- Tap a word to continue from it. Wheel/swipe, arrow keys, Logitech R400, line/paragraph/seek controls and phone-remote seeks take over; ~1.2 s after they stop, tracking continues from the word at the guide.
- While listening, the playback dock is hidden (desktop and phone, layout kept so the guide never moves) and inert; the top-bar microphone stops voice follow and brings the dock back.
- Play (button, Space, remote) switches back to steady scrolling and turns voice follow off. Leaving Reader or changing the script turns it off.
- Settings → Follow my voice: speech language (Automatic from the script's letters — Ukrainian ґ є і ї vs Russian ы э ъ ё vs Latin — or explicit uk-UA / ru-RU / en-US / en-GB). Stored per device as `teleo.voiceLanguage`.
- Screen stays awake while listening (Wake Lock, as during playback).

## Design

- `packages/protocol/speech-follow.ts` — `SpeechFollower`, pure and unit-tested (`tests/speech-follow.test.ts`). Positions are UTF-16 offsets in the unmodified script body, the same coordinate as the Reader's paragraph blocks (`paragraphs()`), so `scrollToTextOffset` / `textOffsetAtView` are reused.
  - Each recognizer result is the whole transcript of the current session. A word-level fuzzy scan from the last confirmed position sets the candidate (always a word boundary); a character-level scan only confirms it. Commit if both scans progressed, the step is ≤ 15 characters, a cue was skipped, or 2 of the last 3 candidates agree (±10). Never moves backwards except by an explicit jump.
  - Fuzzy words: ≤ 2 letters exact; prefix match (≥ 3 letters); shared prefix ≥ 60 %; Levenshtein ≤ 1 (≤ 4 letters), ≤ 2 (≤ 8), ≤ ⅓ length beyond. "ё" folds to "е".
  - Jumps ignore the transcript spoken before them and results arriving within 300 ms.
  - Relocation (not in Textream), checked on every result: the longest run of the latest spoken words (3–8, ≥ 10 letters) is searched as consecutive script words — including words the in-order tracker already took, because it tolerates single mismatched words and can follow a repetitive script into the wrong section. If the run is not at the current position (±2 words), its nearest occurrence becomes a candidate, committed when the next result's run ends ≤ 4 words further at that place; the transcript is then re-anchored. Phrase search compares each distinct script word once (≈ 3–14 ms per result on a 20,000-word script).
  - Fuzzy prefix rules are stricter than Textream's: a whole-prefix match needs ≥ 4 letters and a shared stem ≥ 4 letters (≥ 60 %), so Slavic prefixes such as «роз-»/«при-» alone never match.
  - Deliberate deviation from Textream: Textream averages the two scans, which left the position mid-word after one misrecognized letter and let unrelated speech nudge it forward.
- `apps/web/src/voice-follow.ts` — `VoiceFollow` keeps one continuous, interim-results recognition session alive, restarting it silently (status stays "Listening") when the browser ends it (silence/time limits) with a short backoff; more than five empty sessions under 1.5 s in a row stop with an error. Up to 3 consecutive network errors are retried. A refused _automatic_ restart (possible on iPhone, where starting needs a tap) reports "press the microphone again", not a permission error. Errors map to localized messages (permission, microphone, network, language, failed).
- `main.tsx` — the Reader frame loop eases the viewport toward the spoken position (exponential, ~4/s) while voice follow runs; manual-scroll detection uses input events only (wheel, touchmove, line/paragraph/seek), never scroll events, because layout changes also scroll.

## Privacy

teleo. does not receive, send or store audio or transcripts; nothing is added to the relay protocol. The browser's own speech recognition may process audio on its vendor's servers (for example Google in Chrome, Apple in Safari). This is stated in Settings and on `/privacy` and `/help` in en/uk/ru. `SpeechRecognition.processLocally` is experimental and not used.

## Verification

```sh
npx vitest run tests/speech-follow.test.ts
npx playwright test --config playwright.voice.config.ts   # simulated recognizer, desktop + phone viewport
```

Still to verify on real devices: Chrome/Edge on Mac with a real microphone (uk/ru/en), Safari on Mac, Safari on iPhone (continuous recognition there is less reliable), behaviour in noisy rooms, long scripts.


## iPhone and iPad (Safari)

Safari on iPhone/iPad does not keep `continuous` recognition working: results stop arriving and the session ends (WebKit bug 225298), so the microphone appears to switch on and off by itself. It also fails a start made too soon after the previous session ("audio-capture"), throws when a recognizer that is still running is started, and may ask for the microphone again for every new recognizer. Voice follow therefore, on iPhone/iPad:

- runs **one phrase per session** (`continuous = false`) and reopens 300 ms after each session ends;
- **reuses the same recognizer** for the whole reading (a fresh one only if the old one refuses to start);
- treats sessions that started and ended in silence as normal (the presenter is quiet), never as failures;
- ignores `no-speech`, `aborted`, up to 3 `network` and up to 4 `audio-capture` errors after it has listened once;
- when sessions keep ending without ever starting (5 in a row) or the browser refuses an automatic restart, **pauses** instead of flickering: "Listening paused… tap the text where you are, or the microphone". A tap is a user gesture, so listening continues from the tapped word.

Other browsers keep one continuous session with a fresh recognizer after each end.

More WebKit behaviour handled (each has a simulation test in `tests/e2e/voice-ipad.spec.ts`):

- **Overlapping results** — Safari repeats earlier phrases in later results ("hello", "hello world") and can send a final phrase twice; `joinResults` keeps one copy.
- **Wiped transcripts** — Safari can drop what it heard earlier in a session; a transcript that no longer continues the previous one starts a new stretch from the confirmed position.
- **Slow microphone start** — words said before a session can hear are lost; following continues from the words that arrive.
- **Recognizer that opens and closes at once** (Dictation off, language not among the keyboards, microphone taken): sessions that start and end within 0.8 s without hearing anything; after 6 in a row voice follow stops with Dictation/microphone advice (`voiceNoAudio`) instead of switching the microphone on and off forever. `service-not-allowed` on iPhone/iPad shows the same advice; `not-allowed` keeps the microphone-permission message.

Field diagnosis and switches (kept for the browser tab; close the tab to reset):

| Address | Effect |
|---|---|
| `?voicelog=1` | On-screen log: settings, every session's open/start/heard/error/end with timings |
| `&voicemode=phrase` / `continuous` | Force one-phrase or continuous sessions |
| `&voicedelay=1000` | Pause in ms before the next session |
| `&voicereuse=0` / `1` | New recognizer per session / reuse one |
| `&voicelang=device` or `&voicelang=ru-RU` | Recognition language override (`device` = leave it to the system) |

Opening teleo from a Home Screen icon (standalone web app) is a known weak spot for Safari speech recognition; use a Safari tab when in doubt.
