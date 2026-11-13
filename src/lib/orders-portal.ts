/**
 * Shared rules for the Orders portal: a public, no-login chat where customers
 * send orders (with PDF attachments) to Clews, answered from Inbox → Orders portal.
 * Keep the limits in step with supabase/functions/orders-portal/index.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export const ORDERS_PORTAL_BUCKET = "order-portal";
export const ORDERS_PORTAL_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ORDERS_PORTAL_MAX_FILES = 5;
export const ORDERS_PORTAL_MAX_BODY = 5000;

const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "heic", "webp", "doc", "docx", "xls", "xlsx", "csv"];

export type OrderStatus = "open" | "in_progress" | "done";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  open: "New / open",
  in_progress: "In progress",
  done: "Done",
};

export interface OrderAttachment {
  path: string;
  name: string;
  size: number;
  url?: string | null;
}

export interface OrderMessage {
  id: string;
  sender: "customer" | "staff";
  staff_name: string | null;
  body: string;
  attachments: OrderAttachment[];
  created_at: string;
}

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Returns an error message for a file the portal will not accept, or null. */
export function orderFileProblem(file: { name: string; size: number }): string | null {
  if (!ALLOWED_EXT.includes(fileExtension(file.name))) {
    return `${file.name}: please attach a PDF, photo, Word or Excel file`;
  }
  if (file.size <= 0) return `${file.name} is empty`;
  if (file.size > ORDERS_PORTAL_MAX_FILE_BYTES) return `${file.name} is larger than 20 MB`;
  return null;
}

/** Storage-safe file name, keeping the extension. */
export function safeFileName(name: string): string {
  const ext = fileExtension(name);
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function ordersPortalCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("orders-portal", { body: { action, ...payload } });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/** Uploads files through one-time upload links issued for this conversation. */
export async function uploadOrderFiles(token: string, files: File[]): Promise<OrderAttachment[]> {
  const out: OrderAttachment[] = [];
  for (const file of files) {
    const { path, uploadToken } = await ordersPortalCall<{ path: string; uploadToken: string }>("upload_url", {
      token,
      filename: file.name,
      size: file.size,
    });
    const { error } = await supabase.storage
      .from(ORDERS_PORTAL_BUCKET)
      .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || undefined });
    if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
    out.push({ path, name: file.name, size: file.size });
  }
  return out;
}

/* ---- conversations remembered on this device (customer side) ---- */
const LS_KEY = "clews-orders-portal";

export interface SavedOrderChat {
  token: string;
  company: string;
  subject: string;
  createdAt: string;
}

export function savedOrderChats(): SavedOrderChat[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.token === "string") : [];
  } catch {
    return [];
  }
}

export function rememberOrderChat(chat: SavedOrderChat) {
  const list = [chat, ...savedOrderChats().filter((c) => c.token !== chat.token)].slice(0, 20);
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* storage full/blocked */ }
}

export function forgetOrderChat(token: string) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(savedOrderChats().filter((c) => c.token !== token))); } catch { /* ignore */ }
}
