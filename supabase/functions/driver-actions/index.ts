import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Fields a job-status update is allowed to set (driver app)
const JOB_UPDATE_FIELDS = new Set([
  "status", "started_at", "completed_at", "driver_notes",
  "contamination_type", "query_reason", "vehicle_reg",
  "customer_signature", "customer_signoff_name", "customer_signoff_at",
  "driver_signature", "driver_signoff_name",
]);

// Columns a driver may write on a contamination report
const CONTAMINATION_FIELDS = new Set([
  "job_number", "customer", "site", "postcode", "container_type", "po_number",
  "order_number", "job_date", "waste_description", "weight_t", "vehicle_reg",
  "source_app", "reporter_driver_id", "reporter_name", "reporter_type",
  "waste_type_id", "contamination_type", "contamination_pct", "sorting_minutes",
  "pricing_tier_id", "calculated_charge", "charge_amount", "query_reason",
  "photos", "customer_signature", "customer_signoff_name", "customer_signoff_at",
]);

const pick = (obj: Record<string, unknown>, allowed: Set<string>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
};

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Escape LIKE/ILIKE wildcards so a username can only match itself
const escapeLike = (s: string) => s.replace(/([%_\\])/g, "\\$1");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const supabase = createClient(supabaseUrl, serviceKey);

    switch (action) {
      /* ─── Auth (PIN login / session restore) ─── */
      case "driver_login": {
        const username = String(body?.username ?? "").trim();
        const pin = String(body?.pin ?? "");
        if (!username || !pin) return json({ error: "Missing credentials" }, 400);
        const { data } = await supabase
          .from("route_one_drivers")
          .select("*, route_one_vehicles(registration, vehicle_type)")
          .ilike("username", escapeLike(username))
          .eq("pin", pin)
          .eq("is_active", true)
          .maybeSingle();
        return json({ driver: data ?? null });
      }
      case "driver_restore": {
        const id = String(body?.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { data } = await supabase
          .from("route_one_drivers")
          .select("*, route_one_vehicles(registration, vehicle_type)")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        return json({ driver: data ?? null });
      }
      case "yard_login": {
        const username = String(body?.username ?? "").trim();
        const pin = String(body?.pin ?? "");
        if (!username || !pin) return json({ error: "Missing credentials" }, 400);
        const { data } = await supabase
          .from("yard_staff")
          .select("id, staff_name")
          .ilike("username", escapeLike(username))
          .eq("pin", pin)
          .eq("is_active", true)
          .maybeSingle();
        return json({ staff: data ?? null });
      }
      case "yard_restore": {
        const id = String(body?.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { data } = await supabase
          .from("yard_staff")
          .select("id, staff_name")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        return json({ staff: data ?? null });
      }

      /* ─── Live location tracking ─── */
      case "update_location": {
        const driverId = String(body?.driver_id ?? "");
        const lat = Number(body?.latitude);
        const lng = Number(body?.longitude);
        if (!driverId) return json({ error: "driver_id required" }, 400);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return json({ error: "valid latitude and longitude required" }, 400);
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return json({ error: "coordinates out of range" }, 400);
        }
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
        const { error } = await supabase
          .from("driver_locations")
          .upsert(
            {
              driver_id: driverId,
              driver_name: body?.driver_name ? String(body.driver_name) : null,
              latitude: lat,
              longitude: lng,
              accuracy: num(body?.accuracy),
              speed: num(body?.speed),
              heading: num(body?.heading),
              battery_level: num(body?.battery_level),
              recorded_at: new Date().toISOString(),
            },
            { onConflict: "driver_id" },
          );
        if (error) throw error;
        return json({ ok: true });
      }

      /* ─── Jobs ─── */
      case "list_jobs": {
        const driverId = String(body?.driver_id ?? "");
        const date = String(body?.date ?? "");
        if (!driverId || !date) return json({ error: "driver_id and date required" }, 400);
        const { data, error } = await supabase
          .from("route_one_jobs")
          .select("*")
          .eq("assigned_driver_id", driverId)
          .eq("scheduled_date", date)
          .order("scheduled_time", { ascending: true, nullsFirst: false })
          .order("display_order");
        if (error) throw error;
        return json({ jobs: data ?? [] });
      }
      case "update_job_status": {
        const jobId = String(body?.job_id ?? "");
        if (!jobId) return json({ error: "job_id required" }, 400);
        const updates = pick({ status: body?.status, ...(body?.extra || {}) }, JOB_UPDATE_FIELDS);
        const { error } = await supabase.from("route_one_jobs").update(updates).eq("id", jobId);
        if (error) throw error;
        return json({ ok: true });
      }

      /* ─── Banksman: live weighbridge feed ─── */
      case "list_weighbridge_jobs": {
        const date = body?.date ? String(body.date) : null;
        const daysBack = Number.isFinite(Number(body?.days_back)) ? Number(body.days_back) : 3;

        const normReg = (r: unknown) =>
          String(r ?? "").toUpperCase().replace(/\s+/g, "");

        // Fetch recent Midweigh (weighbridge) jobs
        let mq = supabase
          .from("data_hub_jobs")
          .select(
            "id, job_number, source, customer, site, driver, vehicle_registration, container_type, waste_description, weight_t, job_date, ewc, movement_type, order_number_override, created_at",
          )
          .ilike("source", "%midweigh%")
          .order("created_at", { ascending: false })
          .limit(150);

        if (date) {
          mq = mq.eq("job_date", date);
        } else {
          const since = new Date();
          since.setDate(since.getDate() - daysBack);
          mq = mq.gte("job_date", since.toISOString().slice(0, 10));
        }

        const { data: midweigh, error: mErr } = await mq;
        if (mErr) throw mErr;

        const mwJobs = midweigh ?? [];

        // Collect the date window so we can match Skiptrak tickets
        const dates = Array.from(
          new Set(mwJobs.map((j) => j.job_date).filter(Boolean) as string[]),
        );

        let skiptrak: any[] = [];
        if (dates.length > 0) {
          const { data: sk, error: sErr } = await supabase
            .from("data_hub_jobs")
            .select("job_number, vehicle_registration, job_date, customer, site")
            .ilike("source", "%skiptrak%")
            .in("job_date", dates)
            .limit(1000);
          if (sErr) throw sErr;
          skiptrak = sk ?? [];
        }

        // Match by normalized vehicle reg + job date
        const skMap = new Map<string, any>();
        for (const s of skiptrak) {
          const reg = normReg(s.vehicle_registration);
          if (!reg || !s.job_date) continue;
          skMap.set(`${reg}|${s.job_date}`, s);
        }

        // Flag jobs that already have a contamination report
        const jobNumbers = Array.from(
          new Set(mwJobs.map((j) => j.job_number).filter(Boolean) as string[]),
        );
        const reported = new Set<string>();
        if (jobNumbers.length > 0) {
          const { data: cq } = await supabase
            .from("contamination_queries")
            .select("job_number")
            .in("job_number", jobNumbers);
          for (const c of cq ?? []) reported.add(c.job_number);
        }

        const jobs = mwJobs.map((j) => {
          const reg = normReg(j.vehicle_registration);
          const match = reg && j.job_date ? skMap.get(`${reg}|${j.job_date}`) : null;
          // Midweigh weight is stored in KG; normalise to tonnes for display/reporting.
          const weightTonnes =
            j.weight_t != null ? Math.round((j.weight_t / 1000) * 1000) / 1000 : null;
          return {
            ...j,
            weight_t: weightTonnes,
            midweigh_job_number: j.job_number,
            skiptrak_job_number: match?.job_number ?? null,
            has_contamination: reported.has(j.job_number),
          };
        });

        return json({ jobs });
      }

      /* ─── Job photos ─── */
      case "list_job_photos": {
        const jobId = String(body?.job_id ?? "");
        const photoType = String(body?.photo_type ?? "");
        if (!jobId) return json({ error: "job_id required" }, 400);
        let q = supabase.from("route_one_job_photos").select("*").eq("job_id", jobId);
        if (photoType) q = q.eq("photo_type", photoType);
        const { data, error } = await q.order("created_at");
        if (error) throw error;
        return json({ photos: data ?? [] });
      }
      case "add_job_photo": {
        const jobId = String(body?.job_id ?? "");
        const photoType = String(body?.photo_type ?? "");
        const fileName = String(body?.file_name ?? "photo.jpg");
        const b64 = String(body?.file_base64 ?? "");
        if (!jobId || !b64) return json({ error: "job_id and file required" }, 400);
        const ext = fileName.split(".").pop() || "jpg";
        const path = `${jobId}/${photoType || "photo"}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("route-one-photos")
          .upload(path, decodeBase64(b64), {
            cacheControl: "3600",
            contentType: String(body?.content_type ?? "image/jpeg"),
          });
        if (upErr) throw upErr;
        const { data, error } = await supabase
          .from("route_one_job_photos")
          .insert({ job_id: jobId, photo_type: photoType, file_path: path, file_name: fileName })
          .select("*")
          .single();
        if (error) throw error;
        return json({ photo: data });
      }
      case "delete_job_photo": {
        const id = String(body?.id ?? "");
        const filePath = String(body?.file_path ?? "");
        if (!id) return json({ error: "id required" }, 400);
        if (filePath) await supabase.storage.from("route-one-photos").remove([filePath]);
        const { error } = await supabase.from("route_one_job_photos").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      /* ─── Contamination photos ─── */
      case "upload_contamination_photo": {
        const folder = String(body?.folder ?? "misc");
        const fileName = String(body?.file_name ?? "photo.jpg");
        const b64 = String(body?.file_base64 ?? "");
        if (!b64) return json({ error: "file required" }, 400);
        const ext = fileName.split(".").pop() || "jpg";
        const path = `${folder}/driver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("contamination-photos")
          .upload(path, decodeBase64(b64), {
            cacheControl: "3600",
            contentType: String(body?.content_type ?? "image/jpeg"),
          });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("contamination-photos").getPublicUrl(path);
        return json({ url: data.publicUrl });
      }

      /* ─── Contamination reports ─── */
      case "get_my_contamination": {
        const jobNumber = String(body?.job_number ?? "");
        const reporterDriverId = body?.reporter_driver_id ?? null;
        if (!jobNumber) return json({ record: null });
        let q = supabase
          .from("contamination_queries")
          .select("*")
          .eq("job_number", jobNumber)
          .order("created_at", { ascending: false })
          .limit(1);
        if (reporterDriverId) q = q.eq("reporter_driver_id", reporterDriverId);
        const { data } = await q.maybeSingle();
        return json({ record: data ?? null });
      }
      case "submit_contamination": {
        const editId = body?.edit_id ? String(body.edit_id) : null;
        const reporterName = String(body?.reporter_name ?? "");
        const pointsPerReport = Number(body?.points_per_report ?? 10);
        const payload = pick(body?.payload || {}, CONTAMINATION_FIELDS);

        if (editId) {
          const { error: updErr } = await supabase
            .from("contamination_queries")
            .update(payload)
            .eq("id", editId);
          if (updErr) throw updErr;
          await supabase.from("contamination_activity_log").insert({
            query_id: editId,
            user_name: reporterName,
            action_type: "updated",
            new_value: String(payload.contamination_type ?? ""),
            notes: "Updated via Driver App",
          });
          return json({ id: editId });
        }

        const { data: created, error: insErr } = await supabase
          .from("contamination_queries")
          .insert({
            ...payload,
            status: "query",
            approval_status: "pending",
            points_awarded: pointsPerReport,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        await supabase.from("contamination_points").insert({
          query_id: created.id,
          driver_id: payload.reporter_type === "driver" ? payload.reporter_driver_id ?? null : null,
          reporter_name: reporterName,
          points: pointsPerReport,
          reason: `Contamination report — Job #${payload.job_number ?? ""}`,
        });

        await supabase.from("contamination_activity_log").insert({
          query_id: created.id,
          user_name: reporterName,
          action_type: "reported",
          new_value: String(payload.contamination_type ?? ""),
          notes: "Reported via Driver App",
        });

        return json({ id: created.id });
      }

      /* ─── Skip Tracker (driver cataloguing) ─── */
      case "skip_tracker_data": {
        const reporterName = String(body?.reporter_name ?? "");
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { data: inventory } = await supabase
          .from("skip_inventory")
          .select(
            "id, asset_number, asset_type, size, condition, repairs_required, last_location, last_cataloged_at, photos, tags",
          )
          .order("last_cataloged_at", { ascending: false, nullsFirst: false })
          .limit(1000);

        const { data: myReports } = await supabase
          .from("skip_tracker_reports")
          .select("*")
          .eq("reporter_name", reporterName)
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: pointRows } = await supabase
          .from("skip_tracker_reports")
          .select("reporter_name, points_awarded, created_at")
          .gte("created_at", monthStart.toISOString());

        const lbMap = new Map<
          string,
          { reporter_name: string; points: number; reports: number }
        >();
        let myPoints = 0;
        for (const r of pointRows ?? []) {
          const key = r.reporter_name || "Unknown";
          const e = lbMap.get(key) || { reporter_name: key, points: 0, reports: 0 };
          e.points += r.points_awarded || 0;
          e.reports += 1;
          lbMap.set(key, e);
          if (key === reporterName) myPoints += r.points_awarded || 0;
        }
        const leaderboard = Array.from(lbMap.values()).sort((a, b) => b.points - a.points);

        // Container descriptions already in use on the inventory (e.g. "12 CU YD")
        const { data: usedSizes } = await supabase
          .from("skip_inventory")
          .select("size")
          .not("size", "is", null);

        const filteredTypes = Array.from(
          new Set(
            (usedSizes ?? [])
              .map((t) => String(t.size ?? "").trim().toUpperCase())
              .filter(Boolean),
          ),
        ).sort((a, b) => {
          const na = parseFloat(a) || 0;
          const nb = parseFloat(b) || 0;
          if (na !== nb) return na - nb;
          return a.localeCompare(b);
        });

        // Authoritative skip/RoRo classification per configured size
        const { data: sizeRows } = await supabase
          .from("skip_inventory_sizes")
          .select("name, asset_type");
        const sizeTypes: Record<string, string> = {};
        for (const s of sizeRows ?? []) {
          const n = String(s.name ?? "").trim().toUpperCase();
          if (n) sizeTypes[n] = s.asset_type === "roro" ? "roro" : "skip";
        }

        return json({
          inventory: inventory ?? [],
          myReports: myReports ?? [],
          myPoints,
          leaderboard,
          containerTypes: filteredTypes,
          sizeTypes,
        });
      }
      case "submit_skip_tracker": {
        const assetNumber = String(body?.asset_number ?? "").trim();
        const assetType = String(body?.asset_type ?? "skip");
        const reporterName = String(body?.reporter_name ?? "").trim();
        const reporterDriverId = body?.reporter_driver_id
          ? String(body.reporter_driver_id)
          : null;
        if (!assetNumber) return json({ error: "Skip/RoRo number required" }, 400);
        if (!reporterName) return json({ error: "Reporter required" }, 400);

        const POINTS = Number.isFinite(Number(body?.points)) ? Number(body.points) : 10;

        // Any profile can be viewed / edited at any time. Points are only
        // awarded for a brand-new profile or for completing a bin that was
        // still missing info — a satisfactory (green) bin earns nothing.
        // Match on the asset number alone (normalised) so a mis-picked
        // skip/RoRo type can never create a duplicate profile.
        const { data: matches } = await supabase
          .from("skip_inventory")
          .select(
            "id, asset_type, last_cataloged_at, last_reported_by, photos, tags, size, condition",
          )
          .ilike("asset_number", assetNumber)
          .order("last_cataloged_at", { ascending: false, nullsFirst: false });
        const existing = matches?.[0] ?? null;

        const { data: trackerSettings } = await supabase
          .from("skip_tracker_settings")
          .select("auto_clear_photo_tag, photos_required")
          .limit(1)
          .maybeSingle();
        const autoClearPhotoTag = trackerSettings?.auto_clear_photo_tag ?? true;
        const photosRequired = Number(trackerSettings?.photos_required ?? 4);

        const existingPhotos = Array.isArray(existing?.photos) ? existing!.photos : [];
        const existingTags: string[] = Array.isArray(existing?.tags) ? existing!.tags : [];
        const needsMoreInfo = existing
          ? existingPhotos.length < photosRequired ||
            !existing.size ||
            !existing.condition ||
            existingTags.some((t) => String(t).toLowerCase().includes("photo"))
          : false;


        const newPhotos = Array.isArray(body?.photos) ? body.photos : [];

        // A brand-new profile must carry at least one photo
        if (!existing && newPhotos.length === 0) {
          return json({ error: "At least one photo is required for a new skip/RoRo profile" }, 400);
        }

        // Keep existing photos and append whatever the driver just added
        const photos = existing ? [...existingPhotos, ...newPhotos] : newPhotos;
        const condition = body?.condition ? String(body.condition) : existing?.condition ?? null;
        const size = body?.size ? String(body.size) : existing?.size ?? null;
        const repairsRequired = Boolean(body?.repairs_required);
        const repairNotes = body?.repair_notes ? String(body.repair_notes) : null;
        const location = body?.location ? String(body.location) : null;
        const ticket = body?.skiptrak_ticket ? String(body.skiptrak_ticket) : null;
        const now = new Date().toISOString();

        // Points: full award for a new profile, smaller award for completing a
        // bin that still needed info, nothing for editing a satisfactory one.
        const pointsAwarded = !existing ? POINTS : needsMoreInfo && newPhotos.length > 0 ? 5 : 0;
        const isTopUp = Boolean(existing) && pointsAwarded > 0;


        const invPayload: Record<string, unknown> = {
          asset_number: assetNumber,
          asset_type: existing?.asset_type || assetType,
          size,
          condition,
          repairs_required: repairsRequired,
          repair_notes: repairNotes,
          photos,
          last_location: location,
          last_skiptrak_ticket: ticket,
          last_cataloged_at: now,
          // Preserve the person who originally logged/photographed this asset
          last_reported_by: existing?.last_reported_by || reporterName,
        };

        // Clear "more photos needed" style tags once new photos have been added
        // (or the bin now meets the required photo count).
        if (
          autoClearPhotoTag &&
          existingTags.length &&
          (newPhotos.length > 0 || photos.length >= photosRequired)
        ) {
          invPayload.tags = existingTags.filter(
            (t) => !String(t).toLowerCase().includes("photo"),
          );
        }


        let inventoryId = existing?.id ?? null;
        if (inventoryId) {
          await supabase.from("skip_inventory").update(invPayload).eq("id", inventoryId);
        } else {
          const { data: inv } = await supabase
            .from("skip_inventory")
            .insert(invPayload)
            .select("id")
            .single();
          inventoryId = inv?.id ?? null;
        }

        const { data: report, error: repErr } = await supabase
          .from("skip_tracker_reports")
          .insert({
            inventory_id: inventoryId,
            asset_number: assetNumber,
            asset_type: assetType,
            condition,
            repairs_required: repairsRequired,
            repair_notes: repairNotes,
            photos,
            location,
            skiptrak_ticket: ticket,
            reporter_driver_id: reporterDriverId,
            reporter_name: reporterName,
            points_awarded: pointsAwarded,
          })
          .select("id")
          .single();
        if (repErr) throw repErr;

        return json({ id: report.id, points: pointsAwarded, top_up: isTopUp });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("driver-actions error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
