# Approved teleo. remote v0.6

## Reference and precedence

The two states in design-references/01_APPROVED_REMOTE_CLOSED_AND_QUICK_PANEL.png are authoritative. This is the owner's image supplied in chat on 2026-10-27. Earlier three-tab, crescent/wing, blue-accent and light-phone alternatives are superseded. The separate advanced-settings reference and five named bug-reference images were unavailable; no comparison against those missing files is claimed.

## Composition and controls

The remote uses an almost-black canvas, lowercase teleo., one truthful connection indicator with monitor icon and exactly one gear entry at the top right. It has no tab bar and no second settings gear. The main text area is always present, follows the host's current paragraph and shows bright current text with readable neutral surrounding text. Private/unavailable/disconnected states replace content honestly; there is no sample fallback text.

Below it are a monochrome timeline with vertical thumb, bounded real paragraph markers and estimated elapsed/remaining reading time; three round speed-down / Play-Pause / speed-up buttons; host-confirmed multiplier; two rectangular paragraph controls; and one small round sliders button. All icon-only controls have localized accessible names. No decorative colored track segments, blue glow or captions are added. Green denotes an actual approved ready connection only.

The bottom sliders button opens a nonmodal dark quick sheet with only font size, line spacing and text width. Thumb movement is local input feedback; numeric readouts use host-confirmed values. Inputs are coalesced to 200ms and flushed at gesture release/blur. Opening reserves space for the timeline, full Play circle and multiplier; paragraph navigation and its normal bottom trigger are covered/hidden. Close and Escape restore the sliders trigger after layout completes. Playback is not paused on opening/closing. On landscape the sheet occupies the text side, leaving playback accessible; secondary content scrolls within bounded surfaces.

The gear opens a separate dark modal containing connection, existing pre-start countdown, text visibility/expanded view and consent status, horizontal/vertical mirror, reading guide, remote fullscreen/viewport fallback, language and capability-aware feedback. It does not add a fictitious duration-limited timer. Expanded text is subordinate, not a primary Text tab. Revoked sessions require a fresh host invitation; the settings explain this instead of reusing credentials. The host is called Studio, without inventing hardware model/battery information.

## Shared tokens and accessibility

`--radius-base:20px` is used for normal rectangular surfaces, menus and cards; `--radius-pill:9999px` for capsules; 50% with equal dimensions for circles. The small timeline thumb/markers and handle are pill/circle primitives. Repeated arbitrary 12–32px surface values were consolidated. Neutral surface/ink/focus tokens are inherited by controls, menus, dialogs and sheets. SVG chevrons use a centered 20px grid and stable line height. Import is a centered flex file label. Button typography is slightly larger/bolder while small toolbar text remains 12–13px for usable layout.

The shell is bounded, with safe-area/dvh/VisualViewport handling. Lists, editor, remote text and sheets scroll internally. Portrait 375×667 retains usable circles and touch targets; it reduces text area instead of making controls tiny. Landscape reorganizes text and controls in two columns. Native dialog provides focus containment; explicit cleanup restores focus even when conditionally unmounted. Popover keyboard/collision handling and its native-select/dialog fallback are retained. Reduced motion disables entry animations.

## Deliberate visual/practical differences

The browser UI does not draw a fake iPhone frame, notch, system clock or home indicator. Real content and typography values replace the illustration's hardcoded text/numbers; at position zero the timeline correctly shows 00:00. Reading-time estimates derive from the existing 40 CSS px/sec × multiplier engine, not fabricated recording duration. The quick sheet has an explicit Close button for keyboard/touch accessibility and scrolls on short viewports. Its closed-state trigger is hidden under the open sheet, matching the approved open composition; Escape/Close restore it. Device/browser chrome and physical font rendering cannot be pixel-certified by emulation.

See ../engineering/TELEO_PAIRING_AND_SYNC_V06.md for protocol/authority and ../audits/TELEO_UI_AUDIT_V06.md for actual verification.
