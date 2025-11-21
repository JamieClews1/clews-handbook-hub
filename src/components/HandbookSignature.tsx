import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SignaturePad } from "@/components/SignaturePad";

export const HandbookSignature = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    checkSignatureStatus();
  }, []);

  const checkSignatureStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("handbook_signatures")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasSigned(true);
        setSignatureData(data);
      }
    } catch (error) {
      console.error("Error checking signature:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignatureComplete = async (signature: string) => {
    if (!employeeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name before signing",
        variant: "destructive",
      });
      setShowSignaturePad(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be logged in to sign the handbook",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("handbook_signatures")
        .insert({
          user_id: user.id,
          employee_name: employeeName.trim(),
          signature_image: signature,
        });

      if (error) throw error;

      toast({
        title: "Handbook signed",
        description: "Thank you for acknowledging the handbook",
      });

      setShowSignaturePad(false);
      await checkSignatureStatus();
    } catch (error: any) {
      console.error("Error signing handbook:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign handbook",
        variant: "destructive",
      });
    }
  };

  const handleSign = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to sign the handbook",
        variant: "destructive",
      });
      return;
    }

    setShowSignaturePad(true);
  };

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading signature status...</p>
        </CardContent>
      </Card>
    );
  }

  if (hasSigned && signatureData) {
    return (
      <Card className="mt-8 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="text-green-900 dark:text-green-100">Handbook Acknowledged</CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            You have already signed this handbook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Received by:</p>
            <p className="font-semibold">{signatureData.employee_name}</p>
          </div>
          {signatureData.signature_image && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Signature:</p>
              <div className="border rounded-lg p-4 bg-white">
                <img 
                  src={signatureData.signature_image} 
                  alt="Signature" 
                  className="max-w-full h-auto"
                  style={{ maxHeight: "100px" }}
                />
              </div>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Date:</p>
            <p className="font-semibold">
              {format(new Date(signatureData.signed_at), "PPP")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Acknowledge Handbook</CardTitle>
          <CardDescription>
            I acknowledge I have read and understood the policies and procedures contained within this handbook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeName">Received by (Employee Name)</Label>
              <Input
                id="employeeName"
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Enter your full name"
                maxLength={100}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Signed</Label>
              <p className="text-sm text-muted-foreground">
                Click the button below to draw your signature
              </p>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <p className="text-sm font-medium">
                {format(new Date(), "PPP")}
              </p>
            </div>

            <Button type="submit" className="w-full">
              Draw Signature
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
        <DialogContent className="sm:max-w-[600px]">
          <SignaturePad
            onSave={handleSignatureComplete}
            onCancel={() => setShowSignaturePad(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
