import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, ImageIcon, Loader2, Check, AlertTriangle } from "lucide-react";

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type ExtractedEntry = {
  itemId: string | null;
  itemName?: string;
  unmatchedName?: string;
  month: number;
  lower: number;
  higher: number;
  selected?: boolean;
};

type ExtractedData = {
  year: number;
  tableTitle?: string;
  entries: ExtractedEntry[];
};

type Props = {
  items: RebateItem[];
  canEdit: boolean;
  onValuesImported: () => void;
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const RebateScreenshotUpload = ({ items, canEdit, onValuesImported }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-rebate-screenshot", {
        body: {
          imageBase64: base64,
          rebateItems: items.map((i) => ({ id: i.id, name: i.name })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to parse screenshot");

      const extracted = data.data as ExtractedData;

      // Only keep entries that have matched items
      const matchedEntries = extracted.entries.filter((e) => e.itemId);
      const unmatchedEntries = extracted.entries.filter((e) => !e.itemId);

      if (matchedEntries.length === 0) {
        toast({
          title: "No matches found",
          description: `Could not match any items. Unmatched: ${unmatchedEntries.map((e) => e.unmatchedName).join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      // Default all matched entries to selected
      const selections: Record<string, boolean> = {};
      matchedEntries.forEach((entry, idx) => {
        selections[`${idx}`] = true;
      });

      setExtractedData({ ...extracted, entries: matchedEntries });
      setSelectedEntries(selections);
      setDialogOpen(true);

      if (unmatchedEntries.length > 0) {
        toast({
          title: "Some items unmatched",
          description: `Could not match: ${unmatchedEntries.map((e) => e.unmatchedName).join(", ")}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Processing failed",
        description: err?.message || "Could not extract data from screenshot.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!extractedData) return;
    setIsSaving(true);

    try {
      const entriesToImport = extractedData.entries.filter((_, idx) => selectedEntries[`${idx}`]);

      if (entriesToImport.length === 0) {
        toast({ title: "Nothing selected", description: "Select at least one entry to import.", variant: "destructive" });
        setIsSaving(false);
        return;
      }

      const payload = entriesToImport.map((entry) => ({
        month_start: `${extractedData.year}-${String(entry.month).padStart(2, "0")}-01`,
        item_id: entry.itemId!,
        lower_range: entry.lower,
        higher_range: entry.higher,
      }));

      const { error } = await supabase
        .from("rebate_monthly_values")
        .upsert(payload, { onConflict: "month_start,item_id" });

      if (error) throw error;

      toast({
        title: "Import complete",
        description: `${entriesToImport.length} rebate value(s) imported for ${extractedData.year}.`,
      });

      setDialogOpen(false);
      setExtractedData(null);
      onValuesImported();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Import failed",
        description: err?.message || "Could not save rebate values.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!extractedData) return;
    const next: Record<string, boolean> = {};
    extractedData.entries.forEach((_, idx) => {
      next[`${idx}`] = checked;
    });
    setSelectedEntries(next);
  };

  const allSelected = extractedData
    ? extractedData.entries.every((_, idx) => selectedEntries[`${idx}`])
    : false;

  if (!canEdit) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ImageIcon className="h-4 w-4" />
            Upload Screenshot
          </>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Rebate Values</DialogTitle>
            <DialogDescription>
              {extractedData?.tableTitle && <span className="font-medium">{extractedData.tableTitle} — </span>}
              Year: {extractedData?.year}. Select which values to import.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Rebate Item</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Lower</TableHead>
                  <TableHead className="text-right">Higher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedData?.entries.map((entry, idx) => {
                  const item = items.find((i) => i.id === entry.itemId);
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={!!selectedEntries[`${idx}`]}
                          onCheckedChange={(checked) =>
                            setSelectedEntries((prev) => ({ ...prev, [`${idx}`]: !!checked }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item?.name || entry.itemName || (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {entry.unmatchedName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{MONTH_NAMES[entry.month]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{entry.lower}</TableCell>
                      <TableCell className="text-right font-mono">{entry.higher}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Import Selected
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
