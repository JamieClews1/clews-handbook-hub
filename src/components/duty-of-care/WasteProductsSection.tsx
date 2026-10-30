import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { filterProducts, PRODUCT_STATUS, type WasteProduct, type WasteProductStatus } from "@/lib/waste-products";

export function useWasteProducts() {
  return useQuery({ queryKey: ["waste_products"], queryFn: async () => {
    const { data, error } = await supabase.from("waste_products").select("id,recorded_name,display_name,ewc_code,status,notes").order("ewc_code").order("display_name");
    if (error) throw error; return (data ?? []) as WasteProduct[];
  } });
}

export function WasteProductsSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useWasteProducts();
  const [q, setQ] = useState(""); const [status, setStatus] = useState<WasteProductStatus | "all">("all");
  const [edit, setEdit] = useState<WasteProduct | null>(null);
  const save = useMutation({
    mutationFn: async (p: WasteProduct) => {
      const { error } = await supabase.from("waste_products").update({ display_name: p.display_name.trim(), ewc_code: p.ewc_code.trim(), status: p.status, notes: p.notes?.trim() || null, updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["waste_products"] }); setEdit(null); toast.success("Product saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = filterProducts(data, q, status);
  const review = data.filter(p => p.status === "needs_review").length;

  return <section className="space-y-3">
    <div>
      <h2 className="text-xl font-semibold">Products</h2>
      <p className="text-sm text-muted-foreground">Each product name as recorded on Midweigh tickets, with a clear name and its usual waste code. {review > 0 && <strong className="text-foreground">{review} need review.</strong>} Changes here don't alter past tickets.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product or waste code" className="max-w-sm" aria-label="Search products" />
      <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
        <SelectTrigger className="w-[180px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All products</SelectItem>{Object.entries(PRODUCT_STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {error ? <p className="text-sm text-destructive">Products could not be loaded.</p> : <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr><th className="p-3 font-semibold">Product name</th><th className="p-3 font-semibold">Recorded on tickets as</th><th className="p-3 font-semibold">Waste code</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Notes</th>{isAdmin && <th className="p-3" />}</tr></thead>
        <tbody className="divide-y divide-border">
          {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={6}>Loading…</td></tr>}
          {!isLoading && rows.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No matching products.</td></tr>}
          {rows.map(p => <tr key={p.id} className="align-top">
            <td className="p-3 font-medium">{p.display_name}</td>
            <td className="p-3 text-muted-foreground">{p.recorded_name}</td>
            <td className="p-3 font-mono whitespace-nowrap">{p.ewc_code}</td>
            <td className="p-3"><Badge variant={p.status === "needs_review" ? "destructive" : p.status === "retired" ? "outline" : "secondary"}>{PRODUCT_STATUS[p.status]}</Badge></td>
            <td className="p-3 text-muted-foreground max-w-[320px]">{p.notes}</td>
            {isAdmin && <td className="p-3"><Button variant="ghost" size="icon" aria-label={`Edit ${p.display_name}`} onClick={() => setEdit({ ...p })}><Pencil className="h-4 w-4" /></Button></td>}
          </tr>)}
        </tbody>
      </table>
    </div>}
    <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
        {edit && <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Recorded on tickets as <strong className="text-foreground">{edit.recorded_name}</strong></p>
          <label className="block space-y-1 text-sm font-medium">Product name<Input value={edit.display_name} onChange={e => setEdit({ ...edit, display_name: e.target.value })} /></label>
          <label className="block space-y-1 text-sm font-medium">Usual waste code<Input value={edit.ewc_code} onChange={e => setEdit({ ...edit, ewc_code: e.target.value })} /></label>
          <div className="space-y-1 text-sm font-medium">Status<Select value={edit.status} onValueChange={v => setEdit({ ...edit, status: v as WasteProductStatus })}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRODUCT_STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <label className="block space-y-1 text-sm font-medium">Notes<Textarea value={edit.notes ?? ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.display_name.trim() || !edit?.ewc_code.trim() || save.isPending} onClick={() => edit && save.mutate(edit)}>Save product</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}