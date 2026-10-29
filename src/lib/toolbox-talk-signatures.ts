import type jsPDF from "jspdf";

export interface ToolboxTalkSignature {
  id: string;
  user_id: string;
  signed_at: string;
  signature_image: string | null;
  name: string;
}

/** Read-only appendix: every saved sign-off is included, never inferred. */
export function appendToolboxTalkSignatures(pdf: jsPDF, title: string, signatures: ToolboxTalkSignature[], font: string) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = height;
  const heading = () => {
    pdf.addPage();
    pdf.setTextColor(30, 30, 30);
    pdf.setFont(font, "bold");
    pdf.setFontSize(14);
    pdf.text("Recorded signatures", margin, 20);
    pdf.setFont(font, "normal");
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(title, width - margin * 2);
    pdf.text(lines, margin, 27);
    y = 30 + lines.length * 4;
    pdf.text(`${signatures.length} recorded sign-off${signatures.length === 1 ? "" : "s"}`, margin, y);
    y += 8;
  };
  if (signatures.length === 0) {
    heading();
    pdf.text("No signatures have been recorded for this Toolbox Talk.", margin, y);
    return;
  }
  for (const signature of signatures) {
    pdf.setFont(font, "bold");
    pdf.setFontSize(10);
    const nameLines = pdf.splitTextToSize(signature.name, 85);
    const rowHeight = Math.max(30, nameLines.length * 5 + 15);
    if (y + rowHeight > height - 20) heading();
    pdf.setFont(font, "bold");
    pdf.setFontSize(10);
    pdf.text(nameLines, margin, y + 5);
    pdf.setFont(font, "normal");
    pdf.setFontSize(8);
    const date = new Date(signature.signed_at).toLocaleString("en-GB", {
      timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    pdf.text(`Signed: ${date} (London)`, margin, y + nameLines.length * 5 + 6);
    if (signature.signature_image) {
      const image = pdf.getImageProperties(signature.signature_image);
      const scale = Math.min(65 / image.width, 20 / image.height);
      pdf.addImage(signature.signature_image, width - margin - 65, y + 2, image.width * scale, image.height * scale);
    } else {
      pdf.text("Sign-off recorded; no signature image saved", width - margin - 65, y + 10, { maxWidth: 65 });
    }
    pdf.setDrawColor(180, 180, 180);
    pdf.line(margin, y + rowHeight - 2, width - margin, y + rowHeight - 2);
    y += rowHeight;
  }
}