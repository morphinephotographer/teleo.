#!/bin/bash
# Builds teleo..app (universal: Apple silicon + Intel) and an installer DMG.
# Usage: apps/desktop/build.sh            → apps/desktop/dist/teleo-<version>.dmg
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo 1.0.0)"
BUILD="$(date +%Y%m%d%H%M)"
OUT="dist"
APP="$OUT/teleo..app"
ICON_SRC="$ROOT/apps/web/public/mac-icons/teleo_white_matte_fullbleed_v1-1024.png"

rm -rf "$OUT" && mkdir -p "$OUT"

echo "▸ Compiling (release, universal)"
swift build -c release --arch arm64 --arch x86_64
BIN="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/TeleoDesktop"

echo "▸ Assembling bundle"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/teleo"
strip -x "$APP/Contents/MacOS/teleo" || true
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD/" Info.plist > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"

echo "▸ App icon"
ICONSET="$OUT/AppIcon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf "$ICONSET"

echo "▸ Signing (ad-hoc)"
codesign --force --deep --sign - --timestamp=none "$APP"
codesign --verify --strict --verbose=2 "$APP"
plutil -lint "$APP/Contents/Info.plist"
lipo -info "$APP/Contents/MacOS/teleo"

echo "▸ DMG"
STAGE="$OUT/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/teleo-$VERSION.dmg"
hdiutil create -volname "teleo." -srcfolder "$STAGE" -ov -format UDZO -imagekey zlib-level=9 "$DMG" >/dev/null
rm -rf "$STAGE"
( cd "$OUT" && ditto -c -k --keepParent "teleo..app" "teleo-$VERSION-app.zip" )
ls -lh "$OUT"
echo "✓ $DMG"
