import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BookingSchema = z.object({
  company_name: z.string().max(255).optional().default(""),
  site_address: z.string().max(500).optional().default(""),
  collection_date: z.string().max(20).optional().default(""),
  collection_time_slot: z.string().max(50).optional().default(""),
  container_type: z.string().max(100).optional().default(""),
  waste_type: z.string().max(100).optional().default(""),
  quantity: z.number().int().min(1).max(100).optional().default(1),
  contact_name: z.string().min(1, "Contact name is required").max(255),
  contact_email: z.string().email("Valid email is required").max(255),
  contact_phone: z.string().min(1, "Phone is required").max(50),
  special_instructions: z.string().max(2000).optional().default(""),
  postcode: z.string().max(20).optional().default(""),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = BookingSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = parsed.data;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build special_instructions combining all extra info
    const notes = [
      data.company_name ? `Company: ${data.company_name}` : "",
      data.site_address ? `Site: ${data.site_address}` : "",
      data.postcode ? `Postcode: ${data.postcode}` : "",
      data.special_instructions || "",
    ].filter(Boolean).join("\n");

    // Generate a booking reference
    const refRes = await supabase.rpc("generate_booking_reference" as any);

    const { data: booking, error: insertError } = await supabase.from("bookings").insert({
      collection_date: data.collection_date || null,
      collection_time_slot: data.collection_time_slot || null,
      container_type: data.container_type || null,
      waste_type: data.waste_type || null,
      quantity: data.quantity,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      special_instructions: notes || null,
      source: "website",
      status: "pending",
    }).select("booking_reference").single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to create booking");
    }

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      const ref = booking?.booking_reference || "N/A";
      const dateStr = data.collection_date || "ASAP / Not specified";

      await resend.emails.send({
        from: "Clews Portal <accounts@noreply.clewsrecycling.co.uk>",
        to: ["orders@clewsrecycling.co.uk"],
        subject: `Website Booking – ${data.contact_name} – ${data.container_type || "TBC"} [${ref}]`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:20px;">🌐 Website Booking Request</h1>
              <p style="margin:5px 0 0;font-size:14px;opacity:0.8;">${ref}</p>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Contact</td><td style="padding:8px 0;font-weight:600;">${data.contact_name}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Company</td><td style="padding:8px 0;">${data.company_name || "N/A"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${data.contact_email}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;">${data.contact_phone}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Container</td><td style="padding:8px 0;">${data.container_type || "TBC"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Waste Type</td><td style="padding:8px 0;">${data.waste_type || "TBC"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Preferred Date</td><td style="padding:8px 0;">${dateStr}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Site Address</td><td style="padding:8px 0;">${data.site_address || "N/A"}</td></tr>
                ${data.special_instructions ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Notes</td><td style="padding:8px 0;">${data.special_instructions}</td></tr>` : ""}
              </table>
              <p style="margin-top:20px;font-size:12px;color:#9ca3af;">Submitted via clewsrecycling.co.uk</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
      // Don't fail the booking if email fails
    }

    return new Response(JSON.stringify({
      success: true,
      booking_reference: booking?.booking_reference,
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Booking API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
