import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Customer = { id: string; customer_name: string; customer_code: string; is_active: boolean };
type Membership = { id: string; customer_id: string; user_id: string };
type Profile = { id: string; email: string; full_name: string | null };

export function PortalAccessDirectory({ customers, isAdmin, onManage }: {
  customers: Customer[];
  isAdmin: boolean;
  onManage: (customerId: string) => void;
}) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows: Membership[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error: readError } = await supabase.from("customer_portal_memberships")
            .select("id,customer_id,user_id").order("id").range(from, from + 999);
          if (readError) throw readError;
          rows.push(...(data ?? []));
          if ((data ?? []).length < 1000) break;
        }
        const ids = [...new Set(rows.map(row => row.user_id))];
        const profileMap: Record<string, Profile> = {};
        for (let from = 0; from < ids.length; from += 100) {
          const { data, error: profileError } = await supabase.from("profiles")
            .select("id,email,full_name").in("id", ids.slice(from, from + 100));
          if (profileError) throw profileError;
          for (const profile of data ?? []) profileMap[profile.id] = profile;
        }
        if (!cancelled) {
          setMemberships(rows);
          setProfiles(profileMap);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load portal users. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh]);

  const customerMap = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memberships.filter(row => {
      const customer = customerMap.get(row.customer_id);
      const profile = profiles[row.user_id];
      return !query || [customer?.customer_name, customer?.customer_code, profile?.full_name, profile?.email]
        .some(value => value?.toLowerCase().includes(query));
    }).sort((a, b) => (customerMap.get(a.customer_id)?.customer_name ?? "")
      .localeCompare(customerMap.get(b.customer_id)?.customer_name ?? ""));
  }, [memberships, customerMap, profiles, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Portal access</h3>
          {!loading && !error && <p className="text-sm text-muted-foreground">{new Set(memberships.map(row => row.customer_id)).size} customers · {memberships.length} linked portal users</p>}
        </div>
        <Button variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      <Input aria-label="Search portal users" placeholder="Search customer, name or email…" value={search} onChange={event => setSearch(event.target.value)} className="max-w-md" />
      {error ? (
        <div role="alert" className="space-y-3 text-sm text-destructive">
          <p>{error}</p><Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Try again</Button>
        </div>
      ) : loading ? <p role="status" className="text-sm text-muted-foreground">Loading portal users…</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Portal user</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(row => {
                const customer = customerMap.get(row.customer_id);
                const profile = profiles[row.user_id];
                return <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{customer?.customer_name ?? "Customer unavailable"}</div>
                    <div className="text-xs text-muted-foreground">{customer?.customer_code}</div>
                    {customer && !customer.is_active && <Badge variant="outline">Archived customer</Badge>}
                  </TableCell>
                  <TableCell className="break-words">
                    <div className="font-medium">{profile?.full_name ?? "Name not recorded"}</div>
                    <div className="text-sm text-muted-foreground">{profile?.email ?? "Email unavailable"}</div>
                  </TableCell>
                  <TableCell><div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={!customer} onClick={() => onManage(row.customer_id)}><Pencil className="mr-2 h-3 w-3" />Manage access</Button>
                    {isAdmin && <Button size="sm" variant="outline" onClick={() => window.open(`/my-portal?viewAs=${row.id}`, "_blank", "noopener,noreferrer")}><Eye className="mr-2 h-3 w-3" />View as customer</Button>}
                  </div></TableCell>
                </TableRow>;
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">{search ? "No matching portal users." : "No portal users linked yet."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}