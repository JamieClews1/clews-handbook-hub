import type jsPDF from "jspdf";
import regularAsset from "@/assets/NotoSans-Regular.ttf.asset.json";
import boldAsset from "@/assets/NotoSans-Bold.ttf.asset.json";

/**
 * jsPDF's built-in fonts (helvetica etc.) only cover WinAnsi, so Cyrillic
 * (Ukrainian) and Latin-Extended (Polish/Romanian diacritics) render as
 * garbage. Registering Noto Sans gives full Latin + Latin-Ext + Cyrillic.
 */
export const PDF_UNICODE_FONT = "NotoSans";

let cache: Promise<{ regular: string; bold: string }> | null = null;

const CDN = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans";

const fetchTtf = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Sanity check the TrueType magic so an HTML fallback page never gets embedded
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "\u0000\u0001\u0000\u0000" && magic !== "true" && magic !== "ttcf") {
    throw new Error("Not a TrueType font");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const loadOne = async (assetUrl: string, file: string) => {
  try {
    return await fetchTtf(assetUrl);
  } catch {
    return await fetchTtf(`${CDN}/${file}`);
  }
};

const loadFonts = () => {
  if (!cache) {
    cache = Promise.all([
      loadOne(regularAsset.url, "NotoSans-Regular.ttf"),
      loadOne(boldAsset.url, "NotoSans-Bold.ttf"),
    ])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
};


/**
 * Registers the Unicode font on a jsPDF instance and makes it the active font.
 * Returns the font family to pass to setFont — falls back to "helvetica" if
 * the font files cannot be fetched, so PDF generation never hard-fails.
 */
export const useUnicodeFont = async (pdf: jsPDF): Promise<string> => {
  try {
    const { regular, bold } = await loadFonts();
    pdf.addFileToVFS("NotoSans-Regular.ttf", regular);
    pdf.addFont("NotoSans-Regular.ttf", PDF_UNICODE_FONT, "normal");
    pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
    pdf.addFont("NotoSans-Bold.ttf", PDF_UNICODE_FONT, "bold");
    pdf.setFont(PDF_UNICODE_FONT, "normal");
    return PDF_UNICODE_FONT;
  } catch (e) {
    console.error("Unicode font load failed, falling back to helvetica", e);
    return "helvetica";
  }
};
