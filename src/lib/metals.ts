export type StockInputs = {
  grades: { id: string; name: string; price_per_tonne: number; stock_limit_kg: number | null; warn_at_kg: number | null; is_active: boolean }[];
  sorts: { grade_id: string; weight_kg: number; is_voided: boolean }[];
  dispatches: { grade_id: string; weight_kg: number }[];
  adjustments: { grade_id: string; adjustment_kg: number }[];
};

export function preferredMetalDestination(grades: { id: string; preferred_destination?: string | null }[], gradeId: string): string {
  return grades.find((grade) => grade.id === gradeId)?.preferred_destination ?? "";
}

export function metalDispatchDestination(destination: string, remember: boolean) {
  const site = destination.trim();
  return { destination_site: site || null, remember_destination: remember && site.length > 0 };
}

/** Stock = sorted (once, non-voided) + adjustments − dispatches. Collections never count as stock. */
export function computeStock(d: StockInputs) {
  return d.grades.map((grade) => {
    const sorted = d.sorts.filter((s) => s.grade_id === grade.id && !s.is_voided).reduce((a, s) => a + Number(s.weight_kg), 0);
    const adjusted = d.adjustments.filter((s) => s.grade_id === grade.id).reduce((a, s) => a + Number(s.adjustment_kg), 0);
    const dispatched = d.dispatches.filter((s) => s.grade_id === grade.id).reduce((a, s) => a + Number(s.weight_kg), 0);
    const kg = sorted + adjusted - dispatched;
    const limit = grade.stock_limit_kg != null ? Number(grade.stock_limit_kg) : null;
    const warn = grade.warn_at_kg != null ? Number(grade.warn_at_kg) : limit != null ? limit * 0.8 : null;
    const alert: "ok" | "warn" | "over" = limit != null && kg >= limit ? "over" : warn != null && kg >= warn ? "warn" : "ok";
    return { grade, sorted, adjusted, dispatched, kg, value: (Math.max(kg, 0) / 1000) * Number(grade.price_per_tonne), alert };
  });
}
