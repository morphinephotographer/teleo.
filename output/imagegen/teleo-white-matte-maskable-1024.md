# Teleo white matte — full-bleed web icon

Output: `teleo-white-matte-maskable-1024.png`, 1024×1024 RGB PNG, no alpha.
Prepared with the built-in imagegen tool, followed by standard macOS `sips`
resizing from the generated 1254×1254 image to the requested 1024×1024.
This is an edited derivative, not a byte-identical extraction of the artwork.
The original ICNS and website configuration were not changed.

Input: `~/Downloads/teleo_icons_icns/teleo_white_matte.icns`.
Its original embedded 1024px PNG was used as the edit target. Original ICNS SHA-256:
`3cb346d30b492314ab003c64e4c536a7adc85a46671c0b3eab4e9db42c13a7d2`.

## Exact imagegen prompt

Use case: precise-object-edit. Edit target: the supplied original Teleo white matte app icon PNG. Create ONE production web app icon PNG, exactly 1024 x 1024 pixels, fully opaque full-bleed square, appropriate for a maskable web-app icon. Change ONLY the outer tile treatment: extend the original soft matte off-white/light neutral gray surface seamlessly all the way to the four straight square edges and corners; remove the rounded-square silhouette, transparent corner regions, thin outer perimeter rim/bevel, and external drop shadow. The final whole canvas is the matte surface, with NO icon-on-background presentation, no border, no inset tile, no frame, no transparent margins, no rounded outer corners. Preserve the original central artwork as exactly as possible: verbatim black lowercase 'teleo.' lettering with identical font appearance, size, position, spacing and shape; the two long medium-gray rounded horizontal lines below, third shorter gray line below them, and the slim black vertical cursor immediately right of the third line. Preserve the positions, proportions, edge detail, gray colors and understated matte shading of this central artwork. Do not reinterpret the logo, do not add or remove any central graphic element, do not center or resize the artwork differently. Do not introduce gloss, glass, sparkles, lighting changes, decorative elements or new text. Output must be an actual flat edge-to-edge square image, opaque at every pixel including all corners.

Imagegen transparency option: `false`.
