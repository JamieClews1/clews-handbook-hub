import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  loadSeenMap,
  markNotesSeen,
  notesBadgeLabel,
  notesKeyFor,
  unreadNoteCount,
  unreadNotes,
  type NoteStamp,
} from "./rental-notes-unread";

function fakeStore(seed: Record<string, string> = {}) {
  const data: Record<string, string> = { ...seed };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => { data[key] = value; },
    data,
  };
}

const notes: NoteStamp[] = [
  { created_at: "2026-10-16T09:00:00.000Z" },
  { created_at: "2026-10-16T10:00:00.000Z" },
  { created_at: "2026-10-16T11:00:00.000Z" },
];

test("a thread that was never opened has every note still to read", () => {
  assert.equal(unreadNoteCount(notes, null), 3);
  assert.equal(unreadNoteCount(notes, undefined), 3);
});

test("only notes written after the last visit count as to read", () => {
  assert.deepEqual(unreadNotes(notes, "2026-10-16T10:00:00.000Z"), [notes[2]]);
  assert.equal(unreadNoteCount(notes, "2026-10-16T11:30:00.000Z"), 0);
});

test("marking seen stores the read point per user and thread, and it reads back", () => {
  const store = fakeStore();
  const next = markNotesSeen("jamie", "bin:RECO|Site A|8yd", "2026-10-16T10:00:00.000Z", store);
  assert.equal(next["bin:RECO|Site A|8yd"], "2026-10-16T10:00:00.000Z");
  assert.equal(loadSeenMap("jamie", store)["bin:RECO|Site A|8yd"], "2026-10-16T10:00:00.000Z");
  // another user is untouched — reading for Jamie must not mark them read
  assert.deepEqual(loadSeenMap("laura", store), {});
  // a second thread keeps the first one
  markNotesSeen("jamie", "agreement:abc", "2026-10-16T12:00:00.000Z", store);
  assert.equal(loadSeenMap("jamie", store)["bin:RECO|Site A|8yd"], "2026-10-16T10:00:00.000Z");
});

test("unusable stored data is treated as nothing read yet", () => {
  const store = fakeStore({ "rental-notes-seen:jamie": "not json {" });
  assert.deepEqual(loadSeenMap("jamie", store), {});
});

test("no user or no thread means nothing is tracked", () => {
  const store = fakeStore();
  assert.deepEqual(markNotesSeen(null, "bin:x", "2026-10-16T10:00:00.000Z", store), {});
  assert.deepEqual(markNotesSeen("jamie", null, "2026-10-16T10:00:00.000Z", store), {});
  assert.deepEqual(Object.keys(store.data), []);
});

test("bins are keyed by bin_key, agreements by id, and neither wins alone", () => {
  assert.equal(notesKeyFor({ binKey: "B|S|8yd" }), "bin:B|S|8yd");
  assert.equal(notesKeyFor({ binKey: "B|S|8yd", agreementId: "abc" }), "bin:B|S|8yd");
  assert.equal(notesKeyFor({ agreementId: "abc" }), "agreement:abc");
  assert.equal(notesKeyFor({}), null);
});

test("the badge label stays short", () => {
  assert.equal(notesBadgeLabel(0), "0");
  assert.equal(notesBadgeLabel(3), "3");
  assert.equal(notesBadgeLabel(9), "9");
  assert.equal(notesBadgeLabel(14), "9+");
});
