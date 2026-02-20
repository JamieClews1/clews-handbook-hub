import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Save, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Known Midweigh product codes for the dropdown
const KNOWN_PRODUCTS = [
  "MIX MUN", "CARD", "WOOD-C", "GREEN", "WASTE OUT", "HARD", "TROMMEL",
  "WOOD A", "WOOD-C OUT", "OUTHAR", "FRIDGE", "POPS -TONNE", "CARDOUT",
  "CO MINGLE", "PLASTER", "CON", "OUT-FER", "RDF", "PAPER", "FERROUS",
  "PLASTICS", "NON FER", "INERT", "POPS-LARGE", "WEEE", "PLAST OUT",
  "NONRE", "WOOD A OUT", "FARM PL", "GLASS", "FRIDGECOM",
  "WASTE OUT (FOR RDF)", "MATT", "TYRE 1", "PAPER OUT", "RAIL MILLING",
  "MIXMET", "WEE-IT", "PLASTIC PACKAGING", "CARDB", "PLAS CON",
  "CO MIN PAL", "COFFIN", "ASH YELO", "ASBESTOS", "BATTER", "HAZWOOD",
  "SILAGE", "TVS", "POPS-SMALL", "ASH", "BULK", "COAL",
].sort();

interface MappingRow {
  id: string;
  skiptrak_waste_description: string;
  midweigh_product_code: string;
}

const MidweighProductMappings = () => {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  // Fetch existing mappings
  const { data: mappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["midweigh-product-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("midweigh_product_mappings")
        .select("*")
        .order("skiptrak_waste_description");
      if (error) throw error;
      return data as MappingRow[];
    },
  });

  // Fetch unmapped skiptrak waste descriptions (from blank-product midweigh records)
  const { data: unmappedDescriptions, isLoading: loadingUnmapped } = useQuery({
    queryKey: ["unmapped-skiptrak-descriptions"],
    queryFn: async () => {
      // Get distinct skiptrak waste descriptions that match blank-product midweigh records
      // We do this in batches since it's a join
      const allDescs: { waste_description: string; count: number }[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("waste_description")
          .eq("source", "skiptrak")
          .not("waste_description", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((r) => {
          if (r.waste_description) {
            const existing = allDescs.find((d) => d.waste_description === r.waste_description);
            if (existing) existing.count++;
            else allDescs.push({ waste_description: r.waste_description, count: 1 });
          }
        });
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allDescs.sort((a, b) => b.count - a.count);
    },
  });

  // Save mapping
  const saveMutation = useMutation({
    mutationFn: async ({ description, productCode }: { description: string; productCode: string }) => {
      const { error } = await supabase
        .from("midweigh_product_mappings")
        .upsert(
          { skiptrak_waste_description: description, midweigh_product_code: productCode },
          { onConflict: "skiptrak_waste_description" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midweigh-product-mappings"] });
      toast.success("Mapping saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete mapping
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("midweigh_product_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midweigh-product-mappings"] });
      toast.success("Mapping removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Combine existing mappings with unmapped descriptions
  const allDescriptions = useMemo(() => {
    if (!unmappedDescriptions) return [];
    const mappedSet = new Set(mappings?.map((m) => m.skiptrak_waste_description) || []);
    return unmappedDescriptions.filter((d) => !mappedSet.has(d.waste_description));
  }, [unmappedDescriptions, mappings]);

  const isLoading = loadingMappings || loadingUnmapped;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Midweigh Product Mappings</CardTitle>
            <CardDescription>
              Link Skiptrak waste descriptions to Midweigh Product codes for records where Product is blank.
              When a Midweigh ticket has no Product, the system looks up the matching Skiptrak ticket (by job number) and applies this mapping.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Existing Mappings */}
            {mappings && mappings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Active Mappings</h3>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skiptrak Waste Description</TableHead>
                        <TableHead>→ Midweigh Product Code</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.skiptrak_waste_description}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              {m.midweigh_product_code}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(m.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Unmapped Descriptions */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Unmapped Skiptrak Descriptions
                <span className="text-muted-foreground font-normal ml-2">
                  ({allDescriptions.length} remaining)
                </span>
              </h3>
              {allDescriptions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>All descriptions have been mapped</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skiptrak Waste Description</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Assign Product Code</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allDescriptions.map((desc) => (
                        <TableRow key={desc.waste_description}>
                          <TableCell className="font-medium">{desc.waste_description}</TableCell>
                          <TableCell className="text-muted-foreground">{desc.count.toLocaleString()}</TableCell>
                          <TableCell>
                            <Select
                              value={pendingChanges[desc.waste_description] || ""}
                              onValueChange={(v) =>
                                setPendingChanges((prev) => ({ ...prev, [desc.waste_description]: v }))
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select product..." />
                              </SelectTrigger>
                              <SelectContent>
                                {KNOWN_PRODUCTS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!pendingChanges[desc.waste_description] || saveMutation.isPending}
                              onClick={() => {
                                saveMutation.mutate({
                                  description: desc.waste_description,
                                  productCode: pendingChanges[desc.waste_description],
                                });
                                setPendingChanges((prev) => {
                                  const next = { ...prev };
                                  delete next[desc.waste_description];
                                  return next;
                                });
                              }}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MidweighProductMappings;
