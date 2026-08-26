import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: requestingUser } } = await supabaseClient.auth.getUser();
    if (!requestingUser) return json({ error: "Unauthorized" }, 401);

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return json({ error: "A valid user_id is required" }, 400);
    }
    if (userId === requestingUser.id) {
      return json({ error: "You cannot delete your own account" }, 400);
    }

    // Detach references that block deletion, then remove the auth user
    // (profiles and related rows cascade from auth.users).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("customer_portal_memberships").delete().eq("user_id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Delete user failed:", deleteError.message);
      return json({ error: deleteError.message }, 400);
    }

    return json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
