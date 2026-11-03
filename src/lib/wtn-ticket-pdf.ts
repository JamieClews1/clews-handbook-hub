import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/** Render a full WTN HTML document into an A4 PDF blob (read-only, no record changes). */
export async function wtnHtmlToPdf(html: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((r) => setTimeout(r, 50));
    await Promise.all(
      Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    );
    const target = (doc.querySelector(".wtn-sheet") as HTMLElement) ?? doc.body;
    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 8;
    const w = 210 - margin * 2;
    const h = Math.min((canvas.height * w) / canvas.width, 297 - margin * 2);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, w, h);
    return pdf.output("blob");
  } finally {
    iframe.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
