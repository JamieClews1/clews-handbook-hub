import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Trash2, Plus } from "lucide-react";
import {
  FLAT_ZONE,
  TONNAGE_SECTION,
  type RateRow,
  type RateValue,
  type RateZone,
  useRateCardData,
} from "./useRateCard";

type Props = { cardId: string; highlightZoneCode?: string | null };

const STATUS_LABELS: Record<string, string> = {
  price: "Price (£)",
  call_for_quote: "Call for Quote",
  na: "Not Available",
  text: "Custom Text",
};

export function RateCardEditor({ cardId, highlightZoneCode }: Props) {
  const { toast } = useToast();
  const { zones, rows, values, loading, refresh } = useRateCardData(cardId);

  const valueMap = useMemo(() => {
    const m = new Map<string, RateValue>();
    for (const v of values) m.set(`${v.row_id}:${v.zone_id}`, v);
    return m;
  }, [values]);

  const matrixZones = useMemo(
    () => zones.filter((z) => z.zone_code !== FLAT_ZONE),
    [zones],
  );
  const flatZone = useMemo(() => zones.find((z) => z.zone_code === FLAT_ZONE), [zones]);

  const matrixRows = useMemo(
    () => rows.filter((r) => r.section !== TONNAGE_SECTION),
    [rows],
  );
  const flatRows = useMemo(
    () => rows.filter((r) => r.section === TONNAGE_SECTION),
    [rows],
  );

  // group matrix rows by section preserving order
  const sections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, RateRow[]>();
    for (const r of matrixRows) {
      const s = r.section || "Rates";
      if (!map.has(s)) {
        map.set(s, []);
        order.push(s);
      }
      map.get(s)!.push(r);
    }
    return order.map((s) => ({ section: s, rows: map.get(s)! }));
  }, [matrixRows]);

  const saveValue = async (
    rowId: string,
    zoneId: string,
    status: string,
    price: number | null,
    text: string | null,
  ) => {
    const { error } = await supabase
      .from("pricing_rate_card_values")
      .upsert(
        { row_id: rowId, zone_id: zoneId, status, price, text_value: text },
        { onConflict: "row_id,zone_id" },
      );
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const addRow = async (section: string) => {
    const label = window.prompt(`New row label for "${section}"`);
    if (!label) return;
    const maxOrder = Math.max(0, ...rows.map((r) => r.display_order)) + 1;
    const { error } = await supabase
      .from("pricing_rate_card_rows")
      .insert({ card_id: cardId, section, label, display_order: maxOrder });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const deleteRow = async (rowId: string) => {
    if (!window.confirm("Delete this row and its prices?")) return;
    await supabase.from("pricing_rate_card_rows").delete().eq("id", rowId);
    refresh();
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading rate card…</div>;
  }

  if (!zones.length) {
    return <div className="p-8 text-center text-muted-foreground">This rate card has no zones yet.</div>;
  }

  return (
    <div className="space-y-6">
      {sections.map(({ section, rows: secRows }) => (
        <Card key={section}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">{section}</h3>
              <Button size="sm" variant="ghost" onClick={() => addRow(section)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Item</TableHead>
                    {matrixZones.map((z) => (
                      <TableHead
                        key={z.id}
                        className={`min-w-[130px] text-center ${
                          highlightZoneCode && z.zone_code === highlightZoneCode
                            ? "bg-primary/10 text-primary"
                            : ""
                        }`}
                      >
                        {z.zone_name || z.zone_code}
                      </TableHead>
                    ))}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium align-top">
                        {row.label}
                        {row.note && (
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">{row.note}</p>
                        )}
                      </TableCell>
                      {matrixZones.map((z) => (
                        <TableCell
                          key={z.id}
                          className={`text-center ${
                            highlightZoneCode && z.zone_code === highlightZoneCode ? "bg-primary/5" : ""
                          }`}
                        >
                          <PriceCell
                            value={valueMap.get(`${row.id}:${z.id}`)}
                            onSave={(s, p, t) => saveValue(row.id, z.id, s, p, t)}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteRow(row.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {flatZone && flatRows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">{TONNAGE_SECTION}</h3>
              <Button size="sm" variant="ghost" onClick={() => addRow(TONNAGE_SECTION)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Material</TableHead>
                    <TableHead className="min-w-[150px] text-center">Rate</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.label}
                        {row.unit && <span className="text-xs text-muted-foreground ml-2">({row.unit})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <PriceCell
                          value={valueMap.get(`${row.id}:${flatZone.id}`)}
                          onSave={(s, p, t) => saveValue(row.id, flatZone.id, s, p, t)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteRow(row.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PriceCell({
  value,
  onSave,
}: {
  value: RateValue | undefined;
  onSave: (status: string, price: number | null, text: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string>(value?.status || "na");
  const [price, setPrice] = useState(value?.price?.toString() || "");
  const [text, setText] = useState(value?.text_value || "");

  const begin = () => {
    setStatus(value?.status || "na");
    setPrice(value?.price?.toString() || "");
    setText(value?.text_value || "");
    setEditing(true);
  };

  const save = () => {
    const p = status === "price" ? parseFloat(price) || 0 : null;
    const t = status === "text" ? text : null;
    onSave(status, p, t);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5 min-w-[130px] text-left">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status === "price" && (
          <Input
            className="h-8 text-xs"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        )}
        {status === "text" && (
          <Input
            className="h-8 text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Custom text"
          />
        )}
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-xs flex-1" onClick={save}>
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={begin}
      className="w-full text-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors"
    >
      {value?.status === "price" && value.price != null ? (
        <span className="font-semibold text-sm">£{value.price.toFixed(2)}</span>
      ) : value?.status === "call_for_quote" ? (
        <Badge variant="secondary" className="text-xs">
          Call for Quote
        </Badge>
      ) : value?.status === "text" ? (
        <span className="text-xs">{value.text_value}</span>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          —
        </Badge>
      )}
    </button>
  );
}
