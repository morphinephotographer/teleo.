# Web UI

The current web design is documented in:

- [Design system](design/TELEO_DESIGN_SYSTEM.md)
- [UI architecture](design/TELEO_UI_ARCHITECTURE.md)
- [Intro animation](design/TELEO_INTRO_ANIMATION.md)
- [Responsive layout](design/TELEO_RESPONSIVE_LAYOUT.md)
- [Audit and verification](audits/TELEO_UI_REDESIGN_REPORT.md)

The owner's Complete Website UI/UX Redesign brief supersedes the earlier marketing-first homepage and always-visible settings column. `/` now opens the same workspace as `/studio`, with an accessible, skippable, session-scoped brand intro. Storage, portable script schema, command semantics and relay authorization remain unchanged. Native Apple UI is outside this web redesign.

The standalone phone controller retains the preceding monochrome interface. Its optional synchronous `navigator.vibrate(12)` request is a touch indication, not an ACK. Missing/throwing APIs never prevent a command. Safari/iPhone does not expose the standard Vibration API; no actual iPhone haptics are claimed. See [W3C implementation report](https://w3c.github.io/vibration/reports/implementation.html) and [Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate).
