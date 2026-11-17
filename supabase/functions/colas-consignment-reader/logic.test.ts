import { assertEquals } from "jsr:@std/assert@1";
import { decide, londonHour, pickCandidates, cleanCode, type AiReading } from "./logic.ts";

const found = (code: string, confidence: AiReading["confidence"] = "high"): AiReading => ({ status: "found", consignment_code: code, confidence, evidence: "seen" });

Deno.test("saves a certain COLASR number and clears any reading flag", () => {
  const d = decide(found("COLASR/00185"), { job_number: "51354", consignment_ref: null, read_issue: "unreadable" }, new Map(), "51354");
  assertEquals(d.applied, "saved");
  assertEquals(d.write, { consignment_ref: "COLASR/00185", read_issue: null });
});

Deno.test("never overwrites a number already saved", () => {
  const d = decide(found("COLASR/00999"), { job_number: "1", consignment_ref: "COLASR/00185", read_issue: null }, new Map(), "1");
  assertEquals(d.applied, "kept_existing");
  assertEquals(d.write, null);
});

Deno.test("an uncertain or malformed reading is flagged as can't read, not saved", () => {
  assertEquals(decide(found("COLASR/0018"), undefined, new Map(), "1").write, { consignment_ref: null, read_issue: "unreadable" });
  assertEquals(decide(found("COLASR/00185", "medium"), undefined, new Map(), "1").write, { consignment_ref: null, read_issue: "unreadable" });
});

Deno.test("a number already on another job is not saved twice", () => {
  const d = decide(found("COLASR/00185"), undefined, new Map([["COLASR/00185", "51354"]]), "51355");
  assertEquals(d.result, "unreadable");
  assertEquals(d.write?.consignment_ref, null);
});

Deno.test("missing consignment page flags page missing, but keeps a reading problem staff chose", () => {
  const r: AiReading = { status: "not_present", consignment_code: null, confidence: "high", evidence: "" };
  assertEquals(decide(r, undefined, new Map(), "1").write, { consignment_ref: null, read_issue: "page_missing" });
  assertEquals(decide(r, { job_number: "1", consignment_ref: null, read_issue: "unreadable" }, new Map(), "1").write, null);
});

Deno.test("tidies spacing in a read code", () => {
  assertEquals(cleanCode("colasr 00185"), "COLASR/00185");
});

Deno.test("5pm London is 17:00 UTC in winter and 16:00 UTC in summer", () => {
  assertEquals(londonHour(new Date("2026-11-17T17:00:00Z")), 17);
  assertEquals(londonHour(new Date("2026-07-01T16:00:00Z")), 17);
  assertEquals(londonHour(new Date("2026-07-01T17:00:00Z")), 18);
});

Deno.test("only hazardous jobs with an unread, parsed scan and no saved number are picked", () => {
  const hz = new Set(["15 02 02"]);
  const jobs = [
    { job_number: "A", job_date: "2026-11-05", ewc: "15 02 02*" },
    { job_number: "B", job_date: "2026-11-06", ewc: "15 01 01" },
    { job_number: "C", job_date: "2026-11-07", ewc: "150202" },
    { job_number: "D", job_date: "2026-11-08", ewc: "15 02 02" },
    { job_number: "E", job_date: "2026-11-09", ewc: "15 02 02" },
  ];
  const docs = [
    { id: "a1", job_number: "A", file_name: "JOBA.PDF", parse_status: "parsed", created_at: "2026-11-06" },
    { id: "b1", job_number: "B", file_name: "JOBB.PDF", parse_status: "parsed", created_at: "2026-11-06" },
    { id: "c1", job_number: "C", file_name: "JOBC.PDF", parse_status: "parsed", created_at: "2026-11-08" },
    { id: "d1", job_number: "D", file_name: "JOBD.PDF", parse_status: "pending", created_at: "2026-11-09" },
    { id: "e1", job_number: "E", file_name: "JOBE.PDF", parse_status: "parsed", created_at: "2026-11-10" },
  ];
  const existing = new Map([["E", { job_number: "E", consignment_ref: "COLASR/00001", read_issue: null }]]);
  const { batch } = pickCandidates(jobs, hz, existing, docs, new Set(["C|c0"]));
  assertEquals(batch.map(b => b.job.job_number), ["C", "A"]);
  const again = pickCandidates(jobs, hz, existing, docs, new Set(["C|c1", "A|a1"]));
  assertEquals(again.batch.length, 0);
});
