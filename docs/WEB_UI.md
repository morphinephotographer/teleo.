# Web UI

The current local v0.6 web design is documented in:

- [Approved remote and shared tokens](design/TELEO_REMOTE_APPROVED_V06.md)
- [Pairing, commands, seeking and privacy](engineering/TELEO_PAIRING_AND_SYNC_V06.md)
- [Complete control inventory, visual audit and verification](audits/TELEO_UI_AUDIT_V06.md)
- [Retained intro animation](design/TELEO_INTRO_ANIMATION.md)

`/` and `/studio` open the same workspace after the accessible, skippable, session-scoped intro. Wide editing workspaces contain library, editor and integrated Playback/Text/Appearance settings. Narrow screens use bounded sheets and internal scrolling. The dedicated reading view retains its separate dock, guide, fullscreen fallback and actual playback engine. Existing local storage format and playback semantics are retained; typed seek/preference commands extend the existing authenticated channel; native Apple UI is unchanged.

The phone follows the approved dark two-state reference: always-present live text, monochrome seek timeline, circular speed/play controls, rectangular paragraph controls, one bottom quick-typography button and one top-right advanced gear. Text-action dropdowns are replaced by an inline toolbar. Folder/deletion flows use custom accessible dialogs; pairing is separately dismissible and auto-closes only after approved readiness. Script preview is off by default, requires separate explicit host consent for the paired session, and is ephemeral on the relay and phone. WSS protects transport; this is not end-to-end encryption. Loss, revocation and session termination clear phone text; bounded resume requests a fresh host snapshot.

Optional standards-based vibration is capability-gated and never represents a command ACK. Unsupported/throwing APIs do not prevent commands. Ordinary iPhone Safari has no standard Vibration API and no native haptic bridge is present. Unsupported browsers show an explanation instead of an enabled haptic switch; visual pressed feedback remains available. No physical vibration, Safari/WebKit or VoiceOver validation is claimed for this iteration.

The v0.6 work is local-only. Public staging still runs the preceding authorized release; no push or deployment was performed.
