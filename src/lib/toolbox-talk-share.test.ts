import { describe, expect, it } from "vitest";
import { guestSignerLabel, mergeTalkSignatures, toolboxTalkShareUrl } from "./toolbox-talk-share";

describe("toolbox talk share links", () => {
  it("builds the public link from the site address and token", () => {
    expect(toolboxTalkShareUrl("https://portal.clewsrecycling.co.uk/", "abc123def")).toBe(
      "https://portal.clewsrecycling.co.uk/talk/abc123def",
    );
  });

  it("marks link signers as signed via link, with their company", () => {
    expect(guestSignerLabel({ signer_name: "Tom Smith", company_name: "Agency Ltd" })).toBe(
      "Tom Smith (Agency Ltd) - signed via link",
    );
    expect(guestSignerLabel({ signer_name: "Tom Smith", company_name: null })).toBe("Tom Smith - signed via link");
  });

  it("keeps every staff and link signature, oldest first", () => {
    const merged = mergeTalkSignatures(
      [{ id: "s1", user_id: "u1", signed_at: "2026-11-18T09:00:00Z", signature_image: null, name: "Ryan" }],
      [{ id: "g1", signer_name: "Tom", company_name: null, job_title: null, signed_at: "2026-11-18T08:00:00Z", signature_image: "data:image/png;base64,x" }],
    );
    expect(merged.map((s) => s.id)).toEqual(["g1", "s1"]);
    expect(merged[0].name).toBe("Tom - signed via link");
  });
});
