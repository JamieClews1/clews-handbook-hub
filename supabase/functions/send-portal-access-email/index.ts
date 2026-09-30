import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTAL_URL = "https://portal.clewsrecycling.co.uk/my-portal";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: requestingUser },
    } = await createClient(supabaseUrl, anonKey).auth.getUser(token);

    if (!requestingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Requesting user must be Clews staff (has any role)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .limit(1);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Staff access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const membershipId: string | undefined = body?.membership_id;
    const temporaryPassword: string | null = body?.temporary_password
      ? String(body.temporary_password)
      : null;

    if (!membershipId) {
      return new Response(JSON.stringify({ error: "membership_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (temporaryPassword && temporaryPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Temporary password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Membership -> user, customer, contact
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("customer_portal_memberships")
      .select("id,user_id,customer_id,contact_id")
      .eq("id", membershipId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return new Response(JSON.stringify({ error: "Portal user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: customer }, { data: contact }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name").eq("id", membership.user_id).maybeSingle(),
      supabaseAdmin.from("customers").select("customer_name").eq("id", membership.customer_id).maybeSingle(),
      membership.contact_id
        ? supabaseAdmin.from("customer_contacts").select("full_name,email").eq("id", membership.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Prefer the real auth email
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(membership.user_id);
    const loginEmail = authUser?.user?.email ?? profile?.email ?? contact?.email ?? null;

    if (!loginEmail) {
      return new Response(JSON.stringify({ error: "No email address on this portal login" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sites this person can see
    const { data: access } = await supabaseAdmin
      .from("customer_portal_site_access")
      .select("site_id")
      .eq("membership_id", membershipId);

    let siteNames: string[] = [];
    const siteIds = (access ?? []).map((a: { site_id: string }) => a.site_id);
    if (siteIds.length > 0) {
      const { data: siteRows } = await supabaseAdmin
        .from("customer_sites")
        .select("site_name")
        .in("id", siteIds);
      siteNames = (siteRows ?? []).map((s: { site_name: string }) => s.site_name).sort();
    }

    // Optionally set a temporary password so they can sign in straight away
    if (temporaryPassword) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(membership.user_id, {
        password: temporaryPassword,
      });
      if (pwError) throw pwError;
    }

    const recipientName = contact?.full_name || profile?.full_name || "there";
    const companyName = customer?.customer_name ?? "your account";

    const sitesBlock = siteNames.length
      ? `<p style="margin:16px 0 6px;color:#333;font-weight:600;">Sites you can see:</p>
         <ul style="margin:0 0 8px 18px;padding:0;color:#333;line-height:1.6;">
           ${siteNames.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
         </ul>`
      : "";

    const passwordBlock = temporaryPassword
      ? `<tr><td style="padding:6px 12px 6px 0;color:#666;">Temporary password</td>
             <td style="padding:6px 0;color:#111;font-weight:600;">${escapeHtml(temporaryPassword)}</td></tr>`
      : "";

    const passwordNote = temporaryPassword
      ? `<p style="color:#333;line-height:1.6;">Please change this password after your first sign in — go to <strong>My Profile</strong> in the portal and choose a new password.</p>`
      : `<p style="color:#333;line-height:1.6;">If you don't know your password, or you've forgotten it, reply to this email and we'll set a new one for you.</p>`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background:#14532d;padding:20px;text-align:center;">
          <h2 style="color:#ffffff;margin:0;">WasteOne Customer Portal</h2>
        </div>
        <div style="padding:24px;background:#ffffff;border:1px solid #e0e0e0;">
          <p style="color:#333;line-height:1.6;">Hi ${escapeHtml(recipientName)},</p>
          <p style="color:#333;line-height:1.6;">
            You now have access to the WasteOne customer portal for ${escapeHtml(companyName)}.
            You can view your live jobs and container activity, download proof of delivery documents,
            check weights and tonnages, add purchase order numbers and download your reports.
          </p>

          <p style="margin:20px 0 6px;color:#333;font-weight:600;">How to sign in</p>
          <table style="border-collapse:collapse;margin-bottom:8px;">
            <tr><td style="padding:6px 12px 6px 0;color:#666;">Portal address</td>
                <td style="padding:6px 0;color:#111;font-weight:600;">${PORTAL_URL}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666;">Your email</td>
                <td style="padding:6px 0;color:#111;font-weight:600;">${escapeHtml(loginEmail)}</td></tr>
            ${passwordBlock}
          </table>

          <div style="text-align:center;margin:26px 0;">
            <a href="${PORTAL_URL}" style="background-color:#16a34a;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
              Open the portal
            </a>
          </div>

          ${passwordNote}
          ${sitesBlock}

          <p style="color:#333;line-height:1.6;margin-top:18px;">
            Any problems signing in, just reply to this email and we'll help.
          </p>
        </div>
        <div style="padding:16px;text-align:center;font-size:12px;color:#999;">
          Clews Recycling Limited | Tel: 01788 541549 | www.clewsrecycling.co.uk
        </div>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "WasteOne Portal <noreply@noreply.clewsrecycling.co.uk>",
        to: [loginEmail],
        reply_to: "orders@clewsrecycling.co.uk",
        subject: `Your WasteOne customer portal access${customer?.customer_name ? ` — ${customer.customer_name}` : ""}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.error("Resend error", emailRes.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorText }),
        { status: emailRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, sent_to: loginEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-portal-access-email error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
