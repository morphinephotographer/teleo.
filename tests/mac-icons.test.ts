import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import provenance from "../design-references/mac-icons-provenance.json";
import { dictionaries } from "../apps/web/src/i18n";
import { macIcons, validMacIcon } from "../apps/web/src/mac-icons";

describe("Mac installation assets", () => {
  for (const { id, label } of macIcons) {
    it(`${id}: preserves originals and exact embedded PNGs with one app identity`, () => {
      const root = "apps/web/public/mac-icons/";
      const hashes = provenance.variants[id];
      for (const [size, hash] of Object.entries(hashes)) {
        const suffix = size === "icns" ? ".icns" : `-${size}.png`;
        const bytes = readFileSync(`${root}teleo_${id}${suffix}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
        if (size !== "icns") {
          expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
          expect(bytes.readUInt32BE(16)).toBe(Number(size));
          expect(bytes.readUInt32BE(20)).toBe(Number(size));
        }
      }
      const manifest = JSON.parse(
        readFileSync(`${root}${id}.webmanifest`, "utf8"),
      );
      expect(manifest).toMatchObject({
        id: "/studio",
        start_url: "/studio",
        scope: "/",
        name: "teleo.",
      });
      for (const icon of manifest.icons) {
        expect(icon.purpose).toBe("any");
        expect(
          readFileSync(`apps/web/public${icon.src}`).length,
        ).toBeGreaterThan(0);
      }
      for (const locale of ["en", "ru", "uk"] as const)
        expect(dictionaries[locale][label]).toBeTruthy();
    });
  }
  it("falls back safely from missing or invalid local choices", () => {
    expect(validMacIcon(null)).toBe("black_matte");
    expect(validMacIcon("../../other")).toBe("black_matte");
    expect(validMacIcon("white_glossy")).toBe("white_glossy");
  });
});
