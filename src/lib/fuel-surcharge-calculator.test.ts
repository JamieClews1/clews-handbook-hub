import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (a: unknown) => ({ toBe: (b: unknown) => assert.equal(a, b) });
import { calculateFuelSurcharges, DEFAULT_FUEL_CALC_SETTINGS } from "./fuel-surcharge-calculator";

const get = (price: number, v: string, z: string) =>
  calculateFuelSurcharges(price, DEFAULT_FUEL_CALC_SETTINGS).find((r) => r.vehicle === v && r.zone === z)!.surcharge;

describe("fuel surcharge calculator at £1.45/litre matches the 1 April rates", () => {
  test("Weighbridge Tip £3.10", () => expect(get(1.45, "Weighbridge Tip", "NA")).toBe(3.1));
  test("Skips £4.43 / £6.53 / £8.44", () => {
    expect(get(1.45, "Skips", "Zone 1")).toBe(4.43);
    expect(get(1.45, "Skips", "Zone 2")).toBe(6.53);
    expect(get(1.45, "Skips", "Zone 3")).toBe(8.44);
  });
  test("RoRo £4.95 / £7.87 / £11.58", () => {
    expect(get(1.45, "RoRo", "Zone 1")).toBe(4.95);
    expect(get(1.45, "RoRo", "Zone 2")).toBe(7.87);
    expect(get(1.45, "RoRo", "Zone 3")).toBe(11.58);
  });
  test("Artic £5.57 / £9.46 / £14.41", () => {
    expect(get(1.45, "Artic", "Zone 1")).toBe(5.57);
    expect(get(1.45, "Artic", "Zone 2")).toBe(9.46);
    expect(get(1.45, "Artic", "Zone 3")).toBe(14.41);
  });
  test("at the £1.10 base price the processing levy drops to £0", () => {
    expect(get(1.1, "Weighbridge Tip", "NA")).toBe(0);
    expect(get(1.1, "Skips", "Zone 3")).toBe(0);
  });
  test("the tip levy scales with the % increase (half the increase → half the levy)", () => {
    // £1.275 is halfway between the £1.10 base and the £1.45 reference
    expect(get(1.275, "Weighbridge Tip", "NA")).toBe(1.55);
  });
});
