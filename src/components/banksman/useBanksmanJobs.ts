import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BJob } from "./BanksmanWorkflow";

/** Live list of recent banksman jobs (last 2 days) with realtime refresh. */
export function useBanksmanJobs(enabled = true) {
  const [jobs, setJobs] = useState<BJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 2);
    const { data } = await supabase.from("banksman_jobs").select("*")
      .or(`created_at.gte.${since.toISOString()},alert_status.eq.urgent`)
      .order("created_at", { ascending: false }).limit(300);
    setJobs((data ?? []) as unknown as BJob[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const ch = supabase.channel(`banksman-jobs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "banksman_jobs" }, () => load())
      .subscribe();
    const t = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [enabled, load]);

  return { jobs, loading, reload: load };
}

export async function acknowledgeAlert(jobId: string, userId: string) {
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const { data: u } = await supabase.auth.getUser();
  const name = (prof as any)?.full_name || u.user?.email || "Staff";
  const { error } = await supabase.from("banksman_jobs").update({
    alert_status: "acknowledged", acknowledged_by: userId, acknowledged_by_name: name, acknowledged_at: new Date().toISOString(),
  }).eq("id", jobId).eq("alert_status", "urgent");
  if (error) throw error;
}
