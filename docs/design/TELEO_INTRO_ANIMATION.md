# Intro animation

The full-screen intro is an entry overlay, never a route. Only initial `/` or `/studio` entry is eligible; `/remote` invitations and informational deep links are never covered. No script is created/modified, playback started, relay contacted or network request made by the animation.

## Timeline

| Time | Behavior |
| --- | --- |
| 0–~0.6 s | calm scattered letters emerge at deterministic positions |
| ~0.6–2.8 s | six brand letters converge; extra field letters fade toward center |
| ~2.8–3.15 s | sharp `teleo.` wordmark holds |
| 3.15–3.45 s | overlay fades out and workspace is revealed |

Six main letters use transform/opacity and a short blur-to-sharp reveal. Eighteen secondary letters form the desktop field; narrow-screen CSS hides eight. No random animation initialization, particles, canvas loop or heavy library is used. Blur is limited to the small letter set; actual device performance is unmeasured.

`sessionStorage['teleo.intro.seen.v1']` records entry. Intro does not replay on internal navigation/reload in the same tab session. If storage is denied, the current mounted app still only plays once; a full reload may play again. Reduced motion bypasses it; a change to reduced motion during the animation dismisses it.

The localized Skip button receives focus and immediately dismisses with mouse, touch or Enter/Space. The overlay is a labeled modal dialog; the entire underlying shell is inert and hidden from assistive technology while active. Completion restores focus to the app brand. The overlay is a sibling of the shell so its removal cannot reset document/storage/reader state. CSS is imported with the app and the HTML supplies a neutral background before React renders. Timers and media-query listeners are cleaned up on dismissal/unmount.

Automated coverage checks initial visibility, automatic dismissal, keyboard skip/focus, session navigation/reload, reduced motion, remote bypass and denied session storage. Visual screenshots capture the convergence and final workspace. Physical-device smoothness and VoiceOver remain manual checks.
