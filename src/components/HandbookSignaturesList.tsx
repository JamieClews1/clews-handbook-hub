import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface Signature {
  id: string;
  employee_name: string;
  signed_at: string;
  created_at: string;
  signature_image: string | null;
}

export const HandbookSignaturesList = () => {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSignatures();
  }, []);

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from("handbook_signatures")
        .select("*")
        .order("signed_at", { ascending: false });

      if (error) throw error;

      setSignatures(data || []);
    } catch (error) {
      console.error("Error fetching signatures:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading signatures...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handbook Signatures</CardTitle>
        <CardDescription>
          {signatures.length} {signatures.length === 1 ? "employee has" : "employees have"} signed the handbook
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signatures.length === 0 ? (
          <p className="text-muted-foreground">No signatures yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Date Signed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signatures.map((signature) => (
                <TableRow key={signature.id}>
                  <TableCell className="font-medium">{signature.employee_name}</TableCell>
                  <TableCell>
                    {signature.signature_image ? (
                      <img 
                        src={signature.signature_image} 
                        alt={`${signature.employee_name}'s signature`}
                        className="max-w-[150px] h-auto border rounded p-1"
                        style={{ maxHeight: "50px" }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">No signature</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(signature.signed_at), "PPP")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
