import { useEffect, useState } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, Languages, Loader2, CheckCircle, PenTool, ClipboardSignature } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import jsPDF from "jspdf";
import { SignaturePad } from "@/components/SignaturePad";
import { sanitizeHtml } from "@/lib/sanitize-html";

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

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'PL', label: 'Polski' },
  { code: 'UK', label: 'Українська' },
  { code: 'RO', label: 'Română' },
];

// Convert HTML to plain text for PDF rendering
const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const lines: string[] = [];
  
  const processNode = (node: Node, listCounter = { value: 0 }, isOrdered = false) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === 'ul') {
        el.childNodes.forEach(child => processNode(child, { value: 0 }, false));
      } else if (tagName === 'ol') {
        const counter = { value: 0 };
        el.childNodes.forEach(child => processNode(child, counter, true));
      } else if (tagName === 'li') {
        const text = el.textContent?.trim();
        if (text) {
          if (isOrdered) {
            listCounter.value++;
            lines.push(`${listCounter.value}. ${text}`);
          } else {
            lines.push(`• ${text}`);
          }
        }
      } else if (tagName === 'p' || tagName === 'div') {
        const text = el.textContent?.trim();
        if (text) lines.push(text);
      } else if (tagName === 'br') {
        // Skip line breaks, handled by structure
      } else {
        el.childNodes.forEach(child => processNode(child, listCounter, isOrdered));
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && node.parentElement?.tagName.toLowerCase() === 'div') {
        lines.push(text);
      }
    }
  };
  
  tempDiv.childNodes.forEach(child => processNode(child));
  
  // If no structured content was found, fall back to simple text extraction
  if (lines.length === 0) {
    return tempDiv.textContent?.trim() || '';
  }
  
  return lines.join('\n');
};

const RAMSDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  const [rams, setRams] = useState<RAMS | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [language, setLanguage] = useState('EN');
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
    if (user && id) {
      fetchRAMS();
      fetchUserSignature();
      checkAdminRole();
    }
  }, [user, id]);

  const checkAdminRole = async () => {
    if (!user) return;
    const { data: adminData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!adminData);
  };

  useEffect(() => {
    if (rams) {
      fetchHazards(rams.id);
    }
  }, [rams]);

  // Translate content when language changes
  useEffect(() => {
    const translateContent = async () => {
      if (!rams || language === 'EN') {
        setTranslatedContent(null);
        return;
      }

      setIsTranslating(true);
      try {
        const textsToTranslate = [
          rams.title,
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
        
        let i = 0;
        setTranslatedContent({
          title: translated[i++],
          applicableTo: rams.applicable_to.map(() => translated[i++]),
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

    if (rams && hazards.length >= 0) {
      translateContent();
    }
  }, [language, rams, hazards]);

  const fetchRAMS = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from("rams")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to load RAMS", variant: "destructive" });
      navigate("/rams");
    } else {
      setRams(data as RAMS);
    }
    setLoadingData(false);
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

  const fetchUserSignature = async () => {
    if (!user || !id) return;
    
    const { data } = await supabase
      .from("rams_user_signatures")
      .select("signed_at")
      .eq("user_id", user.id)
      .eq("rams_id", id)
      .maybeSingle();

    setSignedAt(data?.signed_at || null);
  };

  const handleSignRAMS = async () => {
    if (!rams || !signatureData || !user) return;
    
    setIsSigning(true);
    try {
      const { error } = await supabase
        .from("rams_user_signatures")
        .insert({
          rams_id: rams.id,
          user_id: user.id,
          signature_image: signatureData,
        });

      if (error) throw error;

      toast({
        title: "RAMS Signed",
        description: `You have successfully signed ${rams.reference_code}`,
      });

      setShowSignDialog(false);
      setSignatureData(null);
      fetchUserSignature();
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-rams`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
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
      toast({ title: "Translation failed", description: "Showing in English", variant: "destructive" });
      return texts;
    }
  };

  const getRiskColor = (risk: number): [number, number, number] => {
    if (risk <= 4) return [34, 197, 94];
    if (risk <= 8) return [234, 179, 8];
    if (risk <= 12) return [249, 115, 22];
    return [239, 68, 68];
  };

  const handleDownloadPDF = async () => {
    if (!rams) return;
    setIsDownloading(true);
    
    try {
      // Gather all texts to translate
      const textsToTranslate = [
        rams.title,
        'Appendix A – Risk assessment template',
        'Name of assessor:',
        'Date:',
        'Time:',
        'Location:',
        'Task being assessed:',
        'What is the hazard',
        'Who might be harmed?',
        'How might people be harmed?',
        'Existing risk control measures',
        'Risk rating',
        'Additional controls',
        'New risk rating (residual)',
        'Action / monitored by whom?',
        'Action / monitored by when?',
        'Review date:',
        'Signature:',
        'L',
        'C',
        'R',
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
        appendixHeader: translated[i++],
        nameOfAssessor: translated[i++],
        date: translated[i++],
        time: translated[i++],
        location: translated[i++],
        taskBeingAssessed: translated[i++],
        whatIsHazard: translated[i++],
        whoMightBeHarmed: translated[i++],
        howMightBeHarmed: translated[i++],
        existingRiskControl: translated[i++],
        riskRating: translated[i++],
        additionalControls: translated[i++],
        newRiskRating: translated[i++],
        actionByWhom: translated[i++],
        actionByWhen: translated[i++],
        reviewDate: translated[i++],
        signature: translated[i++],
        L: translated[i++],
        C: translated[i++],
        R: translated[i++],
        hazards: hazards.map(() => ({
          activity: translated[i++],
          potentialHazard: translated[i++],
          whoAtRisk: translated[i++],
          controlMeasures: translated[i++],
          notes: translated[i++],
        })),
      };

      // Generate PDF - Landscape for table format
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let y = 15;

      // Colors matching the template
      const darkBlue: [number, number, number] = [0, 51, 102];
      const lightBlue: [number, number, number] = [230, 240, 255];
      const borderColor: [number, number, number] = [0, 51, 102];

      // Helper function to draw cell with border
      const drawCell = (x: number, yPos: number, w: number, h: number, text: string, options?: { 
        fontSize?: number; 
        fontStyle?: 'normal' | 'bold'; 
        align?: 'left' | 'center';
        textColor?: [number, number, number];
        fillColor?: [number, number, number];
        valign?: 'top' | 'middle';
      }) => {
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        if (options?.fillColor) {
          doc.setFillColor(...options.fillColor);
          doc.rect(x, yPos, w, h, 'FD');
        } else {
          doc.rect(x, yPos, w, h);
        }
        
        doc.setFontSize(options?.fontSize || 8);
        doc.setFont('helvetica', options?.fontStyle || 'normal');
        doc.setTextColor(...(options?.textColor || [0, 0, 0]));
        
        const padding = 2;
        const maxWidth = w - padding * 2;
        const lines = doc.splitTextToSize(text, maxWidth);
        
        let textY = yPos + padding + 3;
        if (options?.valign === 'middle') {
          const textHeight = lines.length * (options?.fontSize || 8) * 0.35;
          textY = yPos + (h - textHeight) / 2 + 3;
        }
        
        if (options?.align === 'center') {
          lines.forEach((line: string, idx: number) => {
            const lineWidth = doc.getTextWidth(line);
            doc.text(line, x + (w - lineWidth) / 2, textY + idx * ((options?.fontSize || 8) * 0.4));
          });
        } else {
          doc.text(lines, x + padding, textY);
        }
      };

      // Appendix A Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkBlue);
      doc.text(t.appendixHeader, margin, y);
      y += 8;

      // Scenario/Description line (using RAMS title and applicable info)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const scenarioText = `${rams.reference_code}: ${t.title}${rams.applicable_to.length > 0 ? ` - Applicable to: ${rams.applicable_to.join(', ')}` : ''}`;
      const scenarioLines = doc.splitTextToSize(scenarioText, pageWidth - 2 * margin);
      doc.text(scenarioLines, margin, y);
      y += scenarioLines.length * 4 + 4;

      // Assessor Details Table
      const headerRowHeight = 8;
      const col1Width = 40;
      const col2Width = 80;
      const col3Width = 30;
      const col4Width = pageWidth - 2 * margin - col1Width - col2Width - col3Width;

      // Row 1: Name of assessor | [value] | Date | [value]
      drawCell(margin, y, col1Width, headerRowHeight, t.nameOfAssessor, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + col1Width, y, col2Width, headerRowHeight, rams.creator_name || '', { valign: 'middle' });
      drawCell(margin + col1Width + col2Width, y, col3Width, headerRowHeight, t.date, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + col1Width + col2Width + col3Width, y, col4Width, headerRowHeight, format(new Date(rams.created_date), "dd/MM/yyyy"), { valign: 'middle' });
      y += headerRowHeight;

      // Row 2: Time | [value] | Location | [value]
      drawCell(margin, y, col1Width, headerRowHeight, t.time, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + col1Width, y, col2Width, headerRowHeight, '', { valign: 'middle' });
      drawCell(margin + col1Width + col2Width, y, col3Width, headerRowHeight, t.location, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + col1Width + col2Width + col3Width, y, col4Width, headerRowHeight, '', { valign: 'middle' });
      y += headerRowHeight;

      // Row 3: Task being assessed | [value spanning rest]
      drawCell(margin, y, col1Width, headerRowHeight, t.taskBeingAssessed, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + col1Width, y, pageWidth - 2 * margin - col1Width, headerRowHeight, t.title, { valign: 'middle' });
      y += headerRowHeight + 3;

      // Main Risk Assessment Table
      // Column widths for the main table
      const tableWidth = pageWidth - 2 * margin;
      const colWidths = {
        hazard: tableWidth * 0.10,
        whoHarmed: tableWidth * 0.08,
        howHarmed: tableWidth * 0.10,
        existingControl: tableWidth * 0.14,
        riskL: tableWidth * 0.03,
        riskC: tableWidth * 0.03,
        riskR: tableWidth * 0.03,
        additionalControl: tableWidth * 0.12,
        newL: tableWidth * 0.03,
        newC: tableWidth * 0.03,
        newR: tableWidth * 0.03,
        byWhom: tableWidth * 0.12,
        byWhen: tableWidth * 0.12,
      };

      // Header Row 1 - Main headers with merged cells
      const headerHeight = 12;
      const subHeaderHeight = 8;
      
      let x = margin;
      drawCell(x, y, colWidths.hazard, headerHeight + subHeaderHeight, t.whatIsHazard, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += colWidths.hazard;
      drawCell(x, y, colWidths.whoHarmed, headerHeight + subHeaderHeight, t.whoMightBeHarmed, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += colWidths.whoHarmed;
      drawCell(x, y, colWidths.howHarmed, headerHeight + subHeaderHeight, t.howMightBeHarmed, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += colWidths.howHarmed;
      drawCell(x, y, colWidths.existingControl, headerHeight + subHeaderHeight, t.existingRiskControl, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += colWidths.existingControl;
      
      // Risk rating header (merged across L, C, R)
      const riskColsWidth = colWidths.riskL + colWidths.riskC + colWidths.riskR;
      drawCell(x, y, riskColsWidth, headerHeight, t.riskRating, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      // Sub-headers L, C, R
      drawCell(x, y + headerHeight, colWidths.riskL, subHeaderHeight, t.L, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      drawCell(x + colWidths.riskL, y + headerHeight, colWidths.riskC, subHeaderHeight, t.C, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      drawCell(x + colWidths.riskL + colWidths.riskC, y + headerHeight, colWidths.riskR, subHeaderHeight, t.R, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += riskColsWidth;
      
      drawCell(x, y, colWidths.additionalControl, headerHeight + subHeaderHeight, t.additionalControls, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += colWidths.additionalControl;
      
      // New risk rating header (merged across L, C, R)
      const newRiskColsWidth = colWidths.newL + colWidths.newC + colWidths.newR;
      drawCell(x, y, newRiskColsWidth, headerHeight, t.newRiskRating, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle', fontSize: 7 });
      // Sub-headers L, C, R
      drawCell(x, y + headerHeight, colWidths.newL, subHeaderHeight, t.L, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      drawCell(x + colWidths.newL, y + headerHeight, colWidths.newC, subHeaderHeight, t.C, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      drawCell(x + colWidths.newL + colWidths.newC, y + headerHeight, colWidths.newR, subHeaderHeight, t.R, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle' });
      x += newRiskColsWidth;
      
      drawCell(x, y, colWidths.byWhom, headerHeight + subHeaderHeight, t.actionByWhom, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle', fontSize: 7 });
      x += colWidths.byWhom;
      drawCell(x, y, colWidths.byWhen, headerHeight + subHeaderHeight, t.actionByWhen, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, align: 'center', valign: 'middle', fontSize: 7 });
      
      y += headerHeight + subHeaderHeight;

      // Data rows for each hazard
      t.hazards.forEach((hazard, idx) => {
        const originalHazard = hazards[idx];
        
        // Calculate row height based on content
        const controlMeasuresText = htmlToPlainText(hazard.controlMeasures);
        const notesText = hazard.notes ? htmlToPlainText(hazard.notes) : '';
        
        // Estimate heights for each cell
        doc.setFontSize(7);
        const hazardLines = doc.splitTextToSize(hazard.potentialHazard, colWidths.hazard - 4);
        const whoLines = doc.splitTextToSize(hazard.whoAtRisk, colWidths.whoHarmed - 4);
        const howLines = doc.splitTextToSize(hazard.activity, colWidths.howHarmed - 4);
        const controlLines = doc.splitTextToSize(controlMeasuresText, colWidths.existingControl - 4);
        const notesLines = doc.splitTextToSize(notesText, colWidths.additionalControl - 4);
        
        const maxLines = Math.max(hazardLines.length, whoLines.length, howLines.length, controlLines.length, notesLines.length, 4);
        const rowHeight = Math.max(25, maxLines * 3 + 6);
        
        // Check if we need a new page
        if (y + rowHeight > pageHeight - 25) {
          doc.addPage();
          y = 15;
        }
        
        const initialRisk = originalHazard.initial_likelihood * originalHazard.initial_severity;
        const residualRisk = originalHazard.residual_likelihood * originalHazard.residual_severity;
        
        x = margin;
        drawCell(x, y, colWidths.hazard, rowHeight, hazard.potentialHazard, { fontSize: 7 });
        x += colWidths.hazard;
        drawCell(x, y, colWidths.whoHarmed, rowHeight, hazard.whoAtRisk, { fontSize: 7 });
        x += colWidths.whoHarmed;
        drawCell(x, y, colWidths.howHarmed, rowHeight, hazard.activity, { fontSize: 7 });
        x += colWidths.howHarmed;
        drawCell(x, y, colWidths.existingControl, rowHeight, controlMeasuresText, { fontSize: 7 });
        x += colWidths.existingControl;
        
        // Initial risk L, C (Likelihood, Consequence/Severity), R (Risk)
        drawCell(x, y, colWidths.riskL, rowHeight, String(originalHazard.initial_likelihood), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.riskL;
        drawCell(x, y, colWidths.riskC, rowHeight, String(originalHazard.initial_severity), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.riskC;
        drawCell(x, y, colWidths.riskR, rowHeight, String(initialRisk), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.riskR;
        
        // Additional controls (using notes field)
        drawCell(x, y, colWidths.additionalControl, rowHeight, notesText, { fontSize: 7 });
        x += colWidths.additionalControl;
        
        // Residual risk L, C, R
        drawCell(x, y, colWidths.newL, rowHeight, String(originalHazard.residual_likelihood), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.newL;
        drawCell(x, y, colWidths.newC, rowHeight, String(originalHazard.residual_severity), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.newC;
        drawCell(x, y, colWidths.newR, rowHeight, String(residualRisk), { fontSize: 7, align: 'center', valign: 'middle' });
        x += colWidths.newR;
        
        // Action monitored by whom / when (empty for now - could be extended later)
        drawCell(x, y, colWidths.byWhom, rowHeight, '', { fontSize: 7 });
        x += colWidths.byWhom;
        drawCell(x, y, colWidths.byWhen, rowHeight, '', { fontSize: 7 });
        
        y += rowHeight;
      });

      // Footer: Review date and Signature
      y += 5;
      if (y + 12 > pageHeight - 10) {
        doc.addPage();
        y = 15;
      }
      
      const footerCol1 = 35;
      const footerCol2 = (pageWidth - 2 * margin - footerCol1 * 2) / 2;
      
      drawCell(margin, y, footerCol1, 10, t.reviewDate, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      drawCell(margin + footerCol1, y, footerCol2, 10, format(new Date(rams.review_date), "dd/MM/yyyy"), { valign: 'middle' });
      drawCell(margin + footerCol1 + footerCol2, y, footerCol1, 10, t.signature, { fontStyle: 'bold', textColor: darkBlue, fillColor: lightBlue, valign: 'middle' });
      
      // Add signature image if available
      const sigCellX = margin + footerCol1 * 2 + footerCol2;
      const sigCellWidth = pageWidth - 2 * margin - footerCol1 * 2 - footerCol2;
      drawCell(sigCellX, y, sigCellWidth, 10, '', { valign: 'middle' });
      
      if (rams.creator_signature) {
        try {
          doc.addImage(rams.creator_signature, 'PNG', sigCellX + 2, y + 1, 25, 8);
        } catch (e) {
          // Signature image failed to load
        }
      }

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

  if (!user || !rams) {
    return null;
  }

  const signed = !!signedAt;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">{rams.reference_code}</h1>
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
            <Link to="/rams">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to RAMS</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Document Header Section */}
      <div className="bg-gradient-to-br from-accent to-primary py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="secondary" className="text-sm">{rams.reference_code}</Badge>
            {rams.is_mandatory && (
              <Badge variant="destructive">Mandatory</Badge>
            )}
            {signed && (
              <Badge variant="outline" className="bg-green-500/20 text-green-100 border-green-400/50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            )}
            {rams.user_types.map(type => (
              <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
            ))}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
            {isTranslating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Translating...
              </span>
            ) : (
              translatedContent?.title || rams.title
            )}
          </h2>
          <p className="text-primary-foreground/80">
            Created: {format(new Date(rams.created_date), "PPP")} | Review: {format(new Date(rams.review_date), "PPP")}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={handleDownloadPDF}
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
            {!signed && (
              <Button onClick={() => setShowSignDialog(true)} className="gap-2">
                <PenTool className="h-4 w-4" />
                Sign This RAMS
              </Button>
            )}
            {isAdmin && (
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => navigate(`/mass-sign-off?type=rams&id=${rams.id}`)}
              >
                <ClipboardSignature className="h-4 w-4" />
                Mass Sign Off
              </Button>
            )}
          </div>

          {/* Signed Status */}
          {signed && (
            <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">
                You signed this RAMS on {format(new Date(signedAt!), "PPP")}
              </span>
            </div>
          )}

          {/* Applicable To */}
          {rams.applicable_to && rams.applicable_to.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-3">Applicable To:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {rams.applicable_to.map((item, i) => (
                    <li key={i}>{translatedContent?.applicableTo?.[i] || item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Notice to Drivers */}
          {rams.notice_to_drivers && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200">
              <h4 className="font-semibold mb-2">Notice to Drivers:</h4>
              <p className="text-muted-foreground">{translatedContent?.noticeToDrivers || rams.notice_to_drivers}</p>
            </div>
          )}

          {/* Risk Assessment */}
          {hazards.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-xl">Risk Assessment ({hazards.length} hazards)</h4>
              {hazards.map((hazard, idx) => (
                <Card key={hazard.id} className="p-6">
                  <h5 className="font-semibold text-lg mb-4">{translatedContent?.hazards?.[idx]?.activity || hazard.activity}</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground font-medium">Potential Hazard:</span>
                      <p className="mt-1">{translatedContent?.hazards?.[idx]?.potentialHazard || hazard.potential_hazard}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Who at Risk:</span>
                      <p className="mt-1">{translatedContent?.hazards?.[idx]?.whoAtRisk || hazard.who_at_risk}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 flex-wrap">
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
                  <div className="mt-4">
                    <span className="text-muted-foreground text-sm font-medium">Control Measures:</span>
                    <div 
                      className="text-sm mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(translatedContent?.hazards?.[idx]?.controlMeasures || hazard.control_measures) }}
                    />
                  </div>
                  {hazard.notes && (
                    <div className="mt-3 text-sm text-muted-foreground italic">
                      <span>Note: </span>
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(translatedContent?.hazards?.[idx]?.notes || hazard.notes) }} />
                    </div>
                  )}
                </Card>
              ))}

              {/* Risk Key */}
              <Card className="p-4 bg-muted/50">
                <h5 className="font-semibold mb-3 text-sm">Risk Key</h5>
                <p className="text-xs text-muted-foreground mb-3">Risk = Likelihood × Severity</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
                    <span className="text-sm">Low (1-4)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(234, 179, 8)' }}></div>
                    <span className="text-sm">Medium (5-8)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(249, 115, 22)' }}></div>
                    <span className="text-sm">High (9-12)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
                    <span className="text-sm">Very High (13+)</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Sign RAMS Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign RAMS Document</DialogTitle>
            <DialogDescription>
              Sign to confirm you have read and understood <strong>{rams.reference_code} - {rams.title}</strong>
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

export default RAMSDetailPage;
