import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type RebateItem = {
  id: string;
  name: string;
};

type MaterialType = {
  id: string;
  waste_type: string;
};

type WasteDescriptionRow = {
  waste_description: string;
  material_type_id: string | null;
  rebate_item_id: string | null;
  isSaving?: boolean;
};

interface RebateMappingSectionProps {
  canEdit: boolean;
}

export const RebateMappingSection = ({ canEdit }: RebateMappingSectionProps) => {
  const { toast } = useToast();
  const [rebateItems, setRebateItems] = useState<RebateItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [wasteDescriptions, setWasteDescriptions] = useState<WasteDescriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Calculate date 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sixMonthsAgoISO = sixMonthsAgo.toISOString().slice(0, 10);

        // Get all distinct waste descriptions from data_hub_jobs (last 6 months)
        const { data: jobsData, error: jobsError } = await supabase
          .from("data_hub_jobs")
          .select("waste_description")
          .not("waste_description", "is", null)
          .gte("job_date", sixMonthsAgoISO)
          .order("waste_description");

        if (jobsError) throw jobsError;

        // Get unique waste descriptions
        const uniqueDescriptions = [
          ...new Set(
            (jobsData ?? [])
              .map((j) => j.waste_description)
              .filter((d): d is string => !!d)
          ),
        ];

        // Get rebate items and material types in parallel
        const [{ data: itemsData, error: itemsError }, { data: materialsData, error: materialsError }] =
          await Promise.all([
            supabase.from("rebate_items").select("id, name").order("sort_order"),
            supabase.from("load_waste_types").select("id, waste_type").eq("is_active", true).order("display_order"),
          ]);

        if (itemsError) throw itemsError;
        if (materialsError) throw materialsError;
        setRebateItems((itemsData ?? []) as RebateItem[]);
        setMaterialTypes((materialsData ?? []) as MaterialType[]);

        // Get existing mappings
        const { data: mappingsData, error: mappingsError } = await supabase
          .from("data_hub_rebate_mappings")
          .select("waste_description, material_type_id, rebate_item_id");

        if (mappingsError) throw mappingsError;

        const mappingsByDescription = new Map<string, { material_type_id: string | null; rebate_item_id: string | null }>();
        for (const m of mappingsData ?? []) {
          mappingsByDescription.set(m.waste_description, {
            material_type_id: m.material_type_id,
            rebate_item_id: m.rebate_item_id,
          });
        }

        // Build rows
        const rows: WasteDescriptionRow[] = uniqueDescriptions.map((wd) => ({
          waste_description: wd,
          material_type_id: mappingsByDescription.get(wd)?.material_type_id ?? null,
          rebate_item_id: mappingsByDescription.get(wd)?.rebate_item_id ?? null,
        }));

        setWasteDescriptions(rows);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Failed to load data";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [toast]);

  const handleMappingChange = async (
    wasteDescription: string,
    field: "material_type_id" | "rebate_item_id",
    value: string | null
  ) => {
    if (!canEdit) return;

    // Mark row as saving
    setWasteDescriptions((prev) =>
      prev.map((r) =>
        r.waste_description === wasteDescription ? { ...r, isSaving: true } : r
      )
    );

    try {
      const currentRow = wasteDescriptions.find((r) => r.waste_description === wasteDescription);
      const newMaterialTypeId = field === "material_type_id" ? value : currentRow?.material_type_id;
      const newRebateItemId = field === "rebate_item_id" ? value : currentRow?.rebate_item_id;

      // Only delete if BOTH are null/none
      if (
        (newMaterialTypeId === null || newMaterialTypeId === "none") &&
        (newRebateItemId === null || newRebateItemId === "none")
      ) {
        await supabase
          .from("data_hub_rebate_mappings")
          .delete()
          .eq("waste_description", wasteDescription);

        setWasteDescriptions((prev) =>
          prev.map((r) =>
            r.waste_description === wasteDescription
              ? { ...r, material_type_id: null, rebate_item_id: null, isSaving: false }
              : r
          )
        );
      } else {
        // Upsert mapping
        const { error } = await supabase
          .from("data_hub_rebate_mappings")
          .upsert(
            {
              waste_description: wasteDescription,
              material_type_id: newMaterialTypeId === "none" ? null : newMaterialTypeId,
              rebate_item_id: newRebateItemId === "none" ? null : newRebateItemId,
            },
            { onConflict: "waste_description" }
          );

        if (error) throw error;

        setWasteDescriptions((prev) =>
          prev.map((r) =>
            r.waste_description === wasteDescription
              ? {
                  ...r,
                  material_type_id: newMaterialTypeId === "none" ? null : newMaterialTypeId,
                  rebate_item_id: newRebateItemId === "none" ? null : newRebateItemId,
                  isSaving: false,
                }
              : r
          )
        );
      }

      toast({ title: "Saved", description: `Mapping updated for "${wasteDescription}".` });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save mapping";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setWasteDescriptions((prev) =>
        prev.map((r) =>
          r.waste_description === wasteDescription ? { ...r, isSaving: false } : r
        )
      );
    }
  };

  const mappedCount = wasteDescriptions.filter((w) => w.material_type_id || w.rebate_item_id).length;
  const unmappedCount = wasteDescriptions.length - mappedCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle>Rebate Mapping</CardTitle>
            <p className="text-sm text-muted-foreground">
              Map Performance Hub waste descriptions (last 6 months) to rebate pricing items.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{mappedCount} mapped</Badge>
            {unmappedCount > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                {unmappedCount} unmapped
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Waste Description (Data Hub)</TableHead>
                  <TableHead className="w-[200px]">Material Type</TableHead>
                  <TableHead className="w-[200px]">Value Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteDescriptions.map((row) => (
                  <TableRow
                    key={row.waste_description}
                    className={!row.material_type_id && !row.rebate_item_id ? "bg-amber-50/50" : ""}
                  >
                    <TableCell className="font-medium">{row.waste_description}</TableCell>
                    <TableCell>
                      <Select
                        value={row.material_type_id ?? "none"}
                        onValueChange={(v) =>
                          handleMappingChange(row.waste_description, "material_type_id", v === "none" ? null : v)
                        }
                        disabled={!canEdit || row.isSaving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— No rebate —</SelectItem>
                          {materialTypes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.waste_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.rebate_item_id ?? "none"}
                          onValueChange={(v) =>
                            handleMappingChange(row.waste_description, "rebate_item_id", v === "none" ? null : v)
                          }
                          disabled={!canEdit || row.isSaving}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Not mapped —</SelectItem>
                            {rebateItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {row.isSaving && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {wasteDescriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center py-8">
                      No waste descriptions found in Data Hub.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground mt-4">
            View-only: you don't have permission to edit mappings.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
