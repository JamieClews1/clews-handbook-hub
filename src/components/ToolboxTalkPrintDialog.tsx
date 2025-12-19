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

interface ParsedBlock {
  type: "paragraph" | "heading" | "list-item" | "numbered-item";
  text: string;
  level?: number;
}

const parseHtmlToBlocks = (html: string): ParsedBlock[] => {
  const blocks: ParsedBlock[] = [];
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  const processNode = (node: Node, listCounter = { value: 0 }) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
        const level = parseInt(tagName.charAt(1));
        blocks.push({ type: "heading", text: el.textContent?.trim() || "", level });
      } else if (tagName === "p") {
        const text = el.textContent?.trim();
        if (text) {
          blocks.push({ type: "paragraph", text });
        }
      } else if (tagName === "ul") {
        el.querySelectorAll(":scope > li").forEach((li) => {
          const text = li.textContent?.trim();
          if (text) {
            blocks.push({ type: "list-item", text });
          }
        });
      } else if (tagName === "ol") {
        listCounter.value = 0;
        el.querySelectorAll(":scope > li").forEach((li) => {
          listCounter.value++;
          const text = li.textContent?.trim();
          if (text) {
            blocks.push({ type: "numbered-item", text, level: listCounter.value });
          }
        });
      } else if (tagName === "li") {
        // Skip - handled by parent ul/ol
      } else if (tagName === "br") {
        // Skip line breaks
      } else if (tagName === "strong" || tagName === "b" || tagName === "em" || tagName === "i") {
        // These are inline elements, handled by parent
      } else {
        // For divs and other containers, process children
        el.childNodes.forEach((child) => processNode(child, listCounter));
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && node.parentElement?.tagName.toLowerCase() === "div") {
        blocks.push({ type: "paragraph", text });
      }
    }
  };

  tempDiv.childNodes.forEach((child) => processNode(child));

  // If no blocks found, treat as plain text with line breaks
  if (blocks.length === 0) {
    const plainText = tempDiv.textContent || "";
    plainText.split(/\n+/).forEach((line) => {
      const text = line.trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
    });
  }

  return blocks;
};

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

  const translateContent = async (
    title: string,
    blocks: ParsedBlock[],
    targetLang: string
  ): Promise<{ title: string; blocks: ParsedBlock[] }> => {
    if (targetLang === "EN") {
      return { title, blocks };
    }

    try {
      const textsToTranslate = [title, ...blocks.map((b) => b.text)];
      
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("translate-toolbox-talk", {
        body: {
          texts: textsToTranslate,
          target_lang: targetLang,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      const translatedBlocks = blocks.map((block, index) => ({
        ...block,
        text: data.translations[index + 1] || block.text,
      }));

      return {
        title: data.translations[0] || title,
        blocks: translatedBlocks,
      };
    } catch (error) {
      console.error("Translation error:", error);
      return { title, blocks };
    }
  };

  const generatePDF = async () => {
    if (!toolboxTalk || selectedLanguages.length === 0) return;

    setIsGenerating(true);

    try {
      const pdf = new jsPDF();
      let isFirstPage = true;
      const blocks = parseHtmlToBlocks(toolboxTalk.content);

      for (const langCode of selectedLanguages) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        const { title, blocks: translatedBlocks } = await translateContent(
          toolboxTalk.title,
          blocks,
          langCode
        );

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
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
        const titleLines = pdf.splitTextToSize(title, contentWidth);
        pdf.text(titleLines, margin, 30);

        let yPosition = 30 + titleLines.length * 8 + 10;

        // Content blocks
        for (const block of translatedBlocks) {
          // Check if we need a new page
          if (yPosition > pageHeight - 100) {
            pdf.addPage();
            yPosition = 20;
          }

          if (block.type === "heading") {
            pdf.setFontSize(block.level === 1 ? 16 : block.level === 2 ? 14 : 12);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0);
            const headingLines = pdf.splitTextToSize(block.text, contentWidth);
            pdf.text(headingLines, margin, yPosition);
            yPosition += headingLines.length * 7 + 4;
          } else if (block.type === "paragraph") {
            pdf.setFontSize(11);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40);
            const paraLines = pdf.splitTextToSize(block.text, contentWidth);
            pdf.text(paraLines, margin, yPosition);
            yPosition += paraLines.length * 5 + 4;
          } else if (block.type === "list-item") {
            pdf.setFontSize(11);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40);
            const bulletText = `•  ${block.text}`;
            const listLines = pdf.splitTextToSize(bulletText, contentWidth - 10);
            pdf.text(listLines, margin + 5, yPosition);
            yPosition += listLines.length * 5 + 2;
          } else if (block.type === "numbered-item") {
            pdf.setFontSize(11);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40);
            const numberedText = `${block.level}.  ${block.text}`;
            const listLines = pdf.splitTextToSize(numberedText, contentWidth - 10);
            pdf.text(listLines, margin + 5, yPosition);
            yPosition += listLines.length * 5 + 2;
          }
        }

        // Signature section - ensure it fits on current page or start new page
        const signatureSectionHeight = 85;
        if (yPosition + signatureSectionHeight > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }

        const signatureY = yPosition + 15;

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text("Toolbox Talk Declaration:", margin, signatureY);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const declaration =
          "I have listened to, understood and confirm I will follow the rules and guidelines as set out in this Toolbox Talk.";
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
              Choose which languages to include in the PDF. Non-English languages will be auto-translated.
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
