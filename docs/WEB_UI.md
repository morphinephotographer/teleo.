# Compact monochrome web interface

The owner's 2026-10-26 references supersede the earlier blue-accent direction for the web UI: neutral canvas, white rounded surfaces, black pill actions, quiet borders and segmented navigation. Native SwiftUI clients are unchanged by this web redesign.

The app uses a dynamic viewport (`100dvh`) with a fixed shell. Studio uses three columns on desktop and Library / Editor / Reading settings tabs below 700 CSS pixels. Creating/selecting a script opens the editor; reload restores an existing script into the editor; deleting the last script exposes the library. Changing panels flushes pending edits. Long script bodies, library lists, expanded advanced settings, help/privacy copy and revision history have their own scroll regions so content remains reachable. This is not a promise that arbitrary long content or every expanded advanced option fits simultaneously without internal scrolling. The normal studio and connected phone controller fit the viewport.

Speed, text size, preview and Connect phone remain prominent. Other reading preferences and hardware mapping live in expandable groups. Version history overlays the editor with an explicit Close action. The reader remains immersive, scrolls only its content, and mirrors content without mirroring controls.

The controller hides the main route navigation, uses simple symbols with localized accessible action names, and retains explicit Play and Pause for idempotent commands. A short visual press response is provided. A synchronous, feature-detected `navigator.vibrate(12)` call requests optional tactile feedback before dispatch. Missing, rejected or throwing vibration APIs cannot prevent a command. Vibration is a local touch indication, not a host ACK. Safari/iPhone does not expose the standard Vibration API; no actual iPhone haptics are claimed. No hidden switch tricks, permission prompts, extra dependencies or audio substitutes are used.

References: [W3C implementation report](https://w3c.github.io/vibration/reports/implementation.html), [Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate).

Layout checks cover EN/UK/RU at 1440×800, 1024×700, 390×664, 320×568 and 844×390. Controller tests use real relay pairing, verify viewport and internal-panel fit at phone/landscape sizes and instrument the vibration call without presenting it as physical feedback validation. Existing CRUD, offline, HID mapping, ACK, revoke and reconnect checks remain separate regression coverage. Screenshots use generated QA content only.
