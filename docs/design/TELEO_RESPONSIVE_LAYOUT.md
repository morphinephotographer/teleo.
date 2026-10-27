# Responsive layout

The body/root never scroll. A viewport-constrained flex shell owns a fixed-height toolbar and a min-height-zero workspace. `100vh` precedes `100dvh` as a fallback. Content regions explicitly own overflow; truncating entire pages is not the strategy.

| Width | Workspace behavior |
| --- | --- |
| >1180 px | collapsible library, editor and reading preview |
| 901–1180 px | collapsible library and large editor; Read opens real prompter |
| 601–900 px | single document region, library overlay, compact desktop toolbar |
| <=600 px | two-row toolbar with mode capsule/locale, single region, contextual script actions, bottom settings sheet |

The reader has its own scrolling text viewport. Controls and seek sit outside it, reserving room so the dock cannot cover the current text region. Narrow phones split the dock into grouped rows; short landscape uses a compact horizontal dock. All mirror transforms affect text only. In immersive mode the reader fills the viewport and respects safe-area padding. Native Fullscreen API is optional.

The editor textarea and library list scroll internally. Advanced settings, long help/privacy documents, revision history and pairing panels have bounded internal scroll. Settings uses a right floating dialog on desktop and a rounded bottom sheet on phones. Phone library is an overlay; initial empty state still offers a working New script action.

The mobile editor shell tracks `visualViewport.height` and `offsetTop`, including resize and scroll events, with dynamic viewport fallbacks. HTML adds viewport-fit=cover and interactive-widget=resizes-content for browsers that honor them. No maximum-scale or disabled zoom is used. Browser/chrome/keyboard behavior still requires physical iOS verification; a synthetic VisualViewport test is not device evidence.

Required QA sizes: 1440×900, 1280×800, 1024×768, 834×1112, 390×844, 375×667 and 844×390. Earlier compact checks at 1440×800, 1024×700, 390×664, 320×568 remain. Tests check document overflow, visible editor/dock, usable settings and internal text playback, not just screenshots. Snapshots contain generated review copy only.
