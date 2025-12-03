import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";
import jsPDF from "jspdf";

interface ToolboxTalk {
  id: string;
  title: string;
  content: string;
  user_types: string[];
  is_mandatory: boolean;
  created_date: string;
}

interface ToolboxTalkPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolboxTalk: ToolboxTalk | null;
}

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polish" },
  { code: "UK", label: "Ukrainian" },
  { code: "RO", label: "Romanian" },
];

export const ToolboxTalkPrintDialog = ({
  open,
  onOpenChange,
  toolboxTalk,
}: ToolboxTalkPrintDialogProps) => {
  const { toast } = useToast();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["EN"]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleLanguageToggle = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const stripHtml = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const translateContent = async (
    title: string,
    content: string,
    targetLang: string
  ): Promise<{ title: string; content: string }> => {
    if (targetLang === "EN") {
      return { title, content: stripHtml(content) };
    }

    try {
      const { data, error } = await supabase.functions.invoke("translate-toolbox-talk", {
        body: {
          texts: [title, stripHtml(content)],
          target_lang: targetLang,
        },
      });

      if (error) throw error;

      return {
        title: data.translations[0] || title,
        content: data.translations[1] || stripHtml(content),
      };
    } catch (error) {
      console.error("Translation error:", error);
      return { title, content: stripHtml(content) };
    }
  };

  const generatePDF = async () => {
    if (!toolboxTalk || selectedLanguages.length === 0) return;

    setIsGenerating(true);

    try {
      const pdf = new jsPDF();
      let isFirstPage = true;

      for (const langCode of selectedLanguages) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        const { title, content } = await translateContent(
          toolboxTalk.title,
          toolboxTalk.content,
          langCode
        );

        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;

        // Header
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text(`Toolbox Talk - ${LANGUAGES.find((l) => l.code === langCode)?.label}`, margin, 15);
        pdf.text(`Date: ${new Date(toolboxTalk.created_date).toLocaleDateString()}`, pageWidth - margin - 40, 15);

        // Title
        pdf.setFontSize(18);
        pdf.setTextColor(0);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin, 30);

        // Content
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(content, contentWidth);
        let yPosition = 45;

        for (const line of lines) {
          if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        }

        // Signature section
        const signatureY = Math.max(yPosition + 20, pdf.internal.pageSize.getHeight() - 80);
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Toolbox Talk Declaration:", margin, signatureY);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const declaration = "I have listened to, understood and confirm I will follow the rules and guidelines as set out in this Toolbox Talk.";
        const declarationLines = pdf.splitTextToSize(declaration, contentWidth);
        pdf.text(declarationLines, margin, signatureY + 8);

        // Signature lines
        const sigStartY = signatureY + 25;
        for (let i = 0; i < 5; i++) {
          const rowY = sigStartY + i * 12;
          pdf.text("Name: _____________________", margin, rowY);
          pdf.text("Signed: _____________________", margin + 70, rowY);
          pdf.text("Date: ___________", margin + 140, rowY);
        }
      }

      pdf.save(`${toolboxTalk.title.replace(/[^a-z0-9]/gi, "_")}_Toolbox_Talk.pdf`);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print Toolbox Talk</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Select Languages</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Choose which languages to include in the PDF
            </p>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <div key={lang.code} className="flex items-center gap-2">
                  <Checkbox
                    id={lang.code}
                    checked={selectedLanguages.includes(lang.code)}
                    onCheckedChange={() => handleLanguageToggle(lang.code)}
                  />
                  <Label htmlFor={lang.code} className="cursor-pointer">
                    {lang.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={generatePDF}
            disabled={selectedLanguages.length === 0 || isGenerating}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
