import { test } from "node:test";
import assert from "node:assert/strict";
import { countInboxThreads, countUnreadInboxTickets, tabCountLabel } from "./inbox-counts";

test("inbox badge counts unread threads only", () => {
  assert.equal(
    countUnreadInboxTickets([
      { is_read: false, is_filed: false },
      { is_read: true, is_filed: false },
      { is_read: false, is_filed: false },
    ]),
    2,
  );
});

test("inbox badge ignores filed threads even when unread", () => {
  assert.equal(
    countUnreadInboxTickets([
      { is_read: false, is_filed: true },
      { is_read: true, is_filed: true },
    ]),
    0,
  );
});

test("inbox badge treats missing flags as unread and not filed", () => {
  assert.equal(countUnreadInboxTickets([{}]), 1);
});

test("inbox badge is zero for an empty inbox", () => {
  assert.equal(countUnreadInboxTickets([]), 0);
});

test("inbox badge counts every thread in the inbox, read or not", () => {
  assert.equal(
    countInboxThreads([
      { is_read: false, is_filed: false },
      { is_read: true, is_filed: false },
      { is_read: true, is_filed: true },
    ]),
    2,
  );
});

test("inbox badge ignores filed threads whatever their read state", () => {
  assert.equal(
    countInboxThreads([
      { is_read: false, is_filed: true },
      { is_read: true, is_filed: true },
    ]),
    0,
  );
});

test("tab badge hides at zero and shows the exact number under 1000", () => {
  assert.equal(tabCountLabel(0), null);
  assert.equal(tabCountLabel(7), "7");
  assert.equal(tabCountLabel(999), "999");
});

test("tab badge shortens big numbers so the tab does not stretch", () => {
  assert.equal(tabCountLabel(1000), "1k");
  assert.equal(tabCountLabel(2906), "2.9k");
  assert.equal(tabCountLabel(18560), "19k");
});
