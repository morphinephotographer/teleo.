# Logitech R400 — browser keyboard preset

In Studio, open **Reading settings → Physical remote → Profile → Logitech R400 · keyboard preset**. Keep **Enable keyboard remote** checked. The choice uses the existing device-local `teleo.profile` / `teleo.keys` preferences; it does not alter scripts, custom key mappings or another device's language.

Connect the **USB receiver**. No driver, Bluetooth pairing, WebHID permission, native companion or accessibility entitlement is required by this browser feature. A browser cannot identify which physical keyboard sent a key code: this is a compatible preset, **not device discovery or a connected-device indicator**.

| Button / code | Host Reader behavior |
| --- | --- |
| Black screen / `Period` | Toggle the existing playback engine once. Works by `code`, including Russian `key=ю`. |
| Previous / `PageUp` | Existing previous-paragraph action. |
| Next / `PageDown` | Existing next-paragraph action. |
| Presentation / `F5` | Request actual browser DOM fullscreen for the Reader root, synchronously from keydown. Already fullscreen/pending: no duplicate request. |
| Presentation / `Escape` | Leave exit to the browser. Never a playback command or Reader exit in the enabled R400 preset. |
| Laser | No browser action: no key event is reported. |

The presentation button alternates F5/Escape independently of the app. An Escape may therefore arrive while windowed; press again for F5. The app never predicts this alternation, enters fullscreen automatically, or requires Escape keyup/keydown to know it has exited. DOM fullscreen is different from CSS expanded reading and native macOS window fullscreen.

One app-level keydown listener reads the current settings; there is no keyup playback handler. The preset applies only to the authoritative host `/studio` Reader. It is inactive in editor/library, `/remote`, other routes, text inputs, sliders/selects/contenteditable, visible dialogs/menus, composition or Meta/Ctrl/Alt chords. Repeat events for captured R400 keys are prevented but not dispatched: holding PageDown cannot fall through to browser scrolling; holding F5 cannot reload. Other keys and disabled presets retain their existing behavior.

Standard/Two-button/Custom profiles remain available. The R400 profile intentionally has no default speed keys; existing ± controls still use exact 0.1× steps. Select Standard for the generic arrow/Space shortcuts. Uncheck **Enable keyboard remote** to disable R400 capture. With R400 disabled, the ordinary Reader Escape shortcut again retains its previous app-exit meaning.

Fullscreen UI follows `document.fullscreenElement` / `fullscreenchange`; `fullscreenerror` and rejected promises show unobtrusive feedback and retain a usable CSS-expanded Reader. No permission/state is fabricated. API entry/exit does not change script selection, playback, speed or reading anchor. An unfinished countdown resumes instead of restarting when playback is toggled. Existing deliberate background-tab pausing remains: hiding the page can pause playback independently of fullscreen. A focus blur alone does not trigger a new fullscreen request.

## Hardware acceptance still required

The owner's supplied Safari 27.0.1 diagnostic log records 17 fulfilled requests, 17 entries/exits, zero Escape keydowns and two page loads. Some exits coincide with blur; the log does **not** establish that all exits came from R400. This is evidence from the diagnostic page, not certification of the integrated released app.

On the updated site:

1. Enable the preset on Mac Safari with the USB receiver attached. Black-screen button four taps: Play/Pause/Play/Pause, with no rewind or speed change.
2. Previous/next once; hold Next for two seconds: one paragraph action.
3. Presentation F5: actual DOM fullscreen. Black-screen button still toggles without closing it.
4. Presentation Escape or browser exit: Reader remains open, playback/position retained unless the page was actually hidden.
5. Repeat entry/exit ten times; manual exit and app focus switch must not cause auto re-entry. Check the paired iPhone sees playback/paragraph changes.
6. Editor and input fields: `.`/`ю` remain typing. Disable the preset and confirm its keys are no longer captured.

Browser automation and synthetic layout/repeat tests do not replace this physical check. Safari may consume Escape before JavaScript; use browser controls if API exit is denied. [Implementation/verification/release record](audits/LOGITECH_R400_VERIFICATION.md).
