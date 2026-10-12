import jsPDF from "jspdf";
import { parseLoadReportDate } from "@/lib/load-report-dates";

export interface DaySheetJob { source: string; id: string; number: string; driver: string; vehicle: string; customer: string; address: string; type: string; container: string; waste: string; po: string; notes: string }

export function buildDaySheet(date: string, jobs: DaySheetJob[], notes: Record<string, string> = {}) {
  const doc = new jsPDF();
  const drivers = [...new Set(jobs.map(j => j.driver || "Unassigned"))];
  let first = true;
  for (const driver of drivers) {
    const assigned = jobs.filter(j => (j.driver || "Unassigned") === driver);
    for (let offset = 0; offset < assigned.length;) {
      if (!first) doc.addPage();
      first = false;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("WasteOne | Daily job sheet", 12, 18);
      doc.setFontSize(12); doc.text(driver, 12, 28);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`${parseLoadReportDate(date)?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? date} | ${assigned.length} jobs | ${[...new Set(assigned.map(j => j.vehicle).filter(Boolean))].join(", ")}`, 12, 36, { maxWidth: 186 });
      const note = [notes["*"], notes[driver]].filter(n => n?.trim()).join(" | ");
      let top = 46;
      if (note && offset === 0) {
        const noteLines = doc.splitTextToSize(`NOTE: ${note}`, 180).slice(0, 4);
        doc.setFont("helvetica", "bold"); doc.text(noteLines, 12, 43); doc.setFont("helvetica", "normal");
        top = 46 + noteLines.length * 4.5;
      }
      const perPage = top > 46 ? 3 : 4;
      assigned.slice(offset, offset + perPage).forEach((job, index) => {
        const y = top + index * 58;
        doc.setDrawColor(160); doc.rect(12, y, 186, 54);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`${offset + index + 1}. Job ${job.number} | ${job.type}`, 16, y + 7, { maxWidth: 175 });
        doc.setFontSize(10); doc.text(doc.splitTextToSize(job.customer, 172).slice(0, 2), 16, y + 14);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const lines = [job.address, `${job.container} | ${job.waste}`, `PO: ${job.po || "—"} | Vehicle: ${job.vehicle || "—"}`, job.notes ? `Notes: ${job.notes}` : "", "Completed: __________   Weight: __________   Driver initials: ______"];
        doc.text(lines.filter(Boolean).flatMap(line => doc.splitTextToSize(line, 172)).slice(0, 6), 16, y + 25);
      });
      offset += perPage;
      doc.setFontSize(8); doc.text(`RouteOne dispatch | Page ${doc.getNumberOfPages()}`, 12, 288);
    }
  }
  return doc;
}