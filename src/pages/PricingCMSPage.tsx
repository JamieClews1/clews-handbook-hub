import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Trash2, Copy, ExternalLink, Settings2 } from "lucide-react";
import { usePostcodeZones, type PostcodeZone } from "@/hooks/usePostcodeZones";

type SkipSize = {
  id: string;
  display_name: string;
  size_code: string;
  display_order: number;
  is_active: boolean;
};

type WasteType = {
  id: string;
  waste_type_name: string;
  display_order: number;
  is_active: boolean;
};

type PricingTier = "residential" | "tier1_trade" | "tier2_trade";

const TIER_LABELS: Record<PricingTier, string> = {
  residential: "Residential Price Matrix",
  tier1_trade: "Tier 1 Trade",
  tier2_trade: "Tier 2 Trade",
};

type PricingEntry = {
  id: string;
  skip_size_id: string;
  zone_id: string;
  waste_type_id: string;
  status: "price" | "call_for_quote" | "not_available";
  price_ex_vat: number | null;
  tier: PricingTier;
};

const PricingCMSPage = () => {
  const { toast } = useToast();
  const { zones, loading: zonesLoading } = usePostcodeZones();
  const [skipSizes, setSkipSizes] = useState<SkipSize[]>([]);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [entries, setEntries] = useState<PricingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSkipSize, setSelectedSkipSize] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<PricingTier>("residential");
  const [apiEndpoint, setApiEndpoint] = useState("");

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (projectId) {
      setApiEndpoint(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-pricing-api`);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sizesRes, typesRes, entriesRes] = await Promise.all([
      supabase.from("pricing_skip_sizes").select("*").order("display_order"),
      supabase.from("pricing_waste_types").select("*").order("display_order"),
      supabase.from("pricing_entries").select("*"),
    ]);

    if (sizesRes.data) setSkipSizes(sizesRes.data as SkipSize[]);
    if (typesRes.data) setWasteTypes(typesRes.data as WasteType[]);
    if (entriesRes.data) setEntries(entriesRes.data as PricingEntry[]);
    if (sizesRes.data?.length && !selectedSkipSize) {
      setSelectedSkipSize((sizesRes.data as SkipSize[])[0].id);
    }
    setLoading(false);
  }, [selectedSkipSize]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getEntry = (zoneId: string, wasteTypeId: string): PricingEntry | undefined =>
    entries.find(e => e.skip_size_id === selectedSkipSize && e.zone_id === zoneId && e.waste_type_id === wasteTypeId && e.tier === selectedTier);

  const updateEntry = async (zoneId: string, wasteTypeId: string, status: string, price: number | null) => {
    const existing = getEntry(zoneId, wasteTypeId);
    if (existing) {
      const { error } = await supabase.from("pricing_entries").update({
        status: status as any,
        price_ex_vat: price,
      }).eq("id", existing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setEntries(prev => prev.map(e => e.id === existing.id ? { ...e, status: status as any, price_ex_vat: price } : e));
    } else {
      const { data, error } = await supabase.from("pricing_entries").insert({
        skip_size_id: selectedSkipSize,
        zone_id: zoneId,
        waste_type_id: wasteTypeId,
        status: status as any,
        price_ex_vat: price,
        tier: selectedTier,
      } as any).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      if (data) setEntries(prev => [...prev, data as PricingEntry]);
    }
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(apiEndpoint);
    toast({ title: "Copied!", description: "API endpoint copied to clipboard." });
  };

  if (loading || zonesLoading) {
    return <AdminPageLayout title="Pricing CMS"><div className="p-8 text-center text-muted-foreground">Loading pricing data...</div></AdminPageLayout>;
  }

  return (
    <AdminPageLayout title="Pricing CMS" description="Manage skip & container pricing. Changes are reflected on the marketing site via the API.">
      <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400">
        ⚠️ All pricing shown and entered is <strong>exclusive of VAT</strong>.
      </div>
      {/* API Endpoint */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Public API Endpoint</CardTitle>
          <CardDescription>Use this URL on the marketing site to fetch live pricing data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">{apiEndpoint || "Loading..."}</code>
            <Button variant="outline" size="sm" onClick={copyEndpoint}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">GET request, no auth required. Returns JSON with all active skip sizes, zones, waste types, and pricing.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Price Matrices</TabsTrigger>
          <TabsTrigger value="sizes">Skip Sizes</TabsTrigger>
          <TabsTrigger value="wastes">Waste Types</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          {/* Tier selector tabs */}
          <Tabs value={selectedTier} onValueChange={(v) => setSelectedTier(v as PricingTier)} className="mb-4">
            <TabsList>
              {(Object.entries(TIER_LABELS) as [PricingTier, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Skip size selector */}
          <div className="mb-4 flex items-center gap-3">
            <Label className="text-sm font-medium">Container:</Label>
            <Select value={selectedSkipSize} onValueChange={setSelectedSkipSize}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {skipSizes.filter(s => s.is_active).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing matrix table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Zone</TableHead>
                      {wasteTypes.filter(w => w.is_active).map(w => (
                        <TableHead key={w.id} className="min-w-[160px] text-center">{w.waste_type_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map(zone => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">{zone.zone_name}</TableCell>
                        {wasteTypes.filter(w => w.is_active).map(wt => {
                          const entry = getEntry(zone.id, wt.id);
                          const status = entry?.status || "not_available";
                          const price = entry?.price_ex_vat;
                          return (
                            <TableCell key={wt.id} className="text-center">
                              <PricingCell
                                status={status}
                                price={price ?? null}
                                onChange={(s, p) => updateEntry(zone.id, wt.id, s, p)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sizes" className="mt-4">
          <SkipSizesManager skipSizes={skipSizes} onRefresh={fetchAll} />
        </TabsContent>

        <TabsContent value="wastes" className="mt-4">
          <WasteTypesManager wasteTypes={wasteTypes} onRefresh={fetchAll} />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

/* ── Pricing Cell ──────────────────────────────────────────────────── */

const PricingCell = ({ status, price, onChange }: { status: string; price: number | null; onChange: (s: string, p: number | null) => void }) => {
  const [editing, setEditing] = useState(false);
  const [localPrice, setLocalPrice] = useState(price?.toString() || "");
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => { setLocalStatus(status); setLocalPrice(price?.toString() || ""); }, [status, price]);

  const save = () => {
    const p = localStatus === "price" ? parseFloat(localPrice) || 0 : null;
    onChange(localStatus, p);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5 min-w-[140px]">
        <Select value={localStatus} onValueChange={setLocalStatus}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Price (£)</SelectItem>
            <SelectItem value="call_for_quote">Call for Quote</SelectItem>
            <SelectItem value="not_available">Not Available</SelectItem>
          </SelectContent>
        </Select>
        {localStatus === "price" && (
          <Input className="h-8 text-xs" type="number" step="0.01" value={localPrice} onChange={e => setLocalPrice(e.target.value)} placeholder="0.00" />
        )}
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-xs flex-1" onClick={save}><Save className="h-3 w-3 mr-1" />Save</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors">
      {status === "price" && price != null ? (
        <span className="font-semibold text-sm">£{price.toFixed(2)}</span>
      ) : status === "call_for_quote" ? (
        <Badge variant="secondary" className="text-xs">Call for Quote</Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">Not Available</Badge>
      )}
    </button>
  );
};

/* ── Skip Sizes Manager ──────────────────────────────────────────── */

const SkipSizesManager = ({ skipSizes, onRefresh }: { skipSizes: SkipSize[]; onRefresh: () => void }) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const addSize = async () => {
    if (!newName || !newCode) return;
    const { error } = await supabase.from("pricing_skip_sizes").insert({
      display_name: newName,
      size_code: newCode,
      display_order: skipSizes.length + 1,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewCode("");
    onRefresh();
    toast({ title: "Added", description: "Skip size added." });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("pricing_skip_sizes").update({ is_active: !active } as any).eq("id", id);
    onRefresh();
  };

  const deleteSize = async (id: string) => {
    await supabase.from("pricing_skip_sizes").delete().eq("id", id);
    onRefresh();
    toast({ title: "Deleted" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Skip / Container Sizes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skipSizes.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.display_name}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1 rounded">{s.size_code}</code></TableCell>
                <TableCell>{s.display_order}</TableCell>
                <TableCell><Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => deleteSize(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2">
          <Input placeholder="Display name" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" />
          <Input placeholder="Code (e.g. 8yd)" value={newCode} onChange={e => setNewCode(e.target.value)} className="w-32" />
          <Button onClick={addSize}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
};

/* ── Waste Types Manager ──────────────────────────────────────────── */

const WasteTypesManager = ({ wasteTypes, onRefresh }: { wasteTypes: WasteType[]; onRefresh: () => void }) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const addType = async () => {
    if (!newName) return;
    const { error } = await supabase.from("pricing_waste_types").insert({
      waste_type_name: newName,
      display_order: wasteTypes.length + 1,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewName("");
    onRefresh();
    toast({ title: "Added", description: "Waste type added." });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("pricing_waste_types").update({ is_active: !active } as any).eq("id", id);
    onRefresh();
  };

  const deleteType = async (id: string) => {
    await supabase.from("pricing_waste_types").delete().eq("id", id);
    onRefresh();
    toast({ title: "Deleted" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Waste Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wasteTypes.map(w => (
              <TableRow key={w.id}>
                <TableCell>{w.waste_type_name}</TableCell>
                <TableCell>{w.display_order}</TableCell>
                <TableCell><Switch checked={w.is_active} onCheckedChange={() => toggleActive(w.id, w.is_active)} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => deleteType(w.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2">
          <Input placeholder="Waste type name" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" />
          <Button onClick={addType}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingCMSPage;
