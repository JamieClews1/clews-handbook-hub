import { describe, expect, it } from "bun:test";
import { DEFAULT_WTN_TEMPLATE, renderWtnSheet, withTestMarker } from "./wtn-ticket-template";

const vars = { ticket_number: "WB000002", customer: "Test Co" };

describe("test-mode marker on printed tickets", () => {
  it("stamps both copies when the ticket is a test", () => {
    const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, vars, "WTN WB000002", { testMode: true });
    expect(html.match(/data-wtn-test/g)).toHaveLength(2);
    expect(html).toContain("TEST TICKET — NOT A REAL WASTE TRANSFER NOTE");
  });

  it("leaves a real ticket untouched", () => {
    const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, vars, "WTN WB000003", { testMode: false });
    expect(html).not.toContain("data-wtn-test");
    expect(html).not.toContain("TEST TICKET");
  });

  it("marks copies that are not the default wtn-copy markup", () => {
    expect(withTestMarker("<section><p>x</p></section>", true)).toContain("data-wtn-test");
    expect(withTestMarker("<section><p>x</p></section>", false)).toBe("<section><p>x</p></section>");
  });
});
