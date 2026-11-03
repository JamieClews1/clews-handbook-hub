import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";

const KEY = "wasteone-test-mode-on";
const EVT = "wasteone-test-mode";

/** Test tickets are never real and must never be sent to DWT. */
export function isTestRecord(row: { is_test?: boolean | null }): boolean {
  return row.is_test === true;
}

export function useTestModeSetting() {
  return useQuery({
    queryKey: ["test-mode-setting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("test_mode_settings").select("id, enabled").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

/** True only when Settings allows test mode AND the user switched it on. */
export function useTestModeActive(): boolean {
  const { data } = useTestModeSetting();
  const [on, setOn] = useState(() => localStorage.getItem(KEY) === "1");
  useEffect(() => {
    const h = () => setOn(localStorage.getItem(KEY) === "1");
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return !!data?.enabled && on;
}

function setLocal(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVT));
}

/** Small red toggle for the top bar; hidden when Settings has test mode off. */
export function TestModeToggle() {
  const { data } = useTestModeSetting();
  const active = useTestModeActive();
  if (!data?.enabled) return null;
  return (
    <button
      type="button"
      onClick={() => setLocal(!active)}
      title="Tickets created while Test is on are marked as test and never sent to DWT"
      className={`mr-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 h-7 text-xs font-semibold transition-colors ${
        active ? "bg-destructive text-destructive-foreground border-destructive" : "border-destructive/50 text-destructive hover:bg-destructive/10"
      }`}
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Test {active ? "ON" : "off"}
    </button>
  );
}

/** Settings card: makes test mode available (live) or off for everyone. */
export function TestModeSettingsCard() {
  const qc = useQueryClient();
  const { data } = useTestModeSetting();
  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!data?.id) return;
      const { error } = await supabase.from("test_mode_settings").update({ enabled, updated_at: new Date().toISOString() }).eq("id", data.id);
      if (error) throw error;
      if (!enabled) setLocal(false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-mode-setting"] }),
  });
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold flex items-center gap-2"><FlaskConical className="h-4 w-4 text-destructive" /> Test mode</p>
          <p className="text-sm text-muted-foreground mt-1">
            When live, a small red Test toggle shows at the top of the screen. WeighOne tickets and RouteOne jobs created while it is on are marked as test and never go to DWT.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm">{data?.enabled ? "Live" : "Off"}</span>
          <Switch checked={!!data?.enabled} disabled={!data || save.isPending} onCheckedChange={(v) => save.mutate(v)} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Small red pill shown next to any record that was created in test mode. */
export function TestBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-destructive bg-destructive-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-destructive ${className}`}
      title="Created in test mode — not a real job and never sent to DWT"
    >
      <FlaskConical className="h-2.5 w-2.5" />
      Test
    </span>
  );
}

/** Red strip for the top of a ticket/job screen so the person entering it knows it is a test. */
export function TestModeBanner({ label = "Test ticket" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs font-medium text-destructive">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      <span>
        {label} — not a real job. It is marked as test, stays out of DWT and must not be given to a customer.
      </span>
    </div>
  );
}

