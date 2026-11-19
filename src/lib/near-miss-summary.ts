// Presentation helpers for saved near-miss review summaries (read-only).

export type ActionCategory = "retraining" | "toolbox_talk" | "risk_assessment" | "disciplinary" | "other";
export interface SummaryAction {
  category: ActionCategory; action: string; reason: string; owner: string; priority: "high" | "medium" | "low"; reports: string[]; existing_document: string | null;
}
export interface NearMissSummaryContent {
  headline: string; overview: string; risk_level: "low" | "medium" | "high";
  themes: { title: string; detail: string; reports: string[] }[];
  actions: SummaryAction[]; discussion_points: string[]; data_gaps: string[];
}
export interface SavedNearMissSummary {
  id: string; created_at: string; period_from: string | null; period_to: string; report_count: number; report_ids: string[]; summary: NearMissSummaryContent;
}

export const CATEGORY_ORDER: { key: ActionCategory; label: string }[] = [
  { key: "retraining", label: "Retraining" },
  { key: "toolbox_talk", label: "Toolbox Talks" },
  { key: "risk_assessment", label: "Risk Assessments" },
  { key: "disciplinary", label: "Disciplinary" },
  { key: "other", label: "Other actions" },
];

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Every category in meeting order (empty ones included), high priority first. */
export function groupActions(actions: SummaryAction[]) {
  return CATEGORY_ORDER.map(c => ({
    ...c,
    actions: actions.filter(a => a.category === c.key).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
  }));
}

/** Reports created after the latest saved summary — those the next summary would cover. */
export function reportsSinceLast<T extends { created_at: string }>(reports: T[], lastPeriodTo: string | null): T[] {
  if (!lastPeriodTo) return reports;
  const start = Date.parse(lastPeriodTo);
  return reports.filter(r => Date.parse(r.created_at) > start);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function periodLabel(s: Pick<SavedNearMissSummary, "period_from" | "period_to">) {
  return s.period_from ? `${fmt(s.period_from)} to ${fmt(s.period_to)}` : `All reports up to ${fmt(s.period_to)}`;
}

/** Printable meeting sheet. Report list rows: { ref, date, location, description }. */
export function summaryPrintHtml(s: SavedNearMissSummary, reports: { ref: string; date: string; location: string; description: string }[]) {
  const c = s.summary;
  const refs = (r: string[]) => r.length ? ` <span class="refs">(${esc(r.join(", "))})</span>` : "";
  const groups = groupActions(c.actions).map(g => `
    <h3>${esc(g.label)}</h3>
    ${g.actions.length ? `<ul>${g.actions.map(a => `<li><b>${esc(a.action)}</b>${refs(a.reports)}<br/><span class="meta">${esc(a.owner)} · ${a.priority} priority${a.existing_document ? ` · Use: ${esc(a.existing_document)}` : ""}</span><br/>${esc(a.reason)}</li>`).join("")}</ul>` : `<p class="none">No action suggested.</p>`}`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Near miss summary</title><style>
    body{font-family:Arial,sans-serif;font-size:11pt;color:#1a1a1a;margin:18mm}
    h1{font-size:18pt;margin:0 0 4px} h2{font-size:13pt;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px} h3{font-size:11.5pt;margin:12px 0 4px}
    .meta,.refs{color:#555;font-size:9.5pt} .none{color:#666;font-style:italic} li{margin-bottom:6px} p{white-space:pre-wrap;margin:4px 0}
    table{border-collapse:collapse;width:100%;font-size:9.5pt} td,th{border:1px solid #ccc;padding:4px;text-align:left;vertical-align:top}
    .note{font-size:9pt;color:#555;margin-top:16px}
  </style></head><body>
    <h1>Near miss review summary</h1>
    <div class="meta">${esc(periodLabel(s))} · ${s.report_count} report${s.report_count === 1 ? "" : "s"} · Risk level: ${esc(c.risk_level)}</div>
    <h2>Summary</h2><p><b>${esc(c.headline)}</b></p><p>${esc(c.overview)}</p>
    ${c.themes.length ? `<h2>Themes</h2><ul>${c.themes.map(t => `<li><b>${esc(t.title)}</b>${refs(t.reports)}<br/>${esc(t.detail)}</li>`).join("")}</ul>` : ""}
    <h2>Suggested actions</h2>${groups}
    ${c.discussion_points.length ? `<h2>Points to discuss with Transport and Yard Managers</h2><ul>${c.discussion_points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    ${c.data_gaps.length ? `<h2>Missing information</h2><ul>${c.data_gaps.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    <h2>Reports included</h2><table><tr><th>Ref</th><th>Date</th><th>Location</th><th>Description</th></tr>${reports.map(r => `<tr><td>${esc(r.ref)}</td><td>${esc(r.date)}</td><td>${esc(r.location)}</td><td>${esc(r.description)}</td></tr>`).join("")}</table>
    <p class="note">Suggestions prepared with Claude AI from the near miss reports only. Any disciplinary step must follow the company disciplinary procedure after a fair investigation.</p>
  </body></html>`;
}
