import { it } from "node:test";
import assert from "node:assert/strict";
import { operationalForecast } from "./insights-forecast";
it("uses this year's matched run-rate for prior-year seasonality", () => { assert.equal(operationalForecast(Array(12).fill(200), Array(12).fill(100), 2026, 9, "seasonal")?.[11], 200); });
it("missing source months never become a zero forecast base", () => { assert.equal(operationalForecast([200, null, ...Array(10).fill(200)], Array(12).fill(100), 2026, 9, "average"), null); });
it("latest three completed months determine the recent method", () => { assert.equal(operationalForecast([100,100,100,300,300,300,...Array(6).fill(null)], Array(12).fill(100), 2026, 6, "recent")?.[6], 300); });