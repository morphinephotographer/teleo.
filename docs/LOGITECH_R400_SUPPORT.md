# Logitech R400 — browser keyboard preset

The context-aware control update is published on Teleo.cc from corrected source `0396bba` after separate owner authorization. [Feature/QA record](audits/TELEO_REMOTE_PERMISSIONS_R400_CONTEXT.md) · [Final publication and preview correction](audits/TELEO_PREVIEW_FOLLOW_FIX.md). The original 1.2.0 publication used paragraph arrows; its historical release record remains unchanged.

In Studio, open **Reading settings → Physical remote → Profile → Logitech R400 · keyboard preset**. Keep **Enable keyboard remote** checked. The choice uses the existing device-local `teleo.profile` / `teleo.keys` preferences; it does not alter scripts, custom key mappings or another device's language.

Connect the **USB receiver**. No driver, Bluetooth pairing, WebHID permission, native companion or accessibility entitlement is required by this browser feature. A browser cannot identify which physical keyboard sent a key code: this is a compatible preset, **not device discovery or a connected-device indicator**.

| Button / code | Host Reader behavior |
| --- | --- |
| Black screen / `Period` | Toggle the existing playback engine once. Works by `code`, including Russian `key=ю`. |
| Previous / `PageUp` | Playing: existing speed-down action, one 0.1× grid step. Paused: one rendered line backward; hold for bounded scrolling. |
| Next / `PageDown` | Playing: existing speed-up action, one 0.1× grid step. Paused: one rendered line forward; hold for bounded scrolling. |
| Presentation / `F5` | Request actual browser DOM fullscreen for the Reader root, synchronously from keydown. Already fullscreen/pending: no duplicate request. |
| Presentation / `Escape` | Leave exit to the browser. Never a playback command or Reader exit in the enabled R400 preset. |
| Laser | No browser action: no key event is reported. |

The presentation button alternates F5/Escape independently of the app. An Escape may therefore arrive while windowed; press again for F5. The app never predicts this alternation, enters fullscreen automatically, or requires Escape keyup/keydown to know it has exited. DOM fullscreen is different from CSS expanded reading and native macOS window fullscreen.

One app-level keydown listener reads the current settings; keyup only ends a paused hold, never playback. The preset applies only to the authoritative host `/studio` Reader. It is inactive in editor/library, `/remote`, other routes, text inputs, sliders/selects/contenteditable, visible dialogs/menus, composition or Meta/Ctrl/Alt chords. Native page scrolling/reload is prevented only for captured keys. While playing, repeats never change speed. While paused, native arrow repeats drive half-line steps at most once per 80 ms, with no autonomous scroll timer. Orphan repeats are ignored; the initial repeat must arrive within 1500 ms, subsequent repeats within 500 ms. Release, blur, pagehide, visibility/focus changes, scope/script/playback changes and cleanup cancel the hold. Missing keyup cannot leave the text moving on its own. Other keys and disabled presets retain their existing behavior.

Standard/Two-button/Custom profiles remain available. Running R400 arrows reuse the same 0.5–3.0× limits, 0.1× grid and persistence as the ± buttons; valid imported off-grid values retain existing next-grid-step semantics. The dock's existing speed output announces changes without adding an overlay. Paused scrolling never changes speed or resets the countdown, and updates the existing reading anchor so resume/reflow starts from the new position. Paragraph buttons remain available in the dock and iPhone remote. Select Standard for the generic arrow/Space shortcuts. Uncheck **Enable keyboard remote** to disable R400 capture. With R400 disabled, the ordinary Reader Escape shortcut again retains its previous app-exit meaning.

Fullscreen UI follows `document.fullscreenElement` / `fullscreenchange`; `fullscreenerror` and rejected promises show unobtrusive feedback and retain a usable CSS-expanded Reader. No permission/state is fabricated. API entry/exit does not change script selection, playback, speed or reading anchor. An unfinished countdown resumes instead of restarting when playback is toggled. Existing deliberate background-tab pausing remains: hiding the page can pause playback independently of fullscreen. A focus blur alone does not trigger a new fullscreen request.

## Hardware acceptance still required

The owner's supplied Safari 27.0.1 diagnostic log records 17 fulfilled requests, 17 entries/exits, zero Escape keydowns and two page loads. Some exits coincide with blur; the log does **not** establish that all exits came from R400. This is evidence from the diagnostic page, not certification of the integrated released app.

On the updated site:

1. Enable the preset on Mac Safari with the USB receiver attached. Black-screen button four taps: Play/Pause/Play/Pause, with no rewind or speed change.
2. While playing: Previous/Next changes speed down/up once, including a two-second hold. Pause: a tap moves one line, holding scrolls smoothly in half-line steps. Release/focus away: no continued scrolling. Resume retains the new position. Change font size and confirm the same passage stays near the guide.
3. Presentation F5: actual DOM fullscreen. Black-screen button still toggles without closing it.
4. Presentation Escape or browser exit: Reader remains open, playback/position retained unless the page was actually hidden.
5. Repeat entry/exit ten times; manual exit and app focus switch must not cause auto re-entry. Check the paired iPhone sees playback, speed and position changes.
6. Editor and input fields: `.`/`ю` remain typing. Disable the preset and confirm its keys are no longer captured.

Browser automation and synthetic layout/repeat tests do not replace this physical check. Safari may consume Escape before JavaScript; use browser controls if API exit is denied. [Implementation/verification/release record](audits/LOGITECH_R400_VERIFICATION.md).
