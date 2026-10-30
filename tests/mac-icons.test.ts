import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import provenance from "../design-references/mac-icons-provenance.json";

describe("Mac installation assets", () => {
  for (const id of Object.keys(
    provenance.variants,
  ) as (keyof typeof provenance.variants)[]) {
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
    });
  }
  it("uses only white glossy icons in the default manifest and HTML", () => {
    const manifest = JSON.parse(
      readFileSync("apps/web/public/manifest.webmanifest", "utf8"),
    );
    expect(manifest).toMatchObject({
      id: "/studio",
      start_url: "/studio",
      scope: "/",
      name: "teleo.",
      display: "standalone",
    });
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      ["192x192", "256x256", "512x512", "1024x1024"],
    );
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/mac-icons\/teleo_white_glossy-\d+\.png$/);
      const bytes = readFileSync(`apps/web/public${icon.src}`);
      expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(
        icon.sizes,
      );
      expect(icon.purpose).toBe("any");
    }
    const html = readFileSync("apps/web/index.html", "utf8");
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(html).toContain('href="/mac-icons/teleo_white_glossy-1024.png"');
    expect(html).toContain('href="/mac-icons/teleo_white_glossy-32.png"');
    expect(html).not.toContain("black_matte");
  });
});
