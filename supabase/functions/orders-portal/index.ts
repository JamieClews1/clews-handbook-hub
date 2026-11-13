// Orders portal: public, no-login chat for customers to send orders (and PDFs)
// to Clews. Customers hold a secret per-conversation link; staff answer from
// Inbox → Orders portal. Keep limits in step with src/lib/orders-portal.ts.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "order-portal";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_BODY = 5000;
const PORTAL_URL = "https://portal.clewsrecycling.co.uk";
const FROM = "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>";
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "heic", "webp", "doc", "docx", "xls", "xlsx", "csv"]);
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ext = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
const safeName = (name: string) => {
  const e = ext(name);
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "file";
  return e ? `${base}.${e}` : base;
};
const newToken = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("resend", r.status, await r.text());
  } catch (e) {
    console.error("resend failed", e);
  }
}

const emailShell = (inner: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="background:#16a34a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:bold">Clews Recycling — Orders portal</div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 8px 8px">${inner}
  <p style="font-size:12px;color:#6b7280;margin-top:24px">Please don't reply to this email — reply in the Orders portal using the button above.</p></div>
</div>`;

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${label}</a></p>`;

async function loadConversation(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await supabase
    .from("order_portal_conversations")
    .select("id, access_token, contact_name, company_name, email, phone, subject, status, created_at")
    .eq("access_token", token)
    .maybeSingle();
  return data;
}

type Att = { path: string; name: string; size: number };

async function cleanAttachments(raw: unknown, convId: string): Promise<Att[] | string> {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_FILES) return `Attach up to ${MAX_FILES} files at a time`;
  const out: Att[] = [];
  for (const a of raw) {
    const path = str((a as any)?.path, 400);
    const name = str((a as any)?.name, 200) || "file";
    const size = Number((a as any)?.size) || 0;
    if (!path.startsWith(`${convId}/`) || path.includes("..")) return "Invalid attachment";
    const { error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) return `${name} did not finish uploading — please attach it again`;
    out.push({ path, name, size });
  }
  return out;
}

