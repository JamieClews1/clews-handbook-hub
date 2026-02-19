import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import clewsLogo from "@/assets/clews-logo.png";

interface CertificateOfDestructionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportDate: string;
  totalWeightKg: number;
  totalPallets: number;
  reportId: string;
  jobNumber?: string;
  customerName?: string;
  onGenerated?: () => void;
}

export const CertificateOfDestruction = ({
  open,
  onOpenChange,
  reportDate,
  totalWeightKg,
  totalPallets,
  reportId,
  jobNumber,
  customerName,
  onGenerated,
}: CertificateOfDestructionProps) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [destructionMethod, setDestructionMethod] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [palletDescriptions, setPalletDescriptions] = useState<string[]>([]);

  // Reset form and fetch line items when dialog opens
  useEffect(() => {
    if (open) {
      setDestructionMethod("");
      setSignerName("");
      setSignerPosition("");
      setHasSignature(false);
      setPalletDescriptions([]);

      // Fetch line items for pallet descriptions
      if (reportId) {
        supabase
          .from("load_line_items")
          .select("waste_type, pallet_count")
          .eq("load_report_id", reportId)
          .order("display_order")
          .then(({ data }) => {
            if (data && data.length > 0) {
              setPalletDescriptions(
                data.map((item) => `${item.waste_type} (${item.pallet_count} pallets)`)
              );
            }
          });
      }
    }
  }, [open, reportId]);

  // Initialize canvas when dialog opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
    return () => clearTimeout(timer);
  }, [open]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const canDownload = destructionMethod.trim() && signerName.trim() && signerPosition.trim() && hasSignature;

  const generatePDF = async () => {
    if (!canDownload) return;

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Load logo
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = clewsLogo;
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const logoHeight = 20;
        const logoWidth = (logoImg.naturalWidth / logoImg.naturalHeight) * logoHeight;
        pdf.addImage(logoImg, "PNG", (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
        y += logoHeight + 10;
      }

      // Title
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("CERTIFICATE OF DESTRUCTION", pageWidth / 2, y, { align: "center" });
      y += 12;

      // Divider
      pdf.setDrawColor(0, 128, 0);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Details
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);

      const addField = (label: string, value: string) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(label, margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(value, margin + 55, y);
        y += 8;
      };

      const formattedDate = new Date(reportDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      addField("Date:", formattedDate);
      if (customerName) addField("Customer:", customerName);
      if (jobNumber) addField("Job Number:", jobNumber);
      addField("Total Weight:", `${totalWeightKg.toLocaleString()} KG`);
      addField("No. of Pallets:", totalPallets.toLocaleString());
      y += 2;

      // Pallet descriptions
      if (palletDescriptions.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Description of Pallets:", margin, y);
        y += 7;
        pdf.setFont("helvetica", "normal");
        palletDescriptions.forEach((desc) => {
          pdf.text(`• ${desc}`, margin + 4, y);
          y += 6;
        });
        y += 4;
      }

      // Method of destruction
      pdf.setFont("helvetica", "bold");
      pdf.text("Method of Destruction:", margin, y);
      y += 7;
      pdf.setFont("helvetica", "normal");
      const methodLines = pdf.splitTextToSize(destructionMethod, pageWidth - margin * 2);
      pdf.text(methodLines, margin, y);
      y += methodLines.length * 6 + 8;

      // Declaration
      pdf.setDrawColor(0, 128, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      const declaration = "I hereby certify that the above materials have been destroyed in accordance with the method described above and in compliance with all applicable environmental and waste management regulations.";
      const declLines = pdf.splitTextToSize(declaration, pageWidth - margin * 2);
      pdf.text(declLines, margin, y);
      y += declLines.length * 5 + 12;

      // Signatory details
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      addField("Name:", signerName);
      addField("Position:", signerPosition);
      y += 4;

      // Signature
      pdf.setFont("helvetica", "bold");
      pdf.text("Signature:", margin, y);
      y += 4;

      const canvas = canvasRef.current;
      if (canvas) {
        const sigData = canvas.toDataURL("image/png");
        pdf.addImage(sigData, "PNG", margin, y, 60, 25);
        y += 30;
      }

      // Footer line
      y += 5;
      pdf.setDrawColor(0, 128, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120, 120, 120);
      pdf.text("Clews Recycling Limited — Certificate of Destruction", pageWidth / 2, y, { align: "center" });

      const fileName = `COD-${jobNumber || "report"}-${reportDate}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Certificate downloaded",
        description: `${fileName} has been saved.`,
      });

      onGenerated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error generating PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Certificate of Destruction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">
                {new Date(reportDate).toLocaleDateString("en-GB")}
              </span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{customerName}</span>
              </div>
            )}
            {jobNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job Number:</span>
                <span className="font-medium">{jobNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Weight:</span>
              <span className="font-medium">{totalWeightKg.toLocaleString()} KG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. of Pallets:</span>
              <span className="font-medium">{totalPallets.toLocaleString()}</span>
            </div>
            {palletDescriptions.length > 0 && (
              <div className="pt-1">
                <span className="text-muted-foreground text-xs">Description of Pallets:</span>
                <ul className="list-disc list-inside text-xs mt-0.5">
                  {palletDescriptions.map((desc, i) => (
                    <li key={i}>{desc}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Method of destruction */}
          <div className="space-y-2">
            <Label htmlFor="destruction-method">How was it destroyed? *</Label>
            <Textarea
              id="destruction-method"
              placeholder="Describe the method of destruction..."
              value={destructionMethod}
              onChange={(e) => setDestructionMethod(e.target.value)}
              rows={3}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="signer-name">Name *</Label>
            <Input
              id="signer-name"
              placeholder="Enter your full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label htmlFor="signer-position">Position *</Label>
            <Input
              id="signer-position"
              placeholder="Enter your position / job title"
              value={signerPosition}
              onChange={(e) => setSignerPosition(e.target.value)}
            />
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Signature *</Label>
              <Button variant="ghost" size="sm" onClick={clearSignature}>
                Clear
              </Button>
            </div>
            <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full touch-none cursor-crosshair"
                style={{ height: "120px" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>

          {/* Download */}
          <Button
            onClick={generatePDF}
            disabled={!canDownload}
            className="w-full h-12 text-base gap-2"
          >
            <Download className="h-5 w-5" />
            Download Certificate (PDF)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
