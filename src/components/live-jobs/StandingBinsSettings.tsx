import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StandingBinRule } from "@/lib/standing-bins";

const blank = { customer: "", site: "", container_type: "", ewc: "", bin_count: 2, notes: "" };

/** Staff-confirmed multi-bin positions. Feeds Live Jobs, Rentals and Stock Check. */
export default function StandingBinsSettings() {
  const [rows, setRows] = useState<StandingBinRule[]>([]);
  const [draft, setDraft] = useState(blank);

  const load = () => supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes")
    .order("site").then(({ data }) => setRows((data ?? []) as StandingBinRule[]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.site.trim() || !draft.container_type.trim()) return toast.error("Site and container type are required");
    const { error } = await supabase.from("site_standing_bins").insert({ ...draft, customer: draft.customer || null });
    if (error) return toast.error(error.message);
    setDraft(blank); load();
  };
  const setCount = async (id: string, bin_count: number) => {
    if (bin_count < 1) return;
    const { error } = await supabase.from("site_standing_bins").update({ bin_count }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("site_standing_bins").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Multi-bin sites</CardTitle>
        <p className="text-sm text-muted-foreground">
          Number of identical containers confirmed on a site for one waste type. Used by Live Jobs, Rentals and Stock Check.
          A real collection still reduces the count automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead><TableHead>Site</TableHead><TableHead>Container</TableHead>
              <TableHead>EWC</TableHead><TableHead className="w-24">Bins</TableHead><TableHead>Notes</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.customer}</TableCell><TableCell>{r.site}</TableCell><TableCell>{r.container_type}</TableCell>
                <TableCell className="tabular-nums">{r.ewc}</TableCell>
                <TableCell><Input type="number" min={1} defaultValue={r.bin_count} className="h-8 w-16" onBlur={e => Number(e.target.value) !== r.bin_count && setCount(r.id, Number(e.target.value))} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
                <TableCell><Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Input placeholder="Customer" value={draft.customer} onChange={e => setDraft({ ...draft, customer: e.target.value })} />
          <Input placeholder="Site (as in Skiptrak)" value={draft.site} onChange={e => setDraft({ ...draft, site: e.target.value })} />
          <Input placeholder="Container type" value={draft.container_type} onChange={e => setDraft({ ...draft, container_type: e.target.value })} />
          <Input placeholder="EWC e.g. 17 09 04" value={draft.ewc} onChange={e => setDraft({ ...draft, ewc: e.target.value })} />
          <Input type="number" min={1} value={draft.bin_count} onChange={e => setDraft({ ...draft, bin_count: Number(e.target.value) })} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-2" />Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}
