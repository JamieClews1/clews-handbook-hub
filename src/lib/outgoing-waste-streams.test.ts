import { describe, it, expect } from "vitest";
import { outgoingStream } from "./outgoing-waste-streams";

describe("outgoingStream", () => {
  it("groups both paper EWC codes as Paper / Card", () => {
    expect(outgoingStream("19 12 01")).toBe("Paper / Card");
    expect(outgoingStream("15 01 01")).toBe("Paper / Card");
  });
  it("falls back to description when EWC unknown", () => {
    expect(outgoingStream("", "paper and cardboard")).toBe("Paper / Card");
    expect(outgoingStream(null, "mystery")).toBe("Other");
  });
});
