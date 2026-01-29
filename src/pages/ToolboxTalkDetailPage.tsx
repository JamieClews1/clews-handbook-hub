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
  content: string;
  user_types: string[];
  is_mandatory: boolean;
  created_date: string;
}

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
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) return;

      try {
        // Check admin role
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        setIsAdmin(!!adminRole);

        // Fetch toolbox talk
        const { data: talkData, error } = await supabase
          .from("toolbox_talks")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          toast({ title: "Error", description: "Failed to load Toolbox Talk", variant: "destructive" });
          navigate("/toolbox-talks");
          return;
        }

        setTalk(talkData as ToolboxTalk);
        setDisplayTitle(talkData.title);
        setDisplayContent(talkData.content);

        // Check if signed
        const { data: signatures } = await supabase
          .from("toolbox_talk_signatures")
          .select("id")
          .eq("user_id", user.id)
          .eq("toolbox_talk_id", id)
          .maybeSingle();

        setIsSigned(!!signatures);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user, id]);

  // Handle language change and translation
  const handleLanguageChange = async (langCode: string) => {
    if (!talk) return;
    
    setSelectedLanguage(langCode);
    
    if (langCode === "EN") {
      setDisplayTitle(talk.title);
      setDisplayContent(talk.content);
      return;
    }

    setIsPrinting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("translate-toolbox-talk", {
        body: {
          texts: [talk.title, talk.content],
          target_lang: langCode,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      setDisplayTitle(data.translations[0] || talk.title);
      setDisplayContent(data.translations[1] || talk.content);
    } catch (error) {
      console.error("Translation error:", error);
      toast({
        title: "Translation Error",
        description: "Failed to translate content. Showing original.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Generate PDF
  const handlePrint = async () => {
    if (!talk) return;

    setIsPrinting(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      // Header
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      const langLabel = LANGUAGES.find(l => l.code === selectedLanguage)?.label || "English";
      pdf.text(`Toolbox Talk - ${langLabel}`, margin, 15);
      pdf.text(`Date: ${new Date(talk.created_date).toLocaleDateString()}`, pageWidth - margin - 40, 15);

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(0);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(displayTitle, contentWidth);
      pdf.text(titleLines, margin, 30);

      let yPosition = 30 + titleLines.length * 8 + 10;

      // Parse and render content
      const blocks = parseHtmlToBlocks(displayContent);
      
      for (const block of blocks) {
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

      // Signature section
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
      const declaration = "I have listened to, understood and confirm I will follow the rules and guidelines as set out in this Toolbox Talk.";
      const declarationLines = pdf.splitTextToSize(declaration, contentWidth);
      pdf.text(declarationLines, margin, signatureY + 8);

      const sigStartY = signatureY + 25;
      for (let i = 0; i < 5; i++) {
        const rowY = sigStartY + i * 12;
        pdf.text("Name: _____________________", margin, rowY);
        pdf.text("Signed: _____________________", margin + 70, rowY);
        pdf.text("Date: ___________", margin + 140, rowY);
      }

      pdf.save(`${talk.title.replace(/[^a-z0-9]/gi, "_")}_${selectedLanguage}.pdf`);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Parse HTML content into blocks for PDF
  const parseHtmlToBlocks = (html: string): Array<{ type: string; text: string; level?: number }> => {
    const blocks: Array<{ type: string; text: string; level?: number }> = [];
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

  const handleSign = async (signatureData: string) => {
    if (!talk || !user) return;

    setIsSigning(true);

    const { error } = await supabase
      .from("toolbox_talk_signatures")
      .insert({
        toolbox_talk_id: talk.id,
        user_id: user.id,
        signature_image: signatureData,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed Successfully",
        description: `You have signed "${talk.title}".`,
      });
      setIsSigned(true);
    }

    setIsSigning(false);
    setShowSignDialog(false);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !talk) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">{talk.reference_code}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isPrinting}>
              <SelectTrigger className="w-[140px]">
                <Languages className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/toolbox-talks">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Document Header Section */}
      <div className="bg-gradient-to-br from-primary to-accent py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="secondary" className="text-sm">{talk.reference_code}</Badge>
            {talk.is_mandatory && (
              <Badge variant="destructive">Mandatory</Badge>
            )}
            {isSigned && (
              <Badge variant="outline" className="bg-green-500/20 text-green-100 border-green-400/50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
            {isPrinting && selectedLanguage !== "EN" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Translating...
              </span>
            ) : (
              displayTitle
            )}
          </h2>
          <p className="text-primary-foreground/80">
            {new Date(talk.created_date).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handlePrint}
              disabled={isPrinting}
              className="gap-2"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print PDF
            </Button>
            {!isSigned && (
              <Button onClick={() => setShowSignDialog(true)} className="gap-2">
                Sign Off This Toolbox Talk
              </Button>
            )}
            {isAdmin && (
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => navigate(`/mass-sign-off?type=toolbox&id=${talk.id}`)}
              >
                <ClipboardSignature className="h-4 w-4" />
                Mass Sign Off
              </Button>
            )}
          </div>

          {/* Signed Status */}
          {isSigned && (
            <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">
                You have signed this Toolbox Talk
              </span>
            </div>
          )}

          {/* Content */}
          {isPrinting && selectedLanguage !== "EN" ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Translating...</span>
            </div>
          ) : (
            <div 
              className="prose prose-lg max-w-none bg-card p-6 rounded-lg border"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
            />
          )}
        </div>
      </main>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Toolbox Talk</DialogTitle>
            <DialogDescription>
              By signing, you confirm that you have read and understood:
              <br />
              <strong>{talk.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <SignaturePad
            onSave={handleSign}
            onCancel={() => setShowSignDialog(false)}
          />

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
