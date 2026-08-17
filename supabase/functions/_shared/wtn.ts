// Shared helpers for WTN (Waste Transfer Note) PDF ingestion + parsing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const BUCKET = "wtn-documents";

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
/* Embedded image extraction (raw PDF object scan)                     */
/* ------------------------------------------------------------------ */

export type ExtractedImage = {
  bytes: Uint8Array;
  ext: "jpg" | "png";
  contentType: string;
  width: number;
  height: number;
};

const dec = new TextDecoder("latin1");

function indexOfSeq(hay: Uint8Array, needle: string, from: number): number {
  const n = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer;
    return i;
  }
  return -1;
}

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  for (const fmt of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(fmt);
      const buf = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      // try next format
    }
  }
  return null;
}

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

async function encodePng(raw: Uint8Array, width: number, height: number, channels: 1 | 3): Promise<Uint8Array | null> {
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
  ihdr[9] = channels === 1 ? 0 : 2; // colour type
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

/**
 * Scan the raw PDF for image XObjects and return decoded images.
 * Handles DCTDecode (JPEG, passed straight through) and FlateDecode
 * DeviceRGB / DeviceGray bitmaps (re-encoded as PNG).
 */
export async function extractImages(bytes: Uint8Array, max = 40): Promise<ExtractedImage[]> {
  const out: ExtractedImage[] = [];
  let pos = 0;
  while (out.length < max) {
    const at = indexOfSeq(bytes, "/Image", pos);
    if (at < 0) break;
    pos = at + 6;

    // Find the dictionary start before the marker and the stream that follows.
    const dictStart = Math.max(0, at - 900);
    const header = dec.decode(bytes.subarray(dictStart, at + 900));
    const streamRel = indexOfSeq(bytes, "stream", at);
    if (streamRel < 0) break;
    const dictText = dec.decode(bytes.subarray(dictStart, streamRel));

    const width = Number(dictText.match(/\/Width\s+(\d+)/)?.[1] ?? 0);
    const height = Number(dictText.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
    const length = Number(dictText.match(/\/Length\s+(\d+)/)?.[1] ?? 0);
    const filter = (dictText.match(/\/Filter\s*\/?\s*\[?\s*\/?([A-Za-z0-9]+)/)?.[1] ?? "").toLowerCase();
    const cs = (dictText.match(/\/ColorSpace\s*\/?\s*([A-Za-z0-9]+)/)?.[1] ?? "").toLowerCase();
    const bpc = Number(dictText.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8);
    if (!width || !height) continue;

    // Stream data begins after "stream" + EOL
    let start = streamRel + 6;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;
    let end = length > 0 ? start + length : indexOfSeq(bytes, "endstream", start);
    if (end <= start || end > bytes.length) {
      end = indexOfSeq(bytes, "endstream", start);
      if (end < 0) break;
    }
    const data = bytes.subarray(start, end);
    pos = end;

    try {
      if (filter.includes("dct")) {
        out.push({ bytes: new Uint8Array(data), ext: "jpg", contentType: "image/jpeg", width, height });
      } else if (filter.includes("flate") && bpc === 8) {
        const raw = await inflate(new Uint8Array(data));
        if (!raw) continue;
        const channels: 1 | 3 = cs.includes("gray") ? 1 : 3;
        const png = await encodePng(raw, width, height, channels);
        if (png) out.push({ bytes: png, ext: "png", contentType: "image/png", width, height });
      }
    } catch (e) {
      console.error("wtn image decode failed", e);
    }
    void header;
  }
  return out;
}

/** Signatures are wide, short, low-detail strokes; photos are large. */
export function classifyImages(images: ExtractedImage[]) {
  const signatures: ExtractedImage[] = [];
  const photos: ExtractedImage[] = [];
  for (const img of images) {
    const area = img.width * img.height;
    const ratio = img.width / Math.max(1, img.height);
    const isSignature = area < 260_000 && ratio >= 1.2 && img.height <= 400;
    if (isSignature && signatures.length < 2) signatures.push(img);
    else photos.push(img);
  }
  return { signatures, photos };
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

    const text = await extractText(bytes);
    const { customerName, driverName } = parseNames(text);
    const images = await extractImages(bytes);
    const { signatures, photos } = classifyImages(images);

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

    const customerSig = signatures[0] ? await put(signatures[0], "signature-customer", 1) : null;
    const driverSig = signatures[1] ? await put(signatures[1], "signature-driver", 2) : null;
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

    return { id: doc.id, customerName, driverName, photos: photos.length, signatures: signatures.length };
  } catch (e) {
    await sb
      .from("wtn_documents")
      .update({ parse_status: "error", parse_error: (e as Error).message, parsed_at: new Date().toISOString() })
      .eq("id", doc.id);
    throw e;
  }
}
