import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download } from "lucide-react";
import jsPDF from "jspdf";

interface HandbookSection {
  id: string;
  title_en: string;
  title_pl?: string | null;
  title_uk?: string | null;
  title_ro?: string | null;
  section_key: string;
  subsections: {
    id: string;
    title_en: string;
    title_pl?: string | null;
    title_uk?: string | null;
    title_ro?: string | null;
    content_en: string;
    content_pl?: string | null;
    content_uk?: string | null;
    content_ro?: string | null;
    subsection_key: string;
  }[];
}

interface HandbookPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ro", label: "Romanian" },
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

export const HandbookPrintDialog = ({
  open,
  onOpenChange,
}: HandbookPrintDialogProps) => {
  const { toast } = useToast();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<HandbookSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch sections with all language variants when dialog opens
  useEffect(() => {
    if (open) {
      fetchSectionsWithTranslations();
    }
  }, [open]);

  const fetchSectionsWithTranslations = async () => {
    setIsLoading(true);
    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("handbook_sections")
        .select("*")
        .order("display_order");

      if (sectionsError) throw sectionsError;

      const { data: subsectionsData, error: subsectionsError } = await supabase
        .from("handbook_subsections")
        .select("*")
        .order("display_order");

      if (subsectionsError) throw subsectionsError;

      const formattedSections: HandbookSection[] = (sectionsData || []).map((section) => ({
        id: section.id,
        title_en: section.title_en,
        title_pl: section.title_pl,
        title_uk: section.title_uk,
        title_ro: section.title_ro,
        section_key: section.section_key,
        subsections: (subsectionsData || [])
          .filter((sub) => sub.section_id === section.id)
          .map((sub) => ({
            id: sub.id,
            title_en: sub.title_en,
            title_pl: sub.title_pl,
            title_uk: sub.title_uk,
            title_ro: sub.title_ro,
            content_en: sub.content_en,
            content_pl: sub.content_pl,
            content_uk: sub.content_uk,
            content_ro: sub.content_ro,
            subsection_key: sub.subsection_key,
          })),
      }));

      setSections(formattedSections);
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast({
        title: "Error",
        description: "Failed to load handbook content",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageToggle = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const getTitle = (
    item: { title_en: string; title_pl?: string | null; title_uk?: string | null; title_ro?: string | null },
    langCode: string
  ): string => {
    switch (langCode) {
      case "pl":
        return item.title_pl || item.title_en;
      case "uk":
        return item.title_uk || item.title_en;
      case "ro":
        return item.title_ro || item.title_en;
      default:
        return item.title_en;
    }
  };

  const getContent = (
    item: { content_en: string; content_pl?: string | null; content_uk?: string | null; content_ro?: string | null },
    langCode: string
  ): string => {
    switch (langCode) {
      case "pl":
        return item.content_pl || item.content_en;
      case "uk":
        return item.content_uk || item.content_en;
      case "ro":
        return item.content_ro || item.content_en;
      default:
        return item.content_en;
    }
  };

  const generatePDF = async () => {
    if (sections.length === 0 || selectedLanguages.length === 0) return;

    setIsGenerating(true);

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      for (let langIndex = 0; langIndex < selectedLanguages.length; langIndex++) {
        const langCode = selectedLanguages[langIndex];
        const langLabel = LANGUAGES.find((l) => l.code === langCode)?.label || langCode;

        if (langIndex > 0) {
          pdf.addPage();
        }

        // Title page for this language
        pdf.setFontSize(28);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text("Employee Handbook", pageWidth / 2, 80, { align: "center" });

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100);
        pdf.text(`Clews Recycling`, pageWidth / 2, 100, { align: "center" });

        pdf.setFontSize(14);
        pdf.text(langLabel, pageWidth / 2, 120, { align: "center" });

        pdf.setFontSize(12);
        pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 140, { align: "center" });

        // Process each section
        for (const section of sections) {
          pdf.addPage();
          let yPosition = 25;

          // Section header - use pre-translated content from DB
          pdf.setFontSize(18);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0);
          
          const sectionTitle = getTitle(section, langCode);

          const sectionTitleLines = pdf.splitTextToSize(sectionTitle, contentWidth);
          pdf.text(sectionTitleLines, margin, yPosition);
          yPosition += sectionTitleLines.length * 8 + 10;

          // Draw a line under section title
          pdf.setDrawColor(200);
          pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
          yPosition += 5;

          // Process subsections
          for (const subsection of section.subsections) {
            // Check if we need a new page
            if (yPosition > pageHeight - 50) {
              pdf.addPage();
              yPosition = 25;
            }

            // Subsection title - use pre-translated content from DB
            const subsectionTitle = getTitle(subsection, langCode);
            const content = getContent(subsection, langCode);

            pdf.setFontSize(14);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(40);
            const subTitleLines = pdf.splitTextToSize(subsectionTitle, contentWidth);
            pdf.text(subTitleLines, margin, yPosition);
            yPosition += subTitleLines.length * 6 + 5;

            // Parse and render content
            const blocks = parseHtmlToBlocks(content);

            for (const block of blocks) {
              // Check if we need a new page
              if (yPosition > pageHeight - 30) {
                pdf.addPage();
                yPosition = 25;
              }

              if (block.type === "heading") {
                pdf.setFontSize(block.level === 1 ? 14 : block.level === 2 ? 12 : 11);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(40);
                const headingLines = pdf.splitTextToSize(block.text, contentWidth);
                pdf.text(headingLines, margin, yPosition);
                yPosition += headingLines.length * 5 + 4;
              } else if (block.type === "paragraph") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const paraLines = pdf.splitTextToSize(block.text, contentWidth);
                pdf.text(paraLines, margin, yPosition);
                yPosition += paraLines.length * 4.5 + 3;
              } else if (block.type === "list-item") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const bulletText = `•  ${block.text}`;
                const listLines = pdf.splitTextToSize(bulletText, contentWidth - 10);
                pdf.text(listLines, margin + 5, yPosition);
                yPosition += listLines.length * 4.5 + 2;
              } else if (block.type === "numbered-item") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const numberedText = `${block.level}.  ${block.text}`;
                const listLines = pdf.splitTextToSize(numberedText, contentWidth - 10);
                pdf.text(listLines, margin + 5, yPosition);
                yPosition += listLines.length * 4.5 + 2;
              }
            }

            yPosition += 8; // Space between subsections
          }
        }
      }

      pdf.save(`Clews_Employee_Handbook.pdf`);

      toast({
        title: "Success",
        description: "Handbook PDF generated successfully",
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
          <DialogTitle>Download Handbook PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Select Languages</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Choose which languages to include in the PDF.
            </p>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <div key={lang.code} className="flex items-center gap-2">
                  <Checkbox
                    id={`handbook-${lang.code}`}
                    checked={selectedLanguages.includes(lang.code)}
                    onCheckedChange={() => handleLanguageToggle(lang.code)}
                  />
                  <Label htmlFor={`handbook-${lang.code}`} className="cursor-pointer">
                    {lang.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={generatePDF}
            disabled={selectedLanguages.length === 0 || isGenerating || isLoading}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
