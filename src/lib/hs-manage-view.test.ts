import { it } from "node:test";
import assert from "node:assert/strict";
import { manageHref, readManageView } from "./hs-manage-view";

it("non-admins never get the manage view, even from a shared link", () => {
  assert.deepEqual(readManageView(new URLSearchParams("view=manage&edit=abc"), false), { manage: false, editId: null, startNew: false });
});
it("admins open the editor on a specific document", () => {
  assert.deepEqual(readManageView(new URLSearchParams("view=manage&edit=abc"), true), { manage: true, editId: "abc", startNew: false });
});
it("older RAMS edit links still open the manage view", () => {
  assert.equal(readManageView(new URLSearchParams("view=edit"), true).manage, true);
});
it("builds links for editing and creating", () => {
  assert.equal(manageHref("/toolbox-talks", { editId: "t1" }), "/toolbox-talks?view=manage&edit=t1");
  assert.equal(manageHref("/rams", { startNew: true }), "/rams?view=manage&new=1");
});
