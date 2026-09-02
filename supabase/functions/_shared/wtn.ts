// Shared helpers for WTN (Waste Transfer Note) PDF ingestion + parsing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const BUCKET = "wtn-documents";

// pdf.js tears down its internal decompression streams late, which surfaces as
// a stray "failed to write whole buffer" rejection after a PDF is parsed.
// Swallow it so it can't kill the function between documents.
globalThis.addEventListener("unhandledrejection", (e: any) => {
  if (String(e?.reason?.message ?? e?.reason ?? "").includes("failed to write whole buffer")) {
    e.preventDefault?.();
  }
});

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Pull a Skiptrak job number out of a filename such as "WTN_50099.pdf" or "50099 - Acme.pdf". */
export function jobNumberFromFileName(name: string): string | null {
  const base = name.replace(/\.pdf$/i, "");
  const tagged = base.match(/(?:wtn|job|ticket|pda)[\s_\-#]*0*(\d{3,8})/i);
  if (tagged) return tagged[1];
  const plain = base.match(/\b0*(\d{4,8})\b/);
  return plain ? plain[1] : null;
}

export async function lookupJob(sb: ReturnType<typeof admin>, jobNumber: string | null) {
  if (!jobNumber) return { customer: null, site: null, job_date: null, source: "skiptrak" };
  const { data } = await sb
    .from("data_hub_jobs")
    .select("customer, site, job_date, source")
    .eq("job_number", jobNumber)
    .order("job_date", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as any;
  return {
    customer: row?.customer ?? null,
    site: row?.site ?? null,
    job_date: row?.job_date ?? null,
    source: row?.source ?? "skiptrak",
  };
}

/* ------------------------------------------------------------------ */
/* PDF text extraction                                                 */
/* ------------------------------------------------------------------ */

export async function extractText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText: ex, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await ex(pdf, { mergePages: true });
    return String(text ?? "");
  } catch (e) {
    console.error("wtn extractText failed", e);
    return "";
  }
}

const NAME_STOP = /^(signature|sign|date|time|name|n\/a|-|--)$/i;

function cleanName(v: string | undefined | null): string | null {
  if (!v) return null;
  let s = v.replace(/[_\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^[:\-–]\s*/, "").trim();
  if (!s || s.length < 2 || s.length > 60) return null;
  if (NAME_STOP.test(s)) return null;
  if (!/[A-Za-z]/.test(s)) return null;
  return s;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    const v = cleanName(m?.[1]);
    if (v) return v;
  }
  return null;
}

export function parseNames(text: string): { customerName: string | null; driverName: string | null } {
  const t = text.replace(/\u00a0/g, " ");
  const customerName = firstMatch(t, [
    /customer(?:'s)?\s*(?:name|signatory|print(?:ed)?\s*name)\s*[:\-]?\s*([^\n\r]{2,60})/i,
    /(?:received|signed)\s*by\s*[:\-]?\s*([^\n\r]{2,60})/i,
    /print(?:ed)?\s*name\s*[:\-]?\s*([^\n\r]{2,60})/i,
    /customer\s*[:\-]\s*([^\n\r]{2,60})/i,
  ]);
  const driverName = firstMatch(t, [
    /driver(?:'s)?\s*(?:name|print(?:ed)?\s*name)\s*[:\-]?\s*([^\n\r]{2,60})/i,
    /driver\s*[:\-]\s*([^\n\r]{2,60})/i,
    /carrier(?:'s)?\s*(?:driver|representative)\s*[:\-]?\s*([^\n\r]{2,60})/i,
  ]);
  return { customerName, driverName };
}

/* ------------------------------------------------------------------ */
/* Embedded image extraction (pdf.js: pixels + page placement)         */
/* ------------------------------------------------------------------ */

export type ExtractedImage = {
  bytes: Uint8Array;
  ext: "jpg" | "png";
  contentType: string;
  width: number;
  height: number;
  /** 1-based page the image is drawn on */
  page: number;
  /** placement in PDF points (origin bottom-left) */
  x: number;
  y: number;
  dw: number;
  dh: number;
  /** true when the bitmap is (nearly) blank — an unsigned signature box */
  blank: boolean;
};

function crc32(buf: Uint8Array): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function encodePng(raw: Uint8Array, width: number, height: number, channels: 1 | 3 | 4): Promise<Uint8Array | null> {
  const stride = width * channels;
  if (raw.length < stride * height) return null;
  // Add PNG filter byte (0) per scanline
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(raw.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const cs = new CompressionStream("deflate");
  const idatData = new Uint8Array(
    await new Response(new Blob([filtered]).stream().pipeThrough(cs)).arrayBuffer(),
  );

  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 1 ? 0 : channels === 4 ? 6 : 2; // colour type
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

type TextItemPos = { str: string; x: number; y: number; page: number };

const matMul = (a: number[], b: number[]) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

/** Fraction of pixels that differ noticeably from white. */
function inkRatio(data: Uint8Array, channels: number): number {
  let ink = 0;
  let seen = 0;
  const step = channels * Math.max(1, Math.floor(data.length / channels / 20000));
  for (let i = 0; i + channels <= data.length; i += step * channels) {
    seen++;
    const r = data[i];
    const g = channels >= 3 ? data[i + 1] : r;
    const b = channels >= 3 ? data[i + 2] : r;
    if (r < 220 || g < 220 || b < 220) ink++;
  }
  return seen ? ink / seen : 0;
}

/**
 * Extract every bitmap drawn in the PDF together with where it sits on the
 * page — position is what tells a driver signature apart from a customer one.
 */
export async function extractPlacedImages(pdf: any, max = 40): Promise<ExtractedImage[]> {
  const out: ExtractedImage[] = [];
  for (let p = 1; p <= pdf.numPages && out.length < max; p++) {
    const page = await pdf.getPage(p);
    const ops = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    for (let i = 0; i < ops.fnArray.length && out.length < max; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === 10) stack.push(ctm.slice());
      else if (fn === 11) ctm = stack.pop() ?? ctm;
      else if (fn === 12) ctm = matMul(ctm, args as number[]);
      else if (fn === 85 || fn === 86 || fn === 87) {
        const name = args[0];
        if (typeof name !== "string") continue;
        const obj: any = await new Promise((resolve) => {
          let done = false;
          const finish = (v: any) => {
            if (!done) {
              done = true;
              resolve(v);
            }
          };
          setTimeout(() => finish(null), 5000);
          try {
            page.objs.get(name, finish);
          } catch {
            finish(null);
          }
        });
        if (!obj?.data || !obj.width || !obj.height) continue;
        const channels = obj.kind === 1 ? 1 : obj.kind === 3 ? 4 : 3;
        const data = new Uint8Array(obj.data.buffer ?? obj.data, obj.data.byteOffset ?? 0, obj.data.length);
        const png = await encodePng(data, obj.width, obj.height, channels as 1 | 3 | 4);
        if (!png) continue;
        out.push({
          bytes: png,
          ext: "png",
          contentType: "image/png",
          width: obj.width,
          height: obj.height,
          page: p,
          x: ctm[4],
          y: ctm[5],
          dw: Math.abs(ctm[0]),
          dh: Math.abs(ctm[3]),
          blank: inkRatio(data, channels) < 0.004,
        });
      }
    }
  }
  return out;
}

/** Positioned text items, used to locate the signature/name labels. */
export async function extractTextItems(pdf: any): Promise<TextItemPos[]> {
  const items: TextItemPos[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items as any[]) {
      const s = String(it.str ?? "").trim();
      if (!s) continue;
      items.push({ str: s, x: it.transform[4], y: it.transform[5], page: p });
    }
  }
  return items;
}

function findLabel(items: TextItemPos[], re: RegExp): TextItemPos | null {
  return items.find((i) => i.page === 1 && re.test(i.str)) ?? null;
}

/** Value printed to the right of a label, stopping at the next column label. */
function valueRightOf(items: TextItemPos[], label: TextItemPos | null): string | null {
  if (!label) return null;
  const row = items
    .filter((i) => i.page === label.page && Math.abs(i.y - label.y) <= 4 && i.x > label.x + 2)
    .sort((a, b) => a.x - b.x);
  const parts: string[] = [];
  for (const it of row) {
    if (/:\s*$/.test(it.str)) break; // next field label on the same line
    parts.push(it.str);
  }
  return cleanName(parts.join(" "));
}


/**
 * Match images to the "Driver Sign" / "Customer Sign" boxes on the ticket.
 * Anything on a later page (or a large unmatched image) is a job photo;
 * small unmatched images in the header band are branding and are dropped.
 */
export function classifyImages(images: ExtractedImage[], items: TextItemPos[]) {
  const driverLabel = findLabel(items, /^driver\s*sign/i);
  const customerLabel = findLabel(items, /^customer\s*sign/i);

  const near = (img: ExtractedImage, label: TextItemPos | null) =>
    !!label && img.page === label.page && Math.abs(img.x - label.x) <= 140 && Math.abs(img.y - label.y) <= 70;

  let driverSig: ExtractedImage | null = null;
  let customerSig: ExtractedImage | null = null;
  const photos: ExtractedImage[] = [];

  for (const img of images) {
    if (img.page === 1 && !driverSig && near(img, driverLabel)) {
      driverSig = img;
      continue;
    }
    if (img.page === 1 && !customerSig && near(img, customerLabel)) {
      customerSig = img;
      continue;
    }
    if (img.page > 1) {
      photos.push(img);
      continue;
    }
    // Unmatched on page 1: keep only if it is big enough to be a real photo.
    if (img.dw * img.dh >= 60_000) photos.push(img);
  }

  // Fallback for tickets without recognisable labels: two small wide images
  // on page 1 are the signatures (left = driver, right = customer).
  if (!driverSig && !customerSig && !driverLabel && !customerLabel) {
    const candidates = images
      .filter((i) => i.page === 1 && i.dw * i.dh < 60_000 && i.dw > i.dh && i.y < 500)
      .sort((a, b) => a.x - b.x);
    driverSig = candidates[0] ?? null;
    customerSig = candidates[1] ?? null;
  }

  if (driverSig?.blank) driverSig = null;
  if (customerSig?.blank) customerSig = null;

  return { driverSig, customerSig, photos: photos.filter((p) => !p.blank) };
}

/** Full analysis of a WTN PDF: text, names, signatures and photos. */
export async function analyseWtn(bytes: Uint8Array) {
  const { getDocumentProxy, extractText: ex } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await ex(pdf, { mergePages: true });
  const items = await extractTextItems(pdf);
  const images = await extractPlacedImages(pdf);
  const { driverSig, customerSig, photos } = classifyImages(images, items);

  const driverLabel =
    findLabel(items, /^driver\s*\/?\s*vehicle\s*:?$/i) ?? findLabel(items, /^driver\s*(name)?\s*:?$/i);
  const customerLabel =
    findLabel(items, /^customer\s*print/i) ?? findLabel(items, /^(print(ed)?\s*name|received\s*by)/i);
  // Only fall back to loose text matching when the ticket has no proper label
  // — otherwise a blank field would pick up terms-and-conditions wording.
  const fallback = driverLabel && customerLabel ? { driverName: null, customerName: null } : parseNames(String(text ?? ""));
  const driverName = valueRightOf(items, driverLabel) ?? fallback.driverName;
  const customerName = valueRightOf(items, customerLabel) ?? fallback.customerName;


  try {
    await pdf.cleanup?.();
    await pdf.destroy?.();
  } catch {
    // best-effort teardown
  }

  return { text: String(text ?? ""), driverName, customerName, driverSig, customerSig, photos };
}


/** Download the PDF, parse it and write names / signatures / photos back. */
export async function processDocument(sb: ReturnType<typeof admin>, documentId: string) {
  const { data: doc, error } = await sb
    .from("wtn_documents")
    .select("id, storage_path, file_name, job_number")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!doc) throw new Error(`WTN document ${documentId} not found`);

  try {
    const dl = await sb.storage.from(BUCKET).download(doc.storage_path);
    if (dl.error) throw dl.error;
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    const { text, customerName, driverName, customerSig: custImg, driverSig: drvImg, photos } =
      await analyseWtn(bytes);

    // Replace any previously extracted images for this document.
    const { data: old } = await sb.from("wtn_document_images").select("storage_path").eq("document_id", doc.id);
    if (old?.length) await sb.storage.from(BUCKET).remove(old.map((o: any) => o.storage_path));
    await sb.from("wtn_document_images").delete().eq("document_id", doc.id);

    const base = `extracted/${doc.id}`;
    const uploaded: { kind: string; path: string; w: number; h: number }[] = [];

    const put = async (img: ExtractedImage, kind: string, i: number) => {
      const path = `${base}/${kind}-${i}.${img.ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, img.bytes, {
        contentType: img.contentType,
        upsert: true,
      });
      if (up.error) throw up.error;
      uploaded.push({ kind, path, w: img.width, h: img.height });
      return path;
    };

    const customerSig = custImg ? await put(custImg, "signature-customer", 1) : null;
    const driverSig = drvImg ? await put(drvImg, "signature-driver", 2) : null;
    for (let i = 0; i < photos.length; i++) await put(photos[i], "photo", i + 1);

    if (uploaded.length) {
      await sb.from("wtn_document_images").insert(
        uploaded.map((u, idx) => ({
          document_id: doc.id,
          storage_path: u.path,
          kind: u.kind.startsWith("signature") ? u.kind.replace("signature-", "signature_") : "photo",
          width: u.w,
          height: u.h,
          sort_order: idx,
        })),
      );
    }

    await sb
      .from("wtn_documents")
      .update({
        customer_name: customerName,
        driver_name: driverName,
        customer_signature_path: customerSig,
        driver_signature_path: driverSig,
        text_content: text.slice(0, 20000),
        parse_status: "parsed",
        parse_error: null,
        parsed_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    return {
      id: doc.id,
      customerName,
      driverName,
      photos: photos.length,
      signatures: (customerSig ? 1 : 0) + (driverSig ? 1 : 0),
    };
  } catch (e) {
    await sb
      .from("wtn_documents")
      .update({ parse_status: "error", parse_error: (e as Error).message, parsed_at: new Date().toISOString() })
      .eq("id", doc.id);
    throw e;
  }
}
