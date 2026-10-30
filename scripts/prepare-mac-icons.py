"""Extract original PNG representations from ICNS; never redraw or re-encode them."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "apps/web/public/mac-icons"
VARIANTS = ("black_glossy", "black_matte", "white_glossy", "white_matte")
SIZES = {"ic11": 32, "ic07": 128, "ic08": 256, "ic09": 512, "ic10": 1024}
DEST.mkdir(parents=True, exist_ok=True)
evidence = {}
with zipfile.ZipFile(sys.argv[1]) as archive:
    for variant in VARIANTS:
        name = f"teleo_{variant}"
        original = archive.read(name + ".icns")
        assert original[:4] == b"icns" and struct.unpack(">I", original[4:8])[0] == len(original)
        (DEST / (name + ".icns")).write_bytes(original)
        hashes = {"icns": hashlib.sha256(original).hexdigest()}
        offset = 8
        while offset < len(original):
            kind = original[offset:offset + 4].decode("ascii")
            length = struct.unpack(">I", original[offset + 4:offset + 8])[0]
            assert length >= 8 and offset + length <= len(original)
            payload = original[offset + 8:offset + length]
            if kind in SIZES:
                size = SIZES[kind]
                assert payload.startswith(b"\x89PNG\r\n\x1a\n")
                assert struct.unpack(">II", payload[16:24]) == (size, size)
                (DEST / f"{name}-{size}.png").write_bytes(payload)
                hashes[str(size)] = hashlib.sha256(payload).hexdigest()
            offset += length
        assert all(str(size) in hashes for size in SIZES.values())
        evidence[variant] = hashes
        manifest = {
            "id": "/studio", "name": "teleo.", "short_name": "teleo.",
            "start_url": "/studio", "scope": "/", "display": "standalone",
            "background_color": "#f5f5f7", "theme_color": "#09090B",
            "icons": [{"src": f"/mac-icons/{name}-{size}.png",
                       "sizes": f"{size}x{size}", "type": "image/png", "purpose": "any"}
                      for size in (256, 512, 1024)],
        }
        (DEST / f"{variant}.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n")
# Chromium's install metadata also needs a 192px representation. The native
# macOS converter only resizes; the ICNS and extracted PNGs remain untouched.
subprocess.run([
    "sips", "--resampleHeightWidth", "192", "192",
    str(DEST / "teleo_white_glossy-1024.png"),
    "--out", str(DEST / "teleo_white_glossy-192.png"),
], check=True, capture_output=True)
default_manifest = json.loads((DEST / "white_glossy.webmanifest").read_text())
default_manifest["icons"].insert(0, {
    "src": "/mac-icons/teleo_white_glossy-192.png", "sizes": "192x192",
    "type": "image/png", "purpose": "any",
})
(DEST.parent / "manifest.webmanifest").write_text(json.dumps(default_manifest, indent=2) + "\n")
provenance = ROOT / "design-references/mac-icons-provenance.json"
provenance.write_text(json.dumps({"source": "teleo_icons_icns.zip", "extraction": "original embedded PNG bytes, no conversion", "variants": evidence}, indent=2) + "\n")
print("Preserved 4 ICNS originals, extracted 20 exact PNGs, and prepared the white glossy default manifest + 192px PNG.")
