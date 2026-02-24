import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Settings } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const ContaminationChargeMatrix = () => {
  const queryClient = useQueryClient();
  const [newType, setNewType] = useState("");
  const [newCharge, setNewCharge] = useState("");
  const [newTemplate, setNewTemplate] = useState("");

  const { data: matrix = [], refetch } = useQuery({
    queryKey: ["contamination-charge-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_charge_matrix")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const handleAdd = async () => {
    if (!newType.trim() || !newCharge) {
      toast({ title: "Enter type and charge value", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("contamination_charge_matrix").insert({
      contamination_type: newType.trim(),
      charge_value: parseFloat(newCharge),
      description_template: newTemplate.trim() || null,
      display_order: matrix.length,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewType("");
    setNewCharge("");
    setNewTemplate("");
    toast({ title: "Charge type added" });
    refetch();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("contamination_charge_matrix").update({ is_active: !current }).eq("id", id);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("contamination_charge_matrix").delete().eq("id", id);
    toast({ title: "Charge type deleted" });
    refetch();
  };

  const handleUpdateCharge = async (id: string, value: string) => {
    await supabase.from("contamination_charge_matrix").update({ charge_value: parseFloat(value) }).eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Contamination Charge Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contamination Type</TableHead>
                <TableHead>Charge (£)</TableHead>
                <TableHead className="hidden md:table-cell">Description Template</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.contamination_type}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      defaultValue={item.charge_value}
                      onBlur={(e) => handleUpdateCharge(item.id, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {item.description_template || "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item.id, item.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete charge type?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{item.contamination_type}" from the matrix.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {matrix.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No charge types configured yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add New */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add New Charge Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Contamination Type</Label>
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="e.g. Waste in wood skip"
              />
            </div>
            <div>
              <Label>Charge Value (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={newCharge}
                onChange={(e) => setNewCharge(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <Label>Description Template (optional)</Label>
            <Textarea
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="Template text used in email..."
              rows={2}
            />
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Charge Type
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContaminationChargeMatrix;
