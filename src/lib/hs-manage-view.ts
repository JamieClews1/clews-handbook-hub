/**
 * Admin "Manage" view on the RAMS and Toolbox Talks pages, driven by the address so the
 * Admin area, detail pages and bookmarks can open the editor straight on a document.
 * Only admins act on it; everyone else always sees the documents list.
 */
export interface ManageView { manage: boolean; editId: string | null; startNew: boolean }

export function readManageView(params: URLSearchParams, isAdmin: boolean): ManageView {
  if (!isAdmin) return { manage: false, editId: null, startNew: false };
  const view = params.get("view");
  const manage = view === "manage" || view === "edit"; // "edit" kept for older RAMS links
  return { manage, editId: manage ? params.get("edit") : null, startNew: manage && params.get("new") === "1" };
}

export function manageHref(base: "/rams" | "/toolbox-talks", opts: { editId?: string; startNew?: boolean } = {}): string {
  const p = new URLSearchParams({ view: "manage" });
  if (opts.editId) p.set("edit", opts.editId);
  else if (opts.startNew) p.set("new", "1");
  return `${base}?${p.toString()}`;
}
