import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, FileText, AlertTriangle, ClipboardList, Download, Languages, Loader2, CheckCircle, PenTool, User, ClipboardSignature } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import jsPDF from "jspdf";
import { SignaturePad } from "@/components/SignaturePad";

interface RAMS {
  id: string;
  reference_code: string;
  title: string;
  applicable_to: string[];
  notice_to_drivers: string | null;
  created_date: string;
  review_date: string;
  creator_signature: string | null;
  creator_name: string | null;
  signed_at: string | null;
  is_mandatory: boolean;
  user_types: string[];
}

interface Hazard {
  id: string;
  rams_id: string;
  activity: string;
  potential_hazard: string;
  who_at_risk: string;
  initial_likelihood: number;
  initial_severity: number;
  control_measures: string;
  residual_likelihood: number;
  residual_severity: number;
  notes: string | null;
  display_order: number;
}

interface RAMSSignature {
  rams_id: string;
  signed_at: string;
}

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'PL', label: 'Polski' },
  { code: 'UK', label: 'Українська' },
  { code: 'RO', label: 'Română' },
];

const RAMSPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [ramsList, setRamsList] = useState<RAMS[]>([]);
  const [selectedRAMS, setSelectedRAMS] = useState<RAMS | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [language, setLanguage] = useState('EN');
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingRAMS, setLoadingRAMS] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [userSignatures, setUserSignatures] = useState<RAMSSignature[]>([]);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManagement, setIsManagement] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<{
    title: string;
    applicableTo: string[];
    noticeToDrivers: string;
    hazards: { activity: string; potentialHazard: string; whoAtRisk: string; controlMeasures: string; notes: string }[];
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRAMSList();
      fetchUserSignatures();
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;
    const { data: adminData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!adminData);

    // Also check if management user
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_types')
      .eq('id', user.id)
      .single();
    setIsManagement(profileData?.user_types?.includes('management') || false);
  };

  useEffect(() => {
    if (selectedRAMS) {
      fetchHazards(selectedRAMS.id);
    }
  }, [selectedRAMS]);

  // Translate content when language changes
  useEffect(() => {
    const translateContent = async () => {
      if (!selectedRAMS || language === 'EN') {
        setTranslatedContent(null);
        return;
      }

      setIsTranslating(true);
      try {
        const textsToTranslate = [
          selectedRAMS.title,
          ...selectedRAMS.applicable_to,
          selectedRAMS.notice_to_drivers || '',
          ...hazards.flatMap(h => [
            h.activity,
            h.potential_hazard,
            h.who_at_risk,
            h.control_measures,
            h.notes || '',
          ]),
        ];

        const translated = await translateTexts(textsToTranslate);
        
        let i = 0;
        setTranslatedContent({
          title: translated[i++],
          applicableTo: selectedRAMS.applicable_to.map(() => translated[i++]),
          noticeToDrivers: translated[i++],
          hazards: hazards.map(() => ({
            activity: translated[i++],
            potentialHazard: translated[i++],
            whoAtRisk: translated[i++],
            controlMeasures: translated[i++],
            notes: translated[i++],
          })),
        });
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    };

    if (selectedRAMS && hazards.length >= 0) {
      translateContent();
    }
  }, [language, selectedRAMS, hazards]);

  const fetchRAMSList = async () => {
    setLoadingRAMS(true);
    const { data, error } = await supabase
      .from("rams")
      .select("*")
      .order("reference_code");

    if (error) {
      toast({ title: "Error", description: "Failed to load RAMS", variant: "destructive" });
    } else {
      setRamsList((data as RAMS[]) || []);
    }
    setLoadingRAMS(false);
  };

  const fetchHazards = async (ramsId: string) => {
    const { data, error } = await supabase
      .from("rams_hazards")
      .select("*")
      .eq("rams_id", ramsId)
      .order("display_order");

    if (!error) {
      setHazards((data as Hazard[]) || []);
    }
  };

  const fetchUserSignatures = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("rams_user_signatures")
      .select("rams_id, signed_at")
      .eq("user_id", user.id);

    if (!error) {
      setUserSignatures(data || []);
    }
  };

  const isRamsSigned = (ramsId: string) => {
    return userSignatures.some(sig => sig.rams_id === ramsId);
  };

  const getSignatureDate = (ramsId: string) => {
    const sig = userSignatures.find(s => s.rams_id === ramsId);
    return sig ? new Date(sig.signed_at) : null;
  };

  const handleSignRAMS = async () => {
    if (!selectedRAMS || !signatureData || !user) return;
    
    setIsSigning(true);
    try {
      const { error } = await supabase
        .from("rams_user_signatures")
        .insert({
          rams_id: selectedRAMS.id,
          user_id: user.id,
          signature_image: signatureData,
        });

      if (error) throw error;

      toast({
        title: "RAMS Signed",
        description: `You have successfully signed ${selectedRAMS.reference_code}`,
      });

      setShowSignDialog(false);
      setSignatureData(null);
      fetchUserSignatures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const translateTexts = async (texts: string[]): Promise<string[]> => {
    if (language === 'EN') return texts;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-rams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts, target_lang: language }),
        }
      );

      const result = await response.json();
      if (result.success) {
        return result.translations;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error('Translation error:', error);
      toast({ title: "Translation failed", description: "Downloading in English", variant: "destructive" });
      return texts;
    }
  };

  const getRiskColor = (risk: number): [number, number, number] => {
    if (risk <= 4) return [34, 197, 94];
    if (risk <= 8) return [234, 179, 8];
    if (risk <= 12) return [249, 115, 22];
    return [239, 68, 68];
  };

  const handleDownloadPDF = async (rams: RAMS) => {
    setIsDownloading(true);
    
    try {
      // Gather all texts to translate
      const textsToTranslate = [
        rams.title,
        'Reference Code',
        'Created Date',
        'Review Date',
        'Mandatory',
        'Applicable To',
        'Notice to Drivers',
        'Risk Assessment',
        'Potential Hazard',
        'Who at Risk',
        'Initial Risk',
        'Residual Risk',
        'Control Measures',
        'Notes',
        'Creator Signature',
        'Signed',
        ...rams.applicable_to,
        rams.notice_to_drivers || '',
        ...hazards.flatMap(h => [
          h.activity,
          h.potential_hazard,
          h.who_at_risk,
          h.control_measures,
          h.notes || '',
        ]),
      ];

      const translated = await translateTexts(textsToTranslate);
      
      // Map translations back
      let i = 0;
      const t = {
        title: translated[i++],
        referenceCode: translated[i++],
        createdDate: translated[i++],
        reviewDate: translated[i++],
        mandatory: translated[i++],
        applicableTo: translated[i++],
        noticeToDrivers: translated[i++],
        riskAssessment: translated[i++],
        potentialHazard: translated[i++],
        whoAtRisk: translated[i++],
        initialRisk: translated[i++],
        residualRisk: translated[i++],
        controlMeasures: translated[i++],
        notes: translated[i++],
        creatorSignature: translated[i++],
        signed: translated[i++],
        applicableToItems: rams.applicable_to.map(() => translated[i++]),
        noticeText: translated[i++],
        hazards: hazards.map(() => ({
          activity: translated[i++],
          potentialHazard: translated[i++],
          whoAtRisk: translated[i++],
          controlMeasures: translated[i++],
          notes: translated[i++],
        })),
      };

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Helper function
      const addText = (text: string, x: number, yPos: number, options?: { fontSize?: number; fontStyle?: string; maxWidth?: number }) => {
        doc.setFontSize(options?.fontSize || 10);
        if (options?.fontStyle === 'bold') {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        if (options?.maxWidth) {
          const lines = doc.splitTextToSize(text, options.maxWidth);
          doc.text(lines, x, yPos);
          return lines.length * (options?.fontSize || 10) * 0.4;
        }
        doc.text(text, x, yPos);
        return (options?.fontSize || 10) * 0.4;
      };

      const checkNewPage = (needed: number) => {
        if (y + needed > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
      };

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      addText(rams.reference_code, margin, 18, { fontSize: 20, fontStyle: 'bold' });
      addText(t.title, margin, 28, { fontSize: 12 });
      
      y = 45;
      doc.setTextColor(0, 0, 0);

      // Meta info
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
      y += 8;
      
      doc.setTextColor(100, 100, 100);
      addText(t.createdDate, margin + 5, y, { fontSize: 8 });
      addText(t.reviewDate, margin + 70, y, { fontSize: 8 });
      y += 5;
      doc.setTextColor(0, 0, 0);
      addText(format(new Date(rams.created_date), "PPP"), margin + 5, y, { fontSize: 10, fontStyle: 'bold' });
      addText(format(new Date(rams.review_date), "PPP"), margin + 70, y, { fontSize: 10, fontStyle: 'bold' });
      
      y += 18;

      // Badges
      if (rams.is_mandatory) {
        doc.setFillColor(254, 226, 226);
        doc.setTextColor(220, 38, 38);
        doc.roundedRect(margin, y, 30, 7, 2, 2, 'F');
        addText(t.mandatory, margin + 3, y + 5, { fontSize: 8, fontStyle: 'bold' });
      }
      
      let badgeX = rams.is_mandatory ? margin + 35 : margin;
      doc.setTextColor(67, 56, 202);
      rams.user_types.forEach(type => {
        doc.setFillColor(224, 231, 255);
        doc.roundedRect(badgeX, y, 25, 7, 2, 2, 'F');
        addText(type, badgeX + 3, y + 5, { fontSize: 8 });
        badgeX += 28;
      });
      
      y += 15;
      doc.setTextColor(0, 0, 0);

      // Applicable To
      if (t.applicableToItems.length > 0) {
        checkNewPage(30);
        addText(t.applicableTo, margin, y, { fontSize: 10, fontStyle: 'bold' });
        y += 6;
        t.applicableToItems.forEach(item => {
          addText(`• ${item}`, margin + 5, y, { fontSize: 9 });
          y += 5;
        });
        y += 5;
      }

      // Notice to Drivers
      if (t.noticeText) {
        checkNewPage(25);
        addText(t.noticeToDrivers, margin, y, { fontSize: 10, fontStyle: 'bold' });
        y += 6;
        doc.setFillColor(254, 249, 195);
        const noticeLines = doc.splitTextToSize(t.noticeText, pageWidth - 2 * margin - 10);
        const noticeHeight = noticeLines.length * 4 + 8;
        doc.roundedRect(margin, y, pageWidth - 2 * margin, noticeHeight, 3, 3, 'F');
        doc.setTextColor(100, 100, 100);
        doc.text(noticeLines, margin + 5, y + 6);
        y += noticeHeight + 8;
        doc.setTextColor(0, 0, 0);
      }

      // Risk Assessment
      if (t.hazards.length > 0) {
        checkNewPage(20);
        addText(t.riskAssessment, margin, y, { fontSize: 14, fontStyle: 'bold' });
        y += 10;

        t.hazards.forEach((hazard, idx) => {
          const originalHazard = hazards[idx];
          checkNewPage(70);
          
          // Hazard card
          doc.setDrawColor(229, 231, 235);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, y, pageWidth - 2 * margin, 60, 3, 3, 'FD');
          
          y += 8;
          addText(hazard.activity, margin + 5, y, { fontSize: 11, fontStyle: 'bold', maxWidth: pageWidth - 2 * margin - 10 });
          y += 8;
          
          // Two columns
          doc.setTextColor(100, 100, 100);
          addText(t.potentialHazard, margin + 5, y, { fontSize: 8 });
          addText(t.whoAtRisk, margin + 85, y, { fontSize: 8 });
          y += 4;
          doc.setTextColor(0, 0, 0);
          const hazardHeight = addText(hazard.potentialHazard, margin + 5, y, { fontSize: 9, maxWidth: 75 });
          addText(hazard.whoAtRisk, margin + 85, y, { fontSize: 9, maxWidth: 75 });
          y += Math.max(hazardHeight, 8);

          // Risk badges
          y += 4;
          const initialRisk = originalHazard.initial_likelihood * originalHazard.initial_severity;
          const residualRisk = originalHazard.residual_likelihood * originalHazard.residual_severity;
          
          doc.setTextColor(100, 100, 100);
          addText(t.initialRisk + ':', margin + 5, y, { fontSize: 8 });
          const [ir, ig, ib] = getRiskColor(initialRisk);
          doc.setFillColor(ir, ig, ib);
          doc.setTextColor(255, 255, 255);
          doc.roundedRect(margin + 35, y - 4, 30, 6, 2, 2, 'F');
          addText(`${originalHazard.initial_likelihood}×${originalHazard.initial_severity}=${initialRisk}`, margin + 37, y, { fontSize: 8, fontStyle: 'bold' });

          doc.setTextColor(100, 100, 100);
          addText(t.residualRisk + ':', margin + 85, y, { fontSize: 8 });
          const [rr, rg, rb] = getRiskColor(residualRisk);
          doc.setFillColor(rr, rg, rb);
          doc.setTextColor(255, 255, 255);
          doc.roundedRect(margin + 115, y - 4, 30, 6, 2, 2, 'F');
          addText(`${originalHazard.residual_likelihood}×${originalHazard.residual_severity}=${residualRisk}`, margin + 117, y, { fontSize: 8, fontStyle: 'bold' });
          
          y += 8;
          doc.setTextColor(100, 100, 100);
          addText(t.controlMeasures, margin + 5, y, { fontSize: 8 });
          y += 4;
          doc.setTextColor(0, 0, 0);
          const cmHeight = addText(hazard.controlMeasures, margin + 5, y, { fontSize: 9, maxWidth: pageWidth - 2 * margin - 15 });
          y += cmHeight + 5;

          if (hazard.notes) {
            doc.setTextColor(100, 100, 100);
            addText(t.notes, margin + 5, y, { fontSize: 8 });
            y += 4;
            doc.setTextColor(0, 0, 0);
            addText(hazard.notes, margin + 5, y, { fontSize: 9, maxWidth: pageWidth - 2 * margin - 15 });
            y += 8;
          }
          
          y += 10;
        });
      }

      // Signature
      if (rams.creator_signature) {
        checkNewPage(40);
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
        addText(t.creatorSignature, margin, y, { fontSize: 10, fontStyle: 'bold' });
        y += 8;
        
        try {
          doc.addImage(rams.creator_signature, 'PNG', margin, y, 50, 20);
        } catch (e) {
          // Signature image failed to load
        }
        
        y += 25;
        if (rams.creator_name) {
          addText(rams.creator_name, margin, y, { fontSize: 10, fontStyle: 'bold' });
          y += 5;
        }
        if (rams.signed_at) {
          doc.setTextColor(100, 100, 100);
          addText(`${t.signed}: ${format(new Date(rams.signed_at), "PPP")}`, margin, y, { fontSize: 9 });
        }
        y += 10;
      }

      // Risk Key Footer
      checkNewPage(35);
      y += 5;
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      
      doc.setTextColor(0, 0, 0);
      addText('Risk Key', margin, y, { fontSize: 10, fontStyle: 'bold' });
      y += 5;
      doc.setTextColor(100, 100, 100);
      addText('Risk = Likelihood × Severity', margin, y, { fontSize: 8 });
      y += 8;
      
      // Risk color boxes
      const riskLevels = [
        { label: 'Low (1-4)', color: [34, 197, 94] },
        { label: 'Medium (5-8)', color: [234, 179, 8] },
        { label: 'High (9-12)', color: [249, 115, 22] },
        { label: 'Very High (13+)', color: [239, 68, 68] },
      ];
      
      let keyX = margin;
      riskLevels.forEach(level => {
        doc.setFillColor(level.color[0], level.color[1], level.color[2]);
        doc.roundedRect(keyX, y, 8, 6, 1, 1, 'F');
        doc.setTextColor(60, 60, 60);
        addText(level.label, keyX + 10, y + 4, { fontSize: 8 });
        keyX += 40;
      });

      // Save
      const langSuffix = language !== 'EN' ? `-${language}` : '';
      doc.save(`${rams.reference_code}${langSuffix}.pdf`);
      
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading || loadingRAMS) {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Clews Recycling</h1>
              <p className="text-sm text-muted-foreground">RAMS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
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
            {(isAdmin || isManagement) && (
              <Link to="/mass-sign-off">
                <Button variant="default" size="sm" className="gap-2">
                  <ClipboardSignature className="h-4 w-4" />
                  <span>Mass Sign-Off</span>
                </Button>
              </Link>
            )}
            <Link to="/my-profile">
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">My Profile</span>
              </Button>
            </Link>
            <Link to="/portal">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Portal</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-accent to-primary py-12">
        <div className="container mx-auto px-4 text-center">
          <FileText className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Risk Assessments & Method Statements
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Essential documentation for safe work practices and regulatory compliance.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                What are RAMS?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                <strong>Risk Assessments and Method Statements (RAMS)</strong> are essential documents 
                that outline potential hazards and the safe procedures for carrying out work activities.
              </p>
              <p>
                These documents help ensure that all employees understand the risks involved in their 
                work and the steps they need to take to protect themselves and others.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Available Documents
              </CardTitle>
              <CardDescription>
                Select a document to view details and download as PDF
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRAMS ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Loading RAMS...</p>
                </div>
              ) : ramsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No RAMS documents available.</p>
                  <p className="text-sm mt-2">Contact your line manager for documentation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ramsList.map((rams) => {
                    const signed = isRamsSigned(rams.id);
                    const signedDate = getSignatureDate(rams.id);
                    return (
                    <div
                      key={rams.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedRAMS?.id === rams.id 
                          ? 'border-primary bg-accent shadow-md' 
                          : signed
                          ? 'border-primary/30 bg-primary/5'
                          : 'hover:bg-accent/50 hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedRAMS(rams)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{rams.reference_code}</span>
                            {rams.is_mandatory && (
                              <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                            )}
                            {signed && (
                              <Badge variant="default" className="text-xs gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Signed
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground">{rams.title}</p>
                          <div className="flex gap-1 flex-wrap">
                            {rams.user_types.map(type => (
                              <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                            ))}
                          </div>
                          {signed && signedDate && (
                            <p className="text-xs text-muted-foreground">
                              Signed on {format(signedDate, "PPP")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRAMS(rams);
                              setTimeout(() => handleDownloadPDF(rams), 100);
                            }}
                            disabled={isDownloading}
                            className="gap-2"
                          >
                            {isDownloading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            PDF
                          </Button>
                          {!signed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRAMS(rams);
                                setShowSignDialog(true);
                              }}
                              className="gap-2"
                            >
                              <PenTool className="h-4 w-4" />
                              Sign
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected RAMS Details */}
          {selectedRAMS && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedRAMS.reference_code} - {translatedContent?.title || selectedRAMS.title}
                      {isTranslating && <Loader2 className="h-4 w-4 animate-spin" />}
                    </CardTitle>
                    <CardDescription>
                      Created: {format(new Date(selectedRAMS.created_date), "PPP")} | 
                      Review: {format(new Date(selectedRAMS.review_date), "PPP")}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                  {!isRamsSigned(selectedRAMS.id) && (
                    <Button 
                      onClick={() => setShowSignDialog(true)}
                      variant="default"
                      className="gap-2"
                    >
                      <PenTool className="h-4 w-4" />
                      Sign RAMS
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleDownloadPDF(selectedRAMS)}
                    disabled={isDownloading}
                    variant="outline"
                    className="gap-2"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF ({LANGUAGES.find(l => l.code === language)?.label})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isRamsSigned(selectedRAMS.id) && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/30">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">
                    You signed this RAMS on {format(getSignatureDate(selectedRAMS.id)!, "PPP")}
                  </span>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {selectedRAMS.is_mandatory && <Badge variant="destructive">Mandatory</Badge>}
                {selectedRAMS.user_types.map(type => (
                  <Badge key={type} variant="secondary">{type}</Badge>
                ))}
              </div>

                {selectedRAMS.applicable_to.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Applicable To:</h4>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {selectedRAMS.applicable_to.map((item, i) => (
                        <li key={i}>{translatedContent?.applicableTo[i] || item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRAMS.notice_to_drivers && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold mb-2">Notice to Drivers:</h4>
                    <p className="text-muted-foreground">{translatedContent?.noticeToDrivers || selectedRAMS.notice_to_drivers}</p>
                  </div>
                )}

                {hazards.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Risk Assessment ({hazards.length} hazards)</h4>
                    <div className="space-y-4">
                      {hazards.map((hazard, idx) => (
                        <Card key={hazard.id} className="p-4">
                          <h5 className="font-semibold mb-3">{translatedContent?.hazards[idx]?.activity || hazard.activity}</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Potential Hazard:</span>
                              <p>{translatedContent?.hazards[idx]?.potentialHazard || hazard.potential_hazard}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Who at Risk:</span>
                              <p>{translatedContent?.hazards[idx]?.whoAtRisk || hazard.who_at_risk}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 mt-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Initial:</span>
                              <Badge 
                                className="text-white"
                                style={{ 
                                  backgroundColor: `rgb(${getRiskColor(hazard.initial_likelihood * hazard.initial_severity).join(',')})` 
                                }}
                              >
                                {hazard.initial_likelihood}×{hazard.initial_severity}={hazard.initial_likelihood * hazard.initial_severity}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Residual:</span>
                              <Badge 
                                className="text-white"
                                style={{ 
                                  backgroundColor: `rgb(${getRiskColor(hazard.residual_likelihood * hazard.residual_severity).join(',')})` 
                                }}
                              >
                                {hazard.residual_likelihood}×{hazard.residual_severity}={hazard.residual_likelihood * hazard.residual_severity}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="text-muted-foreground text-sm">Control Measures:</span>
                            <div 
                              className="text-sm mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1"
                              dangerouslySetInnerHTML={{ __html: translatedContent?.hazards[idx]?.controlMeasures || hazard.control_measures }}
                            />
                          </div>
                          {hazard.notes && (
                            <div className="mt-2 text-sm text-muted-foreground italic">
                              <span>Note: </span>
                              <span dangerouslySetInnerHTML={{ __html: translatedContent?.hazards[idx]?.notes || hazard.notes }} />
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>

                    {/* Risk Key */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                      <h5 className="font-semibold mb-3 text-sm">Risk Key</h5>
                      <p className="text-xs text-muted-foreground mb-3">Risk = Likelihood × Severity</p>
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
                          <span className="text-xs">Low (1-4)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(234, 179, 8)' }}></div>
                          <span className="text-xs">Medium (5-8)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(249, 115, 22)' }}></div>
                          <span className="text-xs">High (9-12)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
                          <span className="text-xs">Very High (13+)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Sign RAMS Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign RAMS Document</DialogTitle>
            <DialogDescription>
              {selectedRAMS && (
                <>Sign to confirm you have read and understood <strong>{selectedRAMS.reference_code} - {selectedRAMS.title}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              By signing below, you acknowledge that you have read, understood, and will comply with the safety procedures outlined in this RAMS document.
            </p>
            <SignaturePad
              onSave={setSignatureData}
              onCancel={() => setSignatureData(null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSignDialog(false);
              setSignatureData(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSignRAMS} 
              disabled={!signatureData || isSigning}
            >
              {isSigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Signing...
                </>
              ) : (
                "Confirm Signature"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RAMSPage;