async function addMessage(convId: string, row: Record<string, unknown>, sender: "customer" | "staff", preview: string) {
  const { data, error } = await supabase
    .from("order_portal_messages")
    .insert({ conversation_id: convId, sender, ...row })
    .select("id, created_at")
    .single();
  if (error) throw error;
  const { count } = await supabase
    .from("order_portal_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId);
  const patch: Record<string, unknown> = {
    last_message_at: data.created_at,
    last_message_preview: preview.slice(0, 200),
    last_sender: sender,
    message_count: count ?? 0,
  };
  if (sender === "customer") patch.staff_unread = true;
  await supabase.from("order_portal_conversations").update(patch).eq("id", convId);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 40);

    if (action === "start") {
      if (str(body.website, 200)) return json({ error: "Could not send" }, 400); // honeypot
      const contact_name = str(body.contact_name, 120);
      const company_name = str(body.company_name, 160);
      const email = str(body.email, 200).toLowerCase();
      const phone = str(body.phone, 40) || null;
      const subject = str(body.subject, 160) || null;
      if (!contact_name || !company_name) return json({ error: "Please enter your name and company" }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address" }, 400);

      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("order_portal_conversations")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", since);
      if ((count ?? 0) >= 15) return json({ error: "Too many new conversations — please use one of your existing ones" }, 429);

      let customer_id: string | null = null;
      const { data: match } = await supabase.rpc("crm_match_customer_by_email", { _email: email });
      if (typeof match === "string") customer_id = match;

      const token = newToken();
      const { error } = await supabase.from("order_portal_conversations").insert({
        access_token: token, contact_name, company_name, email, phone, subject, customer_id,
      });
      if (error) throw error;

      const link = `${PORTAL_URL}/orders/${token}`;
      await sendEmail(
        email,
        `Your Clews Recycling orders link${subject ? ` — ${subject}` : ""}`,
        emailShell(`<p>Hi ${esc(contact_name)},</p>
          <p>Thanks for contacting Clews Recycling. This is your private link to send orders, attach PDFs and chat with our office team:</p>
          ${button(link, "Open my orders chat")}
          <p style="font-size:13px;color:#4b5563">Keep this email — anyone with the link can see this conversation.</p>`),
      );
      return json({ token });
    }

    if (action === "staff_reply") {
      const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data: u } = await supabase.auth.getUser(auth);
      const user = u?.user;
      if (!user) return json({ error: "Please sign in" }, 401);
      const { data: staff } = await supabase.rpc("is_staff", { _user_id: user.id });
      if (!staff) return json({ error: "Staff only" }, 403);

      const convId = str(body.conversation_id, 60);
      const { data: conv } = await supabase
        .from("order_portal_conversations")
        .select("id, access_token, contact_name, email, subject, status")
        .eq("id", convId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);
      const text = str(body.body, MAX_BODY);
      const atts = await cleanAttachments(body.attachments, conv.id);
      if (typeof atts === "string") return json({ error: atts }, 400);
      if (!text && !atts.length) return json({ error: "Write a reply first" }, 400);

      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const staffName = (prof?.full_name || user.email || "Clews office").split(" ")[0];
      await addMessage(conv.id, { body: text, attachments: atts, staff_user_id: user.id, staff_name: staffName }, "staff",
        text || `Sent ${atts.length} file(s)`);
      if (conv.status === "open") {
        await supabase.from("order_portal_conversations").update({ status: "in_progress" }).eq("id", conv.id);
      }

      if (body.notify !== false) {
        const link = `${PORTAL_URL}/orders/${conv.access_token}`;
        await sendEmail(
          conv.email,
          `New reply from Clews Recycling${conv.subject ? ` — ${conv.subject}` : ""}`,
          emailShell(`<p>Hi ${esc(conv.contact_name)},</p>
            <p><strong>${esc(staffName)}</strong> at Clews Recycling has replied:</p>
            <blockquote style="border-left:3px solid #16a34a;margin:0;padding:8px 12px;background:#f9fafb;white-space:pre-wrap">${esc(text || "(file attached)")}</blockquote>
            ${button(link, "View and reply")}`),
        );
      }
      return json({ ok: true });
    }

    // ---- customer actions below need the conversation link ----
    const conv = await loadConversation(str(body.token, 200));
    if (!conv) return json({ error: "This link isn't valid. Please start a new message." }, 404);

    if (action === "get") {
      const { data: msgs, error } = await supabase
        .from("order_portal_messages")
        .select("id, sender, staff_name, body, attachments, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at")
        .limit(500);
      if (error) throw error;
      const paths = (msgs ?? []).flatMap((m: any) => (Array.isArray(m.attachments) ? m.attachments.map((a: any) => a.path) : []));
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
      }
      return json({
        conversation: {
          contact_name: conv.contact_name, company_name: conv.company_name, email: conv.email,
          phone: conv.phone, subject: conv.subject, status: conv.status, created_at: conv.created_at,
        },
        messages: (msgs ?? []).map((m: any) => ({
          ...m,
          attachments: (m.attachments ?? []).map((a: any) => ({ name: a.name, size: a.size, path: a.path, url: urls[a.path] ?? null })),
        })),
      });
    }

    if (action === "upload_url") {
      const filename = str(body.filename, 200);
      const size = Number(body.size) || 0;
      if (!ALLOWED_EXT.has(ext(filename))) return json({ error: "Please attach a PDF, photo, Word or Excel file" }, 400);
      if (size <= 0 || size > MAX_FILE_BYTES) return json({ error: "Files must be under 20 MB" }, 400);
      const path = `${conv.id}/${crypto.randomUUID()}-${safeName(filename)}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path, uploadToken: data.token });
    }

    if (action === "send") {
      const text = str(body.body, MAX_BODY);
      const atts = await cleanAttachments(body.attachments, conv.id);
      if (typeof atts === "string") return json({ error: atts }, 400);
      if (!text && !atts.length) return json({ error: "Write a message or attach your order" }, 400);
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("order_portal_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("sender", "customer")
        .gte("created_at", since);
      if ((count ?? 0) >= 40) return json({ error: "Too many messages — please wait a few minutes" }, 429);
      await addMessage(conv.id, { body: text, attachments: atts }, "customer", text || `Sent ${atts.length} file(s)`);
      if (conv.status === "done") {
        await supabase.from("order_portal_conversations").update({ status: "open" }).eq("id", conv.id);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("orders-portal", e);
    return json({ error: "Something went wrong — please try again" }, 500);
  }
});
