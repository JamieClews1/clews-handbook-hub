import jsPDF from "jspdf";
import { parseLoadReportDate } from "@/lib/load-report-dates";

export interface DaySheetJob { source: string; id: string; number: string; driver: string; vehicle: string; customer: string; address: string; type: string; container: string; waste: string; po: string; notes: string }

export function buildDaySheet(date: string, jobs: DaySheetJob[], notes: Record<string, string> = {}) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" });
  const drivers = [...new Set(jobs.map(j => j.driver || "Unassigned"))];
  for (const [pageIndex, driver] of drivers.entries()) {
    const assigned = jobs.filter(j => (j.driver || "Unassigned") === driver);
    if (pageIndex > 0) doc.addPage("a4", "portrait");
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("WasteOne | Daily job sheet", 12, 17);
    doc.setFontSize(11); doc.text(driver, 12, 25, { maxWidth: 186 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const heading = `${parseLoadReportDate(date)?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? date} | ${assigned.length} jobs | ${[...new Set(assigned.map(j => j.vehicle).filter(Boolean))].join(", ")}`;
    const headingLines: string[] = doc.splitTextToSize(heading, 186);
    doc.text(headingLines, 12, 32);
    const top = 35 + headingLines.length * 3.7;
    const available = 282 - top;
    const note = [notes["*"], notes[driver]].filter(n => n?.trim()).join(" | ");
    // Measure every wrapped line before drawing. Busy days reduce type and spacing,
    // never split a driver onto another page or silently drop addresses/notes.
    const layout = (fontSize: number) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
      const lineHeight = fontSize * 0.405;
      const padding = fontSize * 0.18;
      const noteLines: string[] = note ? doc.splitTextToSize(`NOTE: ${note}`, 180) : [];
      const rows = assigned.map((job, index) => {
        const title = `${index + 1}. Job ${job.number} | ${job.type} | ${job.customer}`;
        doc.setFont("helvetica", "bold");
        const titleLines: string[] = doc.splitTextToSize(title, 180);
        doc.setFont("helvetica", "normal");
        const details = [job.address, `${job.container} | ${job.waste} | PO: ${job.po || "—"} | Vehicle: ${job.vehicle || "—"}`, job.notes ? `Notes: ${job.notes}` : "", "Completed: ________   Weight: ________   Initials: ______"];
        const detailLines: string[] = details.filter(Boolean).flatMap(text => doc.splitTextToSize(text, 180));
        return { titleLines, detailLines, height: (titleLines.length + detailLines.length) * lineHeight + padding * 2 };
      });
      const noteHeight = noteLines.length ? noteLines.length * lineHeight + padding * 2 : 0;
      return { rows, noteLines, noteHeight, lineHeight, padding, height: noteHeight + rows.reduce((sum, row) => sum + row.height, 0) };
    };
    let fontSize = 9;
    let measured = layout(fontSize);
    while (measured.height > available) {
      fontSize *= Math.min(0.95, available / measured.height);
      measured = layout(fontSize);
    }
    doc.setFontSize(fontSize);
    let y = top;
    if (measured.noteLines.length) {
      doc.text(measured.noteLines, 15, y + measured.padding + measured.lineHeight * 0.8, { lineHeightFactor: 1.148 });
      y += measured.noteHeight;
    }
    doc.setDrawColor(160); doc.setLineWidth(0.15);
    for (const row of measured.rows) {
      doc.rect(12, y, 186, row.height);
      const baseline = y + measured.padding + measured.lineHeight * 0.8;
      doc.setFont("helvetica", "bold"); doc.text(row.titleLines, 15, baseline, { lineHeightFactor: 1.148 });
      doc.setFont("helvetica", "normal"); doc.text(row.detailLines, 15, baseline + row.titleLines.length * measured.lineHeight, { lineHeightFactor: 1.148 });
      y += row.height;
    }
    doc.setFontSize(8); doc.text(`RouteOne dispatch | ${driver} | Page ${pageIndex + 1} of ${drivers.length}`, 12, 290, { maxWidth: 186 });
  }
  return doc;
}