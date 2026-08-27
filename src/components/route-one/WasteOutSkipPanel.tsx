import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Scale, Link2, X } from "lucide-react";

type Txn = {
  id: string;
  ticket_number: string;
  customer: string | null;
  site: string | null;
  vehicle_reg: string | null;
  vehicle_type: string | null;
  container_type: string | null;
  carrier_name: string | null;
  waste_description: string | null;
  ewc_code: string | null;
  net_weight_kg: number | null;
  second_weigh_at: string | null;
  first_weigh_at: string | null;
  status: string;
};

const tonnes = (kg: number | null | undefined) =>
  kg == null ? "" : (Math.round((kg / 1000) * 100) / 100).toString();

/**
 * Waste-out skip: the load is weighed on WeighOne (weighbridge) on the way out
 * and linked back to the RouteOne job so the ticket carries the outbound weight.
 */
export function WasteOutSkipPanel({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("weighbridge_transactions")
      .select(
        "id, ticket_number, customer, site, vehicle_reg, vehicle_type, container_type, carrier_name, waste_description, ewc_code, net_weight_kg, second_weigh_at, first_weigh_at, status",
      )
      .order("created_at", { ascending: false })
      .limit(40);
    const term = search.trim();
    if (term) {
      q = q.or(
        `ticket_number.ilike.%${term}%,customer.ilike.%${term}%,vehicle_reg.ilike.%${term}%,waste_description.ilike.%${term}%`,
      );
    }
    const { data, error } = await q;
    if (error) console.error("Weighbridge lookup failed", error);
    setRows((data as Txn[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = (t: Txn) => {
    setForm({
      ...form,
      weighbridge_transaction_id: t.id,
      weighbridge_ticket_number: t.ticket_number,
      outbound_weight_t: tonnes(t.net_weight_kg),
      destination_name: form.destination_name || t.customer || "",
      customer_name: form.customer_name || t.customer || "",
      vehicle_reg: t.vehicle_reg || form.vehicle_reg,
      carrier_name: t.carrier_name || form.carrier_name,
      container_type: t.container_type || form.container_type,
      waste_type: t.waste_description || form.waste_type,
      ewc_code: t.ewc_code || form.ewc_code,
    });
    setOpen(false);
  };

  const unlink = () =>
    setForm({ ...form, weighbridge_transaction_id: "", weighbridge_ticket_number: "" });

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5" /> Waste Out — Weighbridge Load
        </h4>
        <div className="flex items-center gap-2">
          {form.weighbridge_ticket_number && (
            <Badge variant="secondary" className="text-[10px]">
              Ticket {form.weighbridge_ticket_number}
              <button type="button" onClick={unlink} className="ml-1.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setOpen(true)}>
            <Link2 className="h-3.5 w-3.5" /> Link WeighOne ticket
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Weight Out (t)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.outbound_weight_t ?? ""}
            onChange={(e) => setForm({ ...form, outbound_weight_t: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Receiving Site / Outlet</Label>
          <Input
            value={form.destination_name || ""}
            onChange={(e) => setForm({ ...form, destination_name: e.target.value })}
            placeholder="e.g. Nevis Resources Ltd"
          />
        </div>
        <div>
          <Label className="text-xs">Receiving Site Address</Label>
          <Input
            value={form.destination_address || ""}
            onChange={(e) => setForm({ ...form, destination_address: e.target.value })}
            placeholder="Address / postcode"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The transfer note prints Clews Recycling as the waste producer and the receiving site as the disposal point.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Link a WeighOne ticket</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search ticket no, customer, reg, waste…"
            />
            <Button type="button" variant="outline" onClick={load}>Search</Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {!loading && rows.length === 0 && (
              <p className="text-xs text-muted-foreground">No weighbridge tickets found.</p>
            )}
            {rows.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => apply(t)}
                className="w-full text-left rounded border border-border px-3 py-2 text-xs hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{t.ticket_number}</span>
                  <span className="text-muted-foreground">
                    {t.net_weight_kg != null ? `${tonnes(t.net_weight_kg)} t` : "no weight"} · {t.status}
                  </span>
                </div>
                <div className="text-muted-foreground truncate">
                  {[t.customer, t.vehicle_reg, t.container_type, t.waste_description].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WasteOutSkipPanel;
