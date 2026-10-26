# Web UI

The current v0.3.1 web design is documented in:

- [Design system and shared menus](design/TELEO_V03_DESIGN_SYSTEM.md)
- [Remote, geometry, preview contract and privacy](design/TELEO_REMOTE_V03.md)
- [Complete control inventory, visual audit and verification](audits/TELEO_V03_UI_AUDIT.md)
- [Retained intro animation](design/TELEO_INTRO_ANIMATION.md)

`/` and `/studio` open the same workspace after the accessible, skippable, session-scoped intro. Wide editing workspaces contain library, editor and integrated Playback/Text/Appearance settings. Narrow screens use bounded sheets and internal scrolling. The dedicated reading view retains its separate dock, guide, fullscreen fallback and actual playback engine. Existing local storage format and command semantics are retained; native Apple UI is unchanged.

The phone now has Remote/Text/Settings tabs, semantic clipped speed wings and rectangular paragraph controls. Script preview is off by default, requires separate explicit host consent for the paired session, and is ephemeral on the relay and phone. WSS protects transport; this is not end-to-end encryption. Loss, revocation and session termination clear phone text; bounded resume requests a fresh host snapshot.

Optional standards-based vibration is capability-gated and never represents a command ACK. Unsupported/throwing APIs do not prevent commands. Ordinary iPhone Safari has no standard Vibration API and no native haptic bridge is present. Unsupported browsers show an explanation instead of an enabled haptic switch; visual pressed feedback remains available. No physical vibration, Safari/WebKit or VoiceOver validation is claimed for this iteration.
