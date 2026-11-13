import { test } from "node:test";
import assert from "node:assert/strict";
import { countUnreadInboxTickets, tabCountLabel } from "./inbox-counts";

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

test("tab badge hides at zero and shows the number up to 99", () => {
  assert.equal(tabCountLabel(0), null);
  assert.equal(tabCountLabel(7), "7");
  assert.equal(tabCountLabel(99), "99");
});

test("tab badge caps at 99+ so the tab does not stretch", () => {
  assert.equal(tabCountLabel(100), "99+");
  assert.equal(tabCountLabel(1856), "99+");
});
