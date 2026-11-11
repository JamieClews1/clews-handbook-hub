// Monthly walk around (operations inspection) checklist, digitised from the paper
// "Operations Inspection Sheet" for Unit 17, Hunters Lane Waste Transfer Station.

export type WalkAroundState = "acceptable" | "attention" | "na";
export type WalkAroundPriority = "high" | "medium" | "low";
export type WalkAroundActionStatus = "open" | "in_progress" | "done";

export const DEFAULT_WALK_AROUND_SITE = "Unit 17, Hunters Lane Waste Transfer Station";

export interface WalkAroundTemplateItem { key: string; label: string }
export interface WalkAroundTemplateSection { key: string; title: string; items: WalkAroundTemplateItem[] }

const section = (key: string, title: string, labels: string[]): WalkAroundTemplateSection => ({
  key,
  title,
  items: labels.map((label, i) => ({ key: `${key}-${String(i + 1).padStart(2, "0")}`, label })),
});

export const WALK_AROUND_TEMPLATE: WalkAroundTemplateSection[] = [
  section("hs", "Health and Safety", [
    "All staff issued with and wearing gloves, boots",
    "Eye protection & disposable overalls available",
    "COSHH assessments available",
    "Staff aware of COSHH and using PPE",
    "Accident book available and used",
    "RIDDOR regulations understood (Manager)",
    "Address of nearest Casualty Hospital displayed",
    "Names of First Aiders or similar displayed",
    "Emergency procedures available",
    "Emergency procedures understood",
    "Fire extinguishers – checked",
    "Fire extinguishers – locations known by staff",
    "Fire extinguishers – staff understand types and how to use",
    "Fires – any evidence of",
    "First Aid box location known by staff",
    "First Aid box stocked to minimum contents",
    "No drugs or alcohol on site understood by staff",
    "Reversing bleeper or flashing light on plant",
    "Plant drivers authorised CITB certified",
    "Plant serviced regularly",
    "Plant brakes tested regularly",
  ]),
  section("gen", "General Requirements", [
    "Reflective jackets/vests",
    "Direction signs clean and undamaged",
    "Traffic control",
    "Sufficient tipping space",
    "Queuing of vehicles for less than 2 minutes",
    "Recycling capacity",
    "Waste/litter outside of tipping bays",
    "Litter on access road",
    "Litter outside fences",
    "Fences – condition",
    "Gates – condition",
    "Walls – condition",
    "Mud on road",
    "Evidence of vermin",
    "Evidence of flies",
    "Fridges to be de-gassed stored acceptably",
    "De-gassed fridges marked for disposal",
    "Evidence of trade waste tipped",
    "Sufficient road markings",
    "Sufficient manpower",
    "Lights operational",
  ]),
  section("sto", "Storage", [
    "Oil tank bunds empty",
    "Oil tank area clean",
    "Waste paper container dry",
    "Waste paper bales/container uncontaminated",
    "Sufficient capacity – Bottle bays",
    "Sufficient capacity – Plastic bales",
    "Sufficient capacity – Plastic bottle bays",
    "Sufficient capacity – Greenwaste bays",
    "Sufficient capacity – Waste bays",
  ]),
];

export const STATE_LABEL: Record<WalkAroundState, string> = {
  acceptable: "Acceptable",
  attention: "Needs attention",
  na: "Not applicable",
};

/** Days allowed to complete a job, counted from the inspection date. */
export const PRIORITY_DAYS: Record<WalkAroundPriority, number> = { high: 2, medium: 7, low: 28 };
export const PRIORITY_LABEL: Record<WalkAroundPriority, string> = {
  high: "High – 2 days",
  medium: "Medium – 7 days",
  low: "Low – 28 days",
};

/** Adds whole calendar days to a YYYY-MM-DD date without timezone drift. */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dueDateFor(inspectionDate: string, priority: WalkAroundPriority): string {
  return addCalendarDays(inspectionDate, PRIORITY_DAYS[priority]);
}

/** Whole days from `today` until `due` (negative = overdue). */
export function daysUntil(due: string, today: string): number {
  const toUtc = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(due) - toUtc(today)) / 86400000);
}

export type ActionBucket = "overdue" | "this_week" | "later" | "done";
export const BUCKET_LABEL: Record<ActionBucket, string> = {
  overdue: "Overdue",
  this_week: "Due within 7 days",
  later: "Later",
  done: "Completed",
};

export function actionBucket(a: { status: WalkAroundActionStatus; due_date: string }, today: string): ActionBucket {
  if (a.status === "done") return "done";
  const d = daysUntil(a.due_date, today);
  if (d < 0) return "overdue";
  if (d <= 7) return "this_week";
  return "later";
}

export interface WalkAroundItemLike {
  state: WalkAroundState | null;
  action_required?: string | null;
  due_date?: string | null;
}

export function checkProgress(items: WalkAroundItemLike[]) {
  const answered = items.filter(i => i.state).length;
  return {
    answered,
    total: items.length,
    attention: items.filter(i => i.state === "attention").length,
    acceptable: items.filter(i => i.state === "acceptable").length,
    na: items.filter(i => i.state === "na").length,
  };
}

/** Reasons a check cannot be submitted yet (mirrors the server-side submit guard). */
export function submissionProblems(items: WalkAroundItemLike[]): string[] {
  const problems: string[] = [];
  const unanswered = items.filter(i => !i.state).length;
  if (unanswered > 0) problems.push(`${unanswered} item${unanswered === 1 ? "" : "s"} still need marking`);
  const noAction = items.filter(i => i.state === "attention" && !(i.action_required ?? "").trim()).length;
  if (noAction > 0) problems.push(`${noAction} item${noAction === 1 ? "" : "s"} needing attention have no action written`);
  const noDue = items.filter(i => i.state === "attention" && !i.due_date).length;
  if (noDue > 0) problems.push(`${noDue} item${noDue === 1 ? "" : "s"} needing attention have no due date`);
  return problems;
}

/** Today's calendar date in London as YYYY-MM-DD. */
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function formatUkDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
