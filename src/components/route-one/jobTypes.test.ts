import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SOLID_HEX } from "./jobTypes";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrastWithWhite = (hex: string) => 1.05 / (lum(hex) + 0.05);

describe("Route One ticket colours", () => {
  for (const [name, hex] of Object.entries(SOLID_HEX)) {
    it(`${name} keeps white text readable (WCAG AA 4.5:1)`, () => {
      assert.ok(contrastWithWhite(hex) >= 4.5, `${hex}`);
    });
  }
});
