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
        blocks.push({ type: "heading", text: el.textContent?.trim() || "", level: parseInt(tagName.charAt(1)) });
      } else if (tagName === "p") {
        const text = el.textContent?.trim();
        if (text) blocks.push({ type: "paragraph", text });
      } else if (tagName === "ul") {
        el.querySelectorAll(":scope > li").forEach((li) => {
          const text = li.textContent?.trim();
          if (text) blocks.push({ type: "list-item", text });
        });
      } else if (tagName === "ol") {
        listCounter.value = 0;
        el.querySelectorAll(":scope > li").forEach((li) => {
          listCounter.value++;
          const text = li.textContent?.trim();
          if (text) blocks.push({ type: "numbered-item", text, level: listCounter.value });
        });
      } else {
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
  if (blocks.length === 0) {
    (tempDiv.textContent || "").split(/\n+/).forEach((line) => {
      const text = line.trim();
      if (text) blocks.push({ type: "paragraph", text });
    });
  }
  return blocks;
};

const renderCompactPage = (
  pdf: jsPDF,
  title: string,
  blocks: ParsedBlock[],
  langLabel: string,
  createdDate: string,
  userTypes: string[]
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;

  // Header bar
  pdf.setFillColor(30, 64, 42);
  pdf.rect(0, 0, pageWidth, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("CLEWS RECYCLING — TOOLBOX TALK", marginL, 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`${langLabel}  |  ${new Date(createdDate).toLocaleDateString("en-GB")}`, marginL, 13);
  const audienceStr = userTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
  if (audienceStr) pdf.text(`Audience: ${audienceStr}`, pageWidth - marginR, 13, { align: "right" });

  // Title
  let y = 25;
  pdf.setTextColor(30, 64, 42);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleLines, marginL, y);
  y += titleLines.length * 7 + 3;
  pdf.setDrawColor(30, 64, 42);
  pdf.setLineWidth(0.4);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;

  const addPageIfNeeded = (space: number) => {
    if (y + space > pageHeight - 20) {
      pdf.addPage();
      y = 15;
    }
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      addPageIfNeeded(12);
      if (y > 30) y += 2;
      pdf.setFontSize(block.level === 1 ? 13 : block.level === 2 ? 11 : 10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 42);
      const lines = pdf.splitTextToSize(block.text, contentWidth);
      pdf.text(lines, marginL, y);
      y += lines.length * 5 + 2;
    } else if (block.type === "paragraph") {
      addPageIfNeeded(8);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(block.text, contentWidth);
      pdf.text(lines, marginL, y);
      y += lines.length * 4 + 2;
    } else if (block.type === "list-item") {
      addPageIfNeeded(6);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(`•  ${block.text}`, contentWidth - 6);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 4 + 1;
    } else if (block.type === "numbered-item") {
      addPageIfNeeded(6);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(`${block.level}.  ${block.text}`, contentWidth - 6);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 4 + 1;
    }
  }

  // Signature section
  addPageIfNeeded(55);
  y += 4;
  pdf.setDrawColor(30, 64, 42);
  pdf.setLineWidth(0.4);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 64, 42);
  pdf.text("DECLARATION", marginL, y);
  y += 4;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(30, 30, 30);
  pdf.text("I have read, understood and will follow the guidelines in this Toolbox Talk.", marginL, y);
  y += 6;

  const colWidth = contentWidth / 2 - 2;
  const rowH = 8;
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      const x = marginL + col * (colWidth + 4);
      const rowY = y + row * rowH;
      const num = row * 2 + col + 1;
      pdf.text(`${num}.`, x, rowY + 3);
      pdf.setDrawColor(180, 180, 180);
      pdf.line(x + 5, rowY + 4, x + colWidth * 0.5, rowY + 4);
      pdf.line(x + colWidth * 0.52, rowY + 4, x + colWidth * 0.82, rowY + 4);
      pdf.line(x + colWidth * 0.84, rowY + 4, x + colWidth, rowY + 4);
      pdf.setFontSize(6);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Name", x + 5, rowY + 6.5);
      pdf.text("Sign", x + colWidth * 0.52, rowY + 6.5);
      pdf.text("Date", x + colWidth * 0.84, rowY + 6.5);
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
    }
  }
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
    if (targetLang === "EN") return { title, blocks };

    try {
      const textsToTranslate = [title, ...blocks.map((b) => b.text)];
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("translate-toolbox-talk", {
        body: { texts: textsToTranslate, target_lang: targetLang },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      return {
        title: data.translations[0] || title,
        blocks: blocks.map((block, index) => ({
          ...block,
          text: data.translations[index + 1] || block.text,
        })),
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
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      let isFirstPage = true;
      const blocks = parseHtmlToBlocks(toolboxTalk.content);

      for (const langCode of selectedLanguages) {
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;

        const langLabel = LANGUAGES.find(l => l.code === langCode)?.label || "English";
        const { title, blocks: translatedBlocks } = await translateContent(toolboxTalk.title, blocks, langCode);

        renderCompactPage(pdf, title, translatedBlocks, langLabel, toolboxTalk.created_date, toolboxTalk.user_types);
      }

      // Add page numbers
      const totalPages = pdf.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Clews Recycling  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      }

      pdf.save(`${toolboxTalk.title.replace(/[^a-z0-9]/gi, "_")}_Toolbox_Talk.pdf`);
      toast({ title: "Success", description: "PDF generated successfully" });
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
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
              Choose which languages to include. Non-English will be auto-translated.
            </p>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <div key={lang.code} className="flex items-center gap-2">
                  <Checkbox
                    id={lang.code}
                    checked={selectedLanguages.includes(lang.code)}
                    onCheckedChange={() => handleLanguageToggle(lang.code)}
                  />
                  <Label htmlFor={lang.code} className="cursor-pointer">{lang.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={generatePDF} disabled={selectedLanguages.length === 0 || isGenerating} className="w-full gap-2">
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
            ) : (
              <><Printer className="h-4 w-4" />Generate PDF</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
