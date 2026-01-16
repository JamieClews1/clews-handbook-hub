import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download } from "lucide-react";
import jsPDF from "jspdf";
import clewsLogo from "@/assets/clews-logo.png";

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

  // Function to transliterate special characters for PDF compatibility
  const transliterateForPDF = (text: string): string => {
    const charMap: Record<string, string> = {
      // Polish
      '\u0105': 'a', '\u0107': 'c', '\u0119': 'e', '\u0142': 'l', '\u0144': 'n', '\u00f3': 'o', '\u015b': 's', '\u017a': 'z', '\u017c': 'z',
      '\u0104': 'A', '\u0106': 'C', '\u0118': 'E', '\u0141': 'L', '\u0143': 'N', '\u00d3': 'O', '\u015a': 'S', '\u0179': 'Z', '\u017b': 'Z',
      // Ukrainian Cyrillic
      '\u0430': 'a', '\u0431': 'b', '\u0432': 'v', '\u0433': 'h', '\u0491': 'g', '\u0434': 'd', '\u0435': 'e', '\u0454': 'ye', '\u0436': 'zh',
      '\u0437': 'z', '\u0438': 'y', '\u0456': 'i', '\u0457': 'yi', '\u0439': 'y', '\u043a': 'k', '\u043b': 'l', '\u043c': 'm', '\u043d': 'n',
      '\u043e': 'o', '\u043f': 'p', '\u0440': 'r', '\u0441': 's', '\u0442': 't', '\u0443': 'u', '\u0444': 'f', '\u0445': 'kh', '\u0446': 'ts',
      '\u0447': 'ch', '\u0448': 'sh', '\u0449': 'shch', '\u044c': '', '\u044e': 'yu', '\u044f': 'ya', '\u044b': 'y', '\u044d': 'e', '\u0451': 'yo',
      '\u0410': 'A', '\u0411': 'B', '\u0412': 'V', '\u0413': 'H', '\u0490': 'G', '\u0414': 'D', '\u0415': 'E', '\u0404': 'Ye', '\u0416': 'Zh',
      '\u0417': 'Z', '\u0418': 'Y', '\u0406': 'I', '\u0407': 'Yi', '\u0419': 'Y', '\u041a': 'K', '\u041b': 'L', '\u041c': 'M', '\u041d': 'N',
      '\u041e': 'O', '\u041f': 'P', '\u0420': 'R', '\u0421': 'S', '\u0422': 'T', '\u0423': 'U', '\u0424': 'F', '\u0425': 'Kh', '\u0426': 'Ts',
      '\u0427': 'Ch', '\u0428': 'Sh', '\u0429': 'Shch', '\u042c': '', '\u042e': 'Yu', '\u042f': 'Ya', '\u042b': 'Y', '\u042d': 'E', '\u0401': 'Yo',
      // Romanian
      '\u0103': 'a', '\u00e2': 'a', '\u00ee': 'i', '\u0219': 's', '\u021b': 't',
      '\u0102': 'A', '\u00c2': 'A', '\u00ce': 'I', '\u0218': 'S', '\u021a': 'T',
      // Common typographic characters
      '\u201c': '"', '\u201d': '"', '\u2018': "'", '\u2019': "'", '\u2013': '-', '\u2014': '-', '\u2026': '...',
    };
    
    return text.split('').map(char => charMap[char] || char).join('');
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
      const lineHeight = 5;
      const paragraphSpacing = 3;

      // Load logo image
      const logoImg = new Image();
      logoImg.src = clewsLogo;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continue even if logo fails
      });

      for (let langIndex = 0; langIndex < selectedLanguages.length; langIndex++) {
        const langCode = selectedLanguages[langIndex];
        const langLabel = LANGUAGES.find((l) => l.code === langCode)?.label || langCode;

        if (langIndex > 0) {
          pdf.addPage();
        }

        // Add logo to cover page
        try {
          const logoWidth = 60;
          const logoHeight = 30;
          const logoX = (pageWidth - logoWidth) / 2;
          pdf.addImage(logoImg, 'PNG', logoX, 30, logoWidth, logoHeight);
        } catch (e) {
          console.warn("Could not add logo to PDF:", e);
        }

        // Title page for this language
        pdf.setFontSize(28);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text("Employee Handbook", pageWidth / 2, 90, { align: "center" });

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100);
        pdf.text("Clews Recycling", pageWidth / 2, 110, { align: "center" });

        pdf.setFontSize(14);
        pdf.text(langLabel, pageWidth / 2, 130, { align: "center" });

        pdf.setFontSize(12);
        pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 150, { align: "center" });

        // Process each section
        for (const section of sections) {
          pdf.addPage();
          let yPosition = 25;

          // Section header - use pre-translated content from DB
          pdf.setFontSize(18);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0);
          
          const sectionTitle = transliterateForPDF(getTitle(section, langCode));

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
            const subsectionTitle = transliterateForPDF(getTitle(subsection, langCode));
            const content = transliterateForPDF(getContent(subsection, langCode));

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
                yPosition += headingLines.length * lineHeight + paragraphSpacing + 1;
              } else if (block.type === "paragraph") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const paraLines = pdf.splitTextToSize(block.text, contentWidth);
                pdf.text(paraLines, margin, yPosition);
                yPosition += paraLines.length * lineHeight + paragraphSpacing;
              } else if (block.type === "list-item") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const bulletIndent = 8;
                const bulletContentWidth = contentWidth - bulletIndent;
                const listLines = pdf.splitTextToSize(block.text, bulletContentWidth);
                // Draw bullet point
                pdf.text("•", margin, yPosition);
                // Draw text with proper indent
                pdf.text(listLines, margin + bulletIndent, yPosition);
                yPosition += listLines.length * lineHeight + 2;
              } else if (block.type === "numbered-item") {
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(60);
                const numIndent = 10;
                const numContentWidth = contentWidth - numIndent;
                const listLines = pdf.splitTextToSize(block.text, numContentWidth);
                // Draw number
                pdf.text(`${block.level}.`, margin, yPosition);
                // Draw text with proper indent
                pdf.text(listLines, margin + numIndent, yPosition);
                yPosition += listLines.length * lineHeight + 2;
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
