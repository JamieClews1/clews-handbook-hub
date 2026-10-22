import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type AccessUser = { user_id: string; full_name: string | null; email: string | null; has_access: boolean; is_manager: boolean };

export default function CompanyPlAccessSettings() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await withTimeout(supabase.rpc("list_company_pl_access"), 12000, "P&L access");
      if (result.error) throw result.error;
      setUsers(result.data ?? []);
    } catch { setError("Access settings could not load. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const changeAccess = async (user: AccessUser, enabled: boolean) => {
    setSaving(user.user_id);
    setError("");
    try {
      const result = await withTimeout(supabase.rpc("set_company_pl_access", { _user_id: user.user_id, _enabled: enabled }), 12000, "Save P&L access");
      if (result.error) throw result.error;
      await load();
    } catch { setError("Access change could not be confirmed. Refresh before trying again."); }
    finally { setSaving(null); }
  };
  return <section className="space-y-4 border-b border-border pb-6">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />P&L access</h2>
      <Button variant="outline" size="icon" aria-label="Refresh P&L access" onClick={() => void load()} disabled={loading || saving !== null}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    <p className="text-sm text-muted-foreground">Only Jamie can grant or remove access. Approved staff can view P&L; workbook imports remain Jamie-only.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading access…</p> :
      <div className="divide-y divide-border">{users.map(user => <div key={user.user_id} className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0"><p className="break-words font-medium">{user.full_name || user.email}</p><p className="break-all text-sm text-muted-foreground">{user.email}</p></div>
        {user.is_manager ? <span className="shrink-0 text-sm font-medium text-primary">Jamie · always has access</span> : <Switch aria-label={`P&L access for ${user.email}`} checked={user.has_access} disabled={saving !== null} onCheckedChange={enabled => void changeAccess(user, enabled)} />}
      </div>)}</div>}
  </section>;
}