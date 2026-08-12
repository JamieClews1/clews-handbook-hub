import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, ClipboardSignature, Printer, Loader2, Languages } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import { sanitizeHtml } from "@/lib/sanitize-html";
import jsPDF from "jspdf";
import { useUnicodeFont } from "@/lib/pdf-fonts";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polish" },
  { code: "UK", label: "Ukrainian" },
  { code: "RO", label: "Romanian" },
];

interface ToolboxTalk {
  id: string;
  reference_code: string;
  title: string;
  title_pl?: string | null;
  title_uk?: string | null;
  title_ro?: string | null;
  content: string;
  content_pl?: string | null;
  content_uk?: string | null;
  content_ro?: string | null;
  user_types: string[];
  is_mandatory: boolean;
  created_date: string;
}

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
    const plainText = tempDiv.textContent || "";
    plainText.split(/\n+/).forEach((line) => {
      const text = line.trim();
      if (text) blocks.push({ type: "paragraph", text });
    });
  }

  return blocks;
};

const generateCompactPDF = async (
  title: string,
  content: string,
  refCode: string,
  createdDate: string,
  userTypes: string[],
  langLabel: string
) => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const font = await useUnicodeFont(pdf);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  const blocks = parseHtmlToBlocks(content);

  // --- Header bar ---
  pdf.setFillColor(30, 64, 42); // dark green
  pdf.rect(0, 0, pageWidth, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont(font, "bold");
  pdf.text("CLEWS RECYCLING — TOOLBOX TALK", marginL, 7);
  pdf.setFont(font, "normal");
  pdf.setFontSize(8);
  pdf.text(`${refCode}  |  ${langLabel}  |  ${new Date(createdDate).toLocaleDateString("en-GB")}`, marginL, 13);
  const audienceStr = userTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
  if (audienceStr) {
    pdf.text(`Audience: ${audienceStr}`, pageWidth - marginR, 13, { align: "right" });
  }

  // --- Title ---
  let y = 25;
  pdf.setTextColor(30, 64, 42);
  pdf.setFontSize(16);
  pdf.setFont(font, "bold");
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleLines, marginL, y);
  y += titleLines.length * 7 + 3;

  // Thin rule under title
  pdf.setDrawColor(30, 64, 42);
  pdf.setLineWidth(0.4);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;

  // --- Content ---
  const addPageIfNeeded = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 20) {
      pdf.addPage();
      y = 15;
      return true;
    }
    return false;
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      addPageIfNeeded(12);
      if (y > 30) y += 2; // small gap before headings (not at top)
      pdf.setFontSize(block.level === 1 ? 13 : block.level === 2 ? 11 : 10);
      pdf.setFont(font, "bold");
      pdf.setTextColor(30, 64, 42);
      const lines = pdf.splitTextToSize(block.text, contentWidth);
      pdf.text(lines, marginL, y);
      y += lines.length * 5 + 2;
    } else if (block.type === "paragraph") {
      addPageIfNeeded(8);
      pdf.setFontSize(9);
      pdf.setFont(font, "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(block.text, contentWidth);
      pdf.text(lines, marginL, y);
      y += lines.length * 4 + 2;
    } else if (block.type === "list-item") {
      addPageIfNeeded(6);
      pdf.setFontSize(9);
      pdf.setFont(font, "normal");
      pdf.setTextColor(30, 30, 30);
      const bulletText = `•  ${block.text}`;
      const lines = pdf.splitTextToSize(bulletText, contentWidth - 6);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 4 + 1;
    } else if (block.type === "numbered-item") {
      addPageIfNeeded(6);
      pdf.setFontSize(9);
      pdf.setFont(font, "normal");
      pdf.setTextColor(30, 30, 30);
      const numberedText = `${block.level}.  ${block.text}`;
      const lines = pdf.splitTextToSize(numberedText, contentWidth - 6);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 4 + 1;
    }
  }

  // --- Signature section ---
  const sigHeight = 60;
  addPageIfNeeded(sigHeight);

  y += 4;
  pdf.setDrawColor(30, 64, 42);
  pdf.setLineWidth(0.4);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;

  pdf.setFontSize(9);
  pdf.setFont(font, "bold");
  pdf.setTextColor(30, 64, 42);
  pdf.text("DECLARATION", marginL, y);
  y += 4;
  pdf.setFontSize(8);
  pdf.setFont(font, "normal");
  pdf.setTextColor(30, 30, 30);
  const decl = "I have read, understood and will follow the guidelines in this Toolbox Talk.";
  pdf.text(decl, marginL, y);
  y += 6;

  // Compact signature grid — 2 columns, 5 rows
  const colWidth = contentWidth / 2 - 2;
  const rowH = 8;
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      const x = marginL + col * (colWidth + 4);
      const rowY = y + row * rowH;
      const num = row * 2 + col + 1;
      pdf.setFont(font, "normal");
      pdf.text(`${num}.`, x, rowY + 3);
      pdf.setDrawColor(180, 180, 180);
      pdf.line(x + 5, rowY + 4, x + colWidth * 0.5, rowY + 4); // name line
      pdf.line(x + colWidth * 0.52, rowY + 4, x + colWidth * 0.82, rowY + 4); // sign line
      pdf.line(x + colWidth * 0.84, rowY + 4, x + colWidth, rowY + 4); // date line
      pdf.setFontSize(6);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Name", x + 5, rowY + 6.5);
      pdf.text("Sign", x + colWidth * 0.52, rowY + 6.5);
      pdf.text("Date", x + colWidth * 0.84, rowY + 6.5);
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
    }
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Clews Recycling  |  ${refCode}  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  return pdf;
};

const ToolboxTalkDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [talk, setTalk] = useState<ToolboxTalk | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isSigned, setIsSigned] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("EN");
  const [isPrinting, setIsPrinting] = useState(false);
  const [displayContent, setDisplayContent] = useState<string>("");
  const [displayTitle, setDisplayTitle] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) return;
      try {
        const { data: adminRole } = await supabase
          .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        setIsAdmin(!!adminRole);

        const { data: talkData, error } = await supabase
          .from("toolbox_talks").select("*").eq("id", id).single();

        if (error) {
          toast({ title: "Error", description: "Failed to load Toolbox Talk", variant: "destructive" });
          navigate("/toolbox-talks");
          return;
        }

        setTalk(talkData as ToolboxTalk);
        setDisplayTitle(talkData.title);
        setDisplayContent(talkData.content);

        const { data: signatures } = await supabase
          .from("toolbox_talk_signatures").select("id").eq("user_id", user.id).eq("toolbox_talk_id", id).maybeSingle();
        setIsSigned(!!signatures);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user, id]);

  const handleLanguageChange = (langCode: string) => {
    if (!talk) return;
    setSelectedLanguage(langCode);
    if (langCode === "EN") {
      setDisplayTitle(talk.title);
      setDisplayContent(talk.content);
      return;
    }
    const langSuffix = langCode.toLowerCase() as 'pl' | 'uk' | 'ro';
    const translatedTitle = talk[`title_${langSuffix}` as keyof ToolboxTalk] as string | null;
    const translatedContent = talk[`content_${langSuffix}` as keyof ToolboxTalk] as string | null;
    if (translatedTitle && translatedContent) {
      setDisplayTitle(translatedTitle);
      setDisplayContent(translatedContent);
    } else {
      toast({ title: "Translation Not Available", description: "Showing English version.", variant: "destructive" });
      setDisplayTitle(talk.title);
      setDisplayContent(talk.content);
    }
  };

  const handlePrint = async () => {
    if (!talk) return;
    setIsPrinting(true);
    try {
      const langLabel = LANGUAGES.find(l => l.code === selectedLanguage)?.label || "English";
      const pdf = await generateCompactPDF(displayTitle, displayContent, talk.reference_code, talk.created_date, talk.user_types, langLabel);
      pdf.save(`${talk.title.replace(/[^a-z0-9]/gi, "_")}_${selectedLanguage}.pdf`);
      toast({ title: "Success", description: "PDF generated successfully" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSign = async (signatureData: string) => {
    if (!talk || !user) return;
    setIsSigning(true);
    const { error } = await supabase.from("toolbox_talk_signatures").insert({
      toolbox_talk_id: talk.id, user_id: user.id, signature_image: signatureData,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to save signature.", variant: "destructive" });
    } else {
      toast({ title: "Signed Successfully", description: `You have signed "${talk.title}".` });
      setIsSigned(true);
    }
    setIsSigning(false);
    setShowSignDialog(false);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      </div>
    );
  }

  if (!user || !talk) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
            <div className="h-6 w-px bg-border" />
            <div>
              <span className="text-xs font-medium text-muted-foreground">{talk.reference_code}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(talk.created_date).toLocaleDateString("en-GB")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <Languages className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/toolbox-talks">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Title + Meta Bar */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-foreground leading-tight mb-1.5">
                {displayTitle}
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap">
                {talk.user_types.map((type) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize font-normal">
                    {type}
                  </Badge>
                ))}
                {talk.is_mandatory && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Mandatory</Badge>
                )}
                {isSigned && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300 bg-green-50">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                    Signed
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} className="h-8 gap-1 text-xs">
                {isPrinting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                PDF
              </Button>
              {!isSigned && (
                <Button size="sm" onClick={() => setShowSignDialog(true)} className="h-8 text-xs">
                  Sign Off
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"
                  onClick={() => navigate(`/mass-sign-off?type=toolbox&id=${talk.id}`)}>
                  <ClipboardSignature className="h-3 w-3" />
                  Mass Sign
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content — compact prose */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {isSigned && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-primary/5 rounded-md border border-primary/20 text-sm">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-primary font-medium">You have signed this Toolbox Talk</span>
            </div>
          )}
          <div
            className="prose prose-sm max-w-none
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
              prose-h3:text-base prose-h2:text-lg prose-h1:text-xl
              prose-p:text-sm prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-muted-foreground
              prose-li:text-sm prose-li:text-muted-foreground prose-li:my-0.5
              prose-ul:my-2 prose-ol:my-2
              prose-strong:text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
          />
        </div>
      </main>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Toolbox Talk</DialogTitle>
            <DialogDescription>
              By signing, you confirm you have read and understood: <strong>{talk.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <SignaturePad onSave={handleSign} onCancel={() => setShowSignDialog(false)} />
          {isSigning && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ToolboxTalkDetailPage;
