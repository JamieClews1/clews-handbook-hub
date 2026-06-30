import jsPDF from "jspdf";
import { ContainerLoad, packingTotalKg } from "@/lib/container-loads";
import clewsLogo from "@/assets/clews-logo.png";

const MARGIN = 16;

async function loadLogo(): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = clewsLogo;
  });
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/** Annex VII — Information accompanying shipments of green-listed waste. */
export async function generateAnnex7Pdf(load: ContainerLoad) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const a = load.annex7 || {};
  let y = 14;

  const logo = await loadLogo();
  if (logo) {
    const h = 14;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    pdf.addImage(logo, "PNG", MARGIN, y, w, h);
  }
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(110, 110, 110);
  pdf.text(`Ref: ${load.reference ?? "—"}`, pageW - MARGIN, y + 4, { align: "right" });
  pdf.text(fmtDate(load.export_date), pageW - MARGIN, y + 9, { align: "right" });
  y += 20;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("ANNEX VII", pageW / 2, y, { align: "center" });
  y += 6;
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90, 90, 90);
  pdf.text(
    "Information accompanying shipments of waste referred to in Article 3(2) and (4)",
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 8;
  pdf.setTextColor(0, 0, 0);

  // Numbered box helper
  const box = (num: string, title: string, lines: string[]) => {
    const innerW = pageW - MARGIN * 2;
    const lineH = 5;
    const headerH = 6;
    const bodyH = Math.max(lines.length, 1) * lineH + 3;
    const boxH = headerH + bodyH;
    if (y + boxH > pageH - 16) {
      pdf.addPage();
      y = 16;
    }
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.rect(MARGIN, y, innerW, boxH);
    pdf.setFillColor(241, 245, 241);
    pdf.rect(MARGIN, y, innerW, headerH, "F");
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${num}. ${title}`, MARGIN + 2, y + 4.2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    let ly = y + headerH + 4;
    (lines.length ? lines : ["—"]).forEach((ln) => {
      pdf.text(ln || "—", MARGIN + 2, ly);
      ly += lineH;
    });
    y += boxH + 3;
  };

  box("1", "Person who arranges the shipment (exporter)", [
    a.exporter_name || "—",
    a.exporter_address || "",
    [a.exporter_contact, a.exporter_tel, a.exporter_email].filter(Boolean).join("  •  "),
  ].filter((l) => l !== ""));

  box("2", "Importer / consignee", [
    a.consignee_name || "—",
    a.consignee_address || "",
    [a.consignee_contact, a.consignee_tel, a.consignee_email].filter(Boolean).join("  •  "),
  ].filter((l) => l !== ""));

  box("3", "Actual quantity", [
    `${load.total_weight_t != null ? load.total_weight_t : "—"} tonnes` +
      (load.bale_count ? `   (${load.bale_count} bales)` : ""),
  ]);

  box("4", "Actual date of shipment", [fmtDate(load.export_date)]);

  box("5", "Carrier(s)", [
    a.carrier_name || "—",
    a.carrier_address || "",
    a.carrier_contact || "",
    a.means_of_transport ? `Means of transport: ${a.means_of_transport}` : "",
  ].filter((l) => l !== ""));

  box("6 / 7 / 8", "Countries — dispatch / transit / destination", [
    `Dispatch: ${a.country_dispatch || "United Kingdom"}`,
    `Transit: ${a.country_transit || "—"}`,
    `Destination: ${a.country_destination || load.destination_country || "—"}`,
  ]);

  box("10", "Designation and composition of the waste", [
    load.material || "—",
    [
      load.basel_code ? `Basel code: ${load.basel_code}` : "",
      load.ewc_code ? `EWC: ${load.ewc_code}` : "",
    ]
      .filter(Boolean)
      .join("    "),
  ].filter((l) => l !== ""));

  box("11", "Recovery facility", [
    a.recovery_facility_name || a.consignee_name || "—",
    a.recovery_facility_address || "",
    a.recovery_operation ? `Recovery operation: ${a.recovery_operation}` : "",
  ].filter((l) => l !== ""));

  box("12", "Shipping / container details", [
    `Container no: ${load.container_number || "—"}    Seal: ${load.seal_number || "—"}`,
    `Booking ref: ${load.booking_reference || "—"}    Vessel: ${load.vessel || "—"}`,
  ]);

  // Declaration
  if (y + 26 > pageH - 16) {
    pdf.addPage();
    y = 16;
  }
  y += 2;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(70, 70, 70);
  const decl =
    "I declare that the above information is, to the best of my knowledge, complete and correct. I also declare that effective written contractual obligations have been entered into with the consignee (and that these are in force at the time the recovery operation begins).";
  const declLines = pdf.splitTextToSize(decl, pageW - MARGIN * 2);
  pdf.text(declLines, MARGIN, y);
  y += declLines.length * 4 + 12;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Name: ______________________________", MARGIN, y);
  pdf.text("Signature: ______________________________", pageW / 2, y);
  y += 10;
  pdf.text(`Date: ${fmtDate(load.export_date)}`, MARGIN, y);

  pdf.save(`Annex7-${load.reference ?? "container"}.pdf`);
}

/** Packing sheet listing every bale in the container. */
export async function generatePackingSheetPdf(load: ContainerLoad) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let y = 14;

  const logo = await loadLogo();
  if (logo) {
    const h = 14;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    pdf.addImage(logo, "PNG", MARGIN, y, w, h);
  }
  pdf.setFontSize(9);
  pdf.setTextColor(110, 110, 110);
  pdf.text(`Ref: ${load.reference ?? "—"}`, pageW - MARGIN, y + 4, { align: "right" });
  pdf.text(fmtDate(load.export_date), pageW - MARGIN, y + 9, { align: "right" });
  y += 20;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("PACKING SHEET", pageW / 2, y, { align: "center" });
  y += 10;

  // Summary fields
  pdf.setFontSize(10);
  const field = (label: string, value: string, x: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, x, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, x + 32, y);
  };
  field("Customer:", load.customer_name || "—", MARGIN);
  field("Container:", load.container_number || "—", pageW / 2);
  y += 6;
  field("Material:", load.material || "—", MARGIN);
  field("Seal no:", load.seal_number || "—", pageW / 2);
  y += 6;
  field("Destination:", [load.destination_facility, load.destination_country].filter(Boolean).join(", ") || "—", MARGIN);
  field("Booking ref:", load.booking_reference || "—", pageW / 2);
  y += 10;

  // Table header
  const cols = [
    { title: "Bale #", x: MARGIN, w: 22 },
    { title: "Material", x: MARGIN + 22, w: 78 },
    { title: "Weight (kg)", x: MARGIN + 100, w: 30 },
    { title: "Notes", x: MARGIN + 130, w: pageW - MARGIN - (MARGIN + 130) },
  ];
  const drawHeader = () => {
    pdf.setFillColor(20, 83, 45);
    pdf.rect(MARGIN, y, pageW - MARGIN * 2, 7, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    cols.forEach((c) => pdf.text(c.title, c.x + 1.5, y + 4.8));
    y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
  };
  drawHeader();

  const rows =
    load.packing && load.packing.length
      ? load.packing
      : Array.from({ length: Math.max(load.bale_count, 0) }, (_, i) => ({
          bale_no: String(i + 1),
          material: load.material || "",
          weight_kg: null as number | null,
          notes: "",
        }));

  pdf.setFontSize(9);
  rows.forEach((r, i) => {
    if (y + 7 > pageH - 20) {
      pdf.addPage();
      y = 16;
      drawHeader();
    }
    if (i % 2 === 1) {
      pdf.setFillColor(244, 247, 244);
      pdf.rect(MARGIN, y, pageW - MARGIN * 2, 6.5, "F");
    }
    pdf.text(String(r.bale_no || i + 1), cols[0].x + 1.5, y + 4.5);
    const mat = pdf.splitTextToSize(r.material || load.material || "", cols[1].w - 3)[0] || "";
    pdf.text(mat, cols[1].x + 1.5, y + 4.5);
    pdf.text(r.weight_kg != null ? Number(r.weight_kg).toLocaleString() : "", cols[2].x + 1.5, y + 4.5);
    const note = pdf.splitTextToSize(r.notes || "", cols[3].w - 3)[0] || "";
    pdf.text(note, cols[3].x + 1.5, y + 4.5);
    y += 6.5;
  });

  // Totals
  y += 2;
  pdf.setDrawColor(20, 83, 45);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  const totalKg = packingTotalKg(rows);
  pdf.text(`Total bales: ${rows.length}`, MARGIN, y);
  if (totalKg > 0) {
    pdf.text(`Total weight: ${totalKg.toLocaleString()} kg`, pageW / 2, y);
  } else if (load.total_weight_t != null) {
    pdf.text(`Total weight: ${load.total_weight_t} tonnes`, pageW / 2, y);
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    "Clews Recycling Limited — Container Packing Sheet",
    pageW / 2,
    pageH - 10,
    { align: "center" },
  );

  pdf.save(`PackingSheet-${load.reference ?? "container"}.pdf`);
}
