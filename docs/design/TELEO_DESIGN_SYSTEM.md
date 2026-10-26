# teleo. web design system

## Direction

The owner's Complete Website UI/UX Redesign brief (2026-10-26) replaces the marketing-first entry and extends the compact monochrome redesign. The supplied reference images guide capsule selectors, black selection states, restrained borders and rounded white surfaces; no screenshot is copied literally. Brand remains `teleo.`. No external fonts, icon packages, image downloads or animation dependencies are required.

## Tokens

| Token | Default | Purpose |
| --- | --- | --- |
| canvas | #F5F5F7 | application window |
| surface | #FFFFFF | documents and panels |
| subtle | #F0F0F2 | quiet controls, selected documents |
| ink | #111111 | text, primary actions, selected segment |
| muted | #6B6B70 | secondary labels |
| line | #E5E5E7 | hairline separation |
| reader | #080809 / #F8F8FA | reading background / text |
| radius | 28 px | desktop surfaces |
| toolbar | 64 px | compact app header |

System sans-serif typography follows a restrained scale: 10–12 px metadata, 13–14 px controls, 16–17 px editing copy, 24–36 px document titles, 32–56 px empty/help headings. User reading size remains adjustable from 16 to 100 px. Dark and automatic interface themes use local UI tokens without altering portable script appearance. Reader light/dark is separately stored in existing per-script preferences.

## Components

- `Icon`: local inline SVG, fixed viewBox, currentColor, decorative/hidden from assistive technology.
- `IconButton`: circular target, accessible localized label/title, optional pressed/disabled state.
- `Segmented`: capsule group with transform-driven selection indicator and pressed-state buttons. Buttons retain normal Tab/Enter/Space navigation; this is a button group, not an incomplete ARIA tab widget.
- Primary pill: solid ink, surface text. Secondary pill: white/neutral with quiet border.
- Toggle: native checkbox semantics with CSS track/thumb, visible focus and checked state.
- `Sheet`: native HTML dialog with focus containment, Escape dismissal, focus restoration and backdrop.
- Reader dock: rounded dark tray, grouped speed/paragraph/text controls and dominant contrasting Play/Pause circle.

Small interactions use 180–220 ms opacity/transform/color transitions. Reduced-motion preference removes decorative animation. Hover is an enhancement; every action works by touch and keyboard. There are no fake loading states; disabled controls reflect the absence of a selected document. Standard icon targets are 44 px; dense desktop reader controls are 40 px with spacing. Phone dock targets are 44 px, with 52 px primary playback. The physical iPhone comfort/accessibility matrix remains necessary.
