import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InspectionReport {
  id: string;
  report_date: string;
  site_location: string;
  inspector_name: string;
  housekeeping_general_cleanliness: string | null;
  housekeeping_waste_disposal: string | null;
  housekeeping_storage_areas: string | null;
  housekeeping_walkways_clear: string | null;
  housekeeping_comments: string | null;
  fire_extinguishers_accessible: string | null;
  fire_exits_clear: string | null;
  fire_signage_visible: string | null;
  fire_assembly_point_clear: string | null;
  fire_safety_comments: string | null;
  first_aid_kit_stocked: string | null;
  first_aid_signage: string | null;
  first_aid_trained_personnel: string | null;
  first_aid_comments: string | null;
  ppe_available: string | null;
  ppe_condition: string | null;
  ppe_being_worn: string | null;
  ppe_comments: string | null;
  equipment_condition: string | null;
  equipment_guarding: string | null;
  equipment_maintenance_records: string | null;
  equipment_comments: string | null;
  electrical_equipment_condition: string | null;
  electrical_cables_secure: string | null;
  electrical_pat_testing: string | null;
  electrical_comments: string | null;
  welfare_toilets_clean: string | null;
  welfare_drinking_water: string | null;
  welfare_rest_areas: string | null;
  welfare_comments: string | null;
  environmental_spill_kits: string | null;
  environmental_waste_segregation: string | null;
  environmental_drainage: string | null;
  environmental_comments: string | null;
  actions_required: string | null;
  overall_comments: string | null;
  signature_image: string | null;
  submitted_at: string | null;
}

const getRatingColor = (rating: string | null): string => {
  switch (rating) {
    case 'good': return '#22c55e';
    case 'acceptable': return '#f59e0b';
    case 'poor': return '#ef4444';
    case 'n/a': return '#6b7280';
    default: return '#9ca3af';
  }
};

const getRatingText = (rating: string | null): string => {
  switch (rating) {
    case 'good': return '✓ Good';
    case 'acceptable': return '⚠ Acceptable';
    case 'poor': return '✗ Poor';
    case 'n/a': return '— N/A';
    default: return '—';
  }
};

const generateEmailHtml = (report: InspectionReport): string => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const renderRating = (label: string, rating: string | null) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: ${getRatingColor(rating)}; font-weight: 600;">
        ${getRatingText(rating)}
      </td>
    </tr>
  `;

  const renderSection = (title: string, ratings: { label: string; value: string | null }[], comments: string | null) => `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #0ea5e9;">${title}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        ${ratings.map(r => renderRating(r.label, r.value)).join('')}
      </table>
      ${comments ? `<p style="color: #6b7280; font-size: 14px; margin: 8px 0; font-style: italic;">Comments: ${comments}</p>` : ''}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Monthly Site Inspection Report</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Clews Recycling</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="display: flex; gap: 20px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
          <div style="flex: 1;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Inspection Date</p>
            <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${formatDate(report.report_date)}</p>
          </div>
          <div style="flex: 1;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Site Location</p>
            <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${report.site_location}</p>
          </div>
          <div style="flex: 1;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Inspector</p>
            <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${report.inspector_name}</p>
          </div>
        </div>

        ${renderSection('1. Housekeeping', [
          { label: 'General Cleanliness', value: report.housekeeping_general_cleanliness },
          { label: 'Waste Disposal', value: report.housekeeping_waste_disposal },
          { label: 'Storage Areas', value: report.housekeeping_storage_areas },
          { label: 'Walkways Clear', value: report.housekeeping_walkways_clear },
        ], report.housekeeping_comments)}

        ${renderSection('2. Fire Safety', [
          { label: 'Fire Extinguishers Accessible', value: report.fire_extinguishers_accessible },
          { label: 'Fire Exits Clear', value: report.fire_exits_clear },
          { label: 'Fire Signage Visible', value: report.fire_signage_visible },
          { label: 'Assembly Point Clear', value: report.fire_assembly_point_clear },
        ], report.fire_safety_comments)}

        ${renderSection('3. First Aid', [
          { label: 'First Aid Kit Stocked', value: report.first_aid_kit_stocked },
          { label: 'First Aid Signage', value: report.first_aid_signage },
          { label: 'Trained Personnel Available', value: report.first_aid_trained_personnel },
        ], report.first_aid_comments)}

        ${renderSection('4. PPE', [
          { label: 'PPE Available', value: report.ppe_available },
          { label: 'PPE Condition', value: report.ppe_condition },
          { label: 'PPE Being Worn', value: report.ppe_being_worn },
        ], report.ppe_comments)}

        ${renderSection('5. Equipment', [
          { label: 'Equipment Condition', value: report.equipment_condition },
          { label: 'Equipment Guarding', value: report.equipment_guarding },
          { label: 'Maintenance Records', value: report.equipment_maintenance_records },
        ], report.equipment_comments)}

        ${renderSection('6. Electrical Safety', [
          { label: 'Electrical Equipment Condition', value: report.electrical_equipment_condition },
          { label: 'Cables Secure', value: report.electrical_cables_secure },
          { label: 'PAT Testing Up to Date', value: report.electrical_pat_testing },
        ], report.electrical_comments)}

        ${renderSection('7. Welfare Facilities', [
          { label: 'Toilets Clean', value: report.welfare_toilets_clean },
          { label: 'Drinking Water Available', value: report.welfare_drinking_water },
          { label: 'Rest Areas Adequate', value: report.welfare_rest_areas },
        ], report.welfare_comments)}

        ${renderSection('8. Environmental', [
          { label: 'Spill Kits Available', value: report.environmental_spill_kits },
          { label: 'Waste Segregation', value: report.environmental_waste_segregation },
          { label: 'Drainage Clear', value: report.environmental_drainage },
        ], report.environmental_comments)}

        ${report.actions_required ? `
          <div style="margin-bottom: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; font-size: 14px; margin: 0 0 8px 0;">⚠ Actions Required</h3>
            <p style="color: #78350f; margin: 0; white-space: pre-line;">${report.actions_required}</p>
          </div>
        ` : ''}

        ${report.overall_comments ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #1f2937; font-size: 14px; margin-bottom: 8px;">Overall Comments</h3>
            <p style="color: #4b5563; margin: 0; white-space: pre-line;">${report.overall_comments}</p>
          </div>
        ` : ''}

        ${report.signature_image ? `
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">Inspector Signature</p>
            <img src="${report.signature_image}" alt="Signature" style="max-height: 60px;" />
            <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">
              Signed by ${report.inspector_name} on ${report.submitted_at ? formatDate(report.submitted_at) : formatDate(report.report_date)}
            </p>
          </div>
        ` : ''}
      </div>
      
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
        This report was generated automatically by Clews Recycling Compliance Hub
      </p>
    </body>
    </html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportId } = await req.json();

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching report: ${reportId}`);

    const { data: report, error: fetchError } = await supabase
      .from('site_inspection_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      console.error('Failed to fetch report:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating email for report at ${report.site_location}`);

    const emailHtml = generateEmailHtml(report);

    const formattedDate = new Date(report.report_date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    console.log('Sending email to jamie@clewsrecycling.co.uk');

    const emailResponse = await resend.emails.send({
      from: 'Clews Compliance Hub <onboarding@resend.dev>',
      to: ['jamie@clewsrecycling.co.uk'],
      subject: `Site Inspection Report - ${report.site_location} - ${formattedDate}`,
      html: emailHtml,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: (emailResponse as { id?: string }).id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-inspection-report:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
