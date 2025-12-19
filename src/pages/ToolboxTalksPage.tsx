import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageSquare, CheckCircle, AlertTriangle, ClipboardSignature, Printer, Loader2 } from "lucide-react";
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

const ToolboxTalksPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [toolboxTalks, setToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [signedTalkIds, setSignedTalkIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [selectedTalk, setSelectedTalk] = useState<ToolboxTalk | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
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
      if (!user) return;

      try {
        // Check admin role
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        setIsAdmin(!!adminRole);

        // Fetch user profile to get user_types
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_types")
          .eq("id", user.id)
          .single();

        const types = profile?.user_types || [];
        setUserTypes(types);

        // Fetch published toolbox talks
        const { data: talks } = await supabase
          .from("toolbox_talks")
          .select("*")
          .eq("is_published", true)
          .order("created_date", { ascending: false });

        // Filter by user types
        const applicableTalks = (talks || []).filter(talk =>
          types.some((ut: string) => talk.user_types.includes(ut))
        );

        setToolboxTalks(applicableTalks);

        // Fetch user's signatures
        const { data: signatures } = await supabase
          .from("toolbox_talk_signatures")
          .select("toolbox_talk_id")
          .eq("user_id", user.id);

        setSignedTalkIds(new Set(signatures?.map(s => s.toolbox_talk_id) || []));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  // Auto-open specific talk from URL query param
  useEffect(() => {
    if (!loadingData && toolboxTalks.length > 0 && !hasAutoOpened) {
      const talkId = searchParams.get('id');
      if (talkId) {
        const talk = toolboxTalks.find(t => t.id === talkId);
        if (talk) {
          setSelectedTalk(talk);
          setShowViewDialog(true);
          setHasAutoOpened(true);
        }
      }
    }
  }, [loadingData, toolboxTalks, searchParams, hasAutoOpened]);

  // Reset display content when talk changes or dialog opens
  useEffect(() => {
    if (selectedTalk && showViewDialog) {
      setDisplayTitle(selectedTalk.title);
      setDisplayContent(selectedTalk.content);
      setSelectedLanguage("EN");
    }
  }, [selectedTalk, showViewDialog]);

  // Handle language change and translation
  const handleLanguageChange = async (langCode: string) => {
    if (!selectedTalk) return;
    
    setSelectedLanguage(langCode);
    
    if (langCode === "EN") {
      setDisplayTitle(selectedTalk.title);
      setDisplayContent(selectedTalk.content);
      return;
    }

    setIsPrinting(true); // Reuse loading state for translation
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("translate-toolbox-talk", {
        body: {
          texts: [selectedTalk.title, selectedTalk.content],
          target_lang: langCode,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;

      setDisplayTitle(data.translations[0] || selectedTalk.title);
      setDisplayContent(data.translations[1] || selectedTalk.content);
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

  // Generate PDF for single language
  const handlePrint = async () => {
    if (!selectedTalk) return;

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
      pdf.text(`Date: ${new Date(selectedTalk.created_date).toLocaleDateString()}`, pageWidth - margin - 40, 15);

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

      pdf.save(`${selectedTalk.title.replace(/[^a-z0-9]/gi, "_")}_${selectedLanguage}.pdf`);

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
    if (!selectedTalk || !user) return;

    setIsSigning(true);

    const { error } = await supabase
      .from("toolbox_talk_signatures")
      .insert({
        toolbox_talk_id: selectedTalk.id,
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
        description: `You have signed "${selectedTalk.title}".`,
      });
      setSignedTalkIds(prev => new Set([...prev, selectedTalk.id]));
    }

    setIsSigning(false);
    setShowSignDialog(false);
    setSelectedTalk(null);
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

  if (!user) {
    return null;
  }

  const pendingMandatory = toolboxTalks.filter(
    t => t.is_mandatory && !signedTalkIds.has(t.id)
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
          <Link to="/portal">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary to-accent py-12">
        <div className="container mx-auto px-4 text-center">
          <MessageSquare className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Toolbox Talks
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Short safety briefings to reinforce workplace safety awareness and best practices.
          </p>
          {pendingMandatory > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-destructive/20 text-destructive-foreground px-4 py-2 rounded-full">
              <AlertTriangle className="h-5 w-5" />
              <span>{pendingMandatory} mandatory talk{pendingMandatory > 1 ? "s" : ""} pending signature</span>
            </div>
          )}
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {toolboxTalks.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No Toolbox Talks are currently assigned to your user type.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {toolboxTalks.map(talk => {
              const isSigned = signedTalkIds.has(talk.id);
              return (
                <Card 
                  key={talk.id} 
                  className={`flex flex-col h-full cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70 ${isSigned ? "border-green-500/30" : ""}`}
                  onClick={() => {
                    setSelectedTalk(talk);
                    setShowViewDialog(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                        {talk.reference_code}
                      </span>
                      <div className="flex gap-1">
                        {talk.is_mandatory && (
                          <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                        )}
                        {isSigned && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Signed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2 line-clamp-2">{talk.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(talk.created_date).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground line-clamp-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(talk.content) }}
                    />
                  </CardContent>
                  <div className="px-6 pb-4 mt-auto">
                    {!isSigned && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTalk(talk);
                          setShowViewDialog(true);
                        }}
                      >
                        View & Sign
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* View Dialog - Shows full content */}
      <Dialog open={showViewDialog} onOpenChange={(open) => {
        setShowViewDialog(open);
        if (!open) setSelectedTalk(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{selectedTalk?.reference_code}</Badge>
                {selectedTalk?.is_mandatory && (
                  <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                )}
                {selectedTalk && signedTalkIds.has(selectedTalk.id) && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Signed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isPrinting}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="gap-2"
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print
                </Button>
              </div>
            </div>
            <DialogTitle className="text-xl">{displayTitle || selectedTalk?.title}</DialogTitle>
            <DialogDescription>
              {selectedTalk && new Date(selectedTalk.created_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {isPrinting && selectedLanguage !== "EN" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Translating...</span>
            </div>
          )}

          {(!isPrinting || selectedLanguage === "EN") && (
            <div 
              className="prose prose-sm max-w-none mt-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent || selectedTalk?.content) }}
            />
          )}

          {selectedTalk && !signedTalkIds.has(selectedTalk.id) && (
            <div className="mt-6 pt-4 border-t flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => {
                  setShowViewDialog(false);
                  setShowSignDialog(true);
                }}
              >
                Sign Off This Toolbox Talk
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => navigate(`/mass-sign-off?type=toolbox&id=${selectedTalk.id}`)}
                >
                  <ClipboardSignature className="h-4 w-4" />
                  Mass Sign Off
                </Button>
              )}
            </div>
          )}
          {selectedTalk && signedTalkIds.has(selectedTalk.id) && isAdmin && (
            <div className="mt-6 pt-4 border-t">
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => navigate(`/mass-sign-off?type=toolbox&id=${selectedTalk.id}`)}
              >
                <ClipboardSignature className="h-4 w-4" />
                Mass Sign Off
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Toolbox Talk</DialogTitle>
            <DialogDescription>
              By signing, you confirm that you have read and understood:
              <br />
              <strong>{selectedTalk?.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <SignaturePad
            onSave={handleSign}
            onCancel={() => {
              setShowSignDialog(false);
              setSelectedTalk(null);
            }}
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

export default ToolboxTalksPage;
