import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, FileUp, Save, X, Upload, Download, FileDown, Circle } from "lucide-react";
import { format, addMonths, differenceInDays, isBefore, isAfter } from "date-fns";
import jsPDF from "jspdf";
import { SignaturePad } from "@/components/SignaturePad";
import { CompactRichTextEditor } from "@/components/CompactRichTextEditor";
import { UserSelector } from "@/components/UserSelector";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { TranslationSaveDialog, TranslationOption } from "@/components/TranslationSaveDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  assigned_users: string[];
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

const USER_TYPE_OPTIONS = ["Yard", "Drivers", "Office"];

const emptyRAMS: Omit<RAMS, "id"> = {
  reference_code: "",
  title: "",
  applicable_to: [],
  notice_to_drivers: "",
  created_date: format(new Date(), "yyyy-MM-dd"),
  review_date: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
  creator_signature: null,
  creator_name: "",
  signed_at: null,
  is_mandatory: false,
  user_types: [],
  assigned_users: [],
};

const emptyHazard: Omit<Hazard, "id" | "rams_id"> = {
  activity: "",
  potential_hazard: "",
  who_at_risk: "",
  initial_likelihood: 1,
  initial_severity: 1,
  control_measures: "",
  residual_likelihood: 1,
  residual_severity: 1,
  notes: "",
  display_order: 0,
};

export const RAMSBuilder = () => {
  const { toast } = useToast();
  const [ramsList, setRamsList] = useState<RAMS[]>([]);
  const [selectedRAMS, setSelectedRAMS] = useState<RAMS | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Omit<RAMS, "id">>(emptyRAMS);
  const [editHazards, setEditHazards] = useState<(Omit<Hazard, "id" | "rams_id"> & { id?: string })[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [pendingSaveRamsId, setPendingSaveRamsId] = useState<string | null>(null);

  useEffect(() => {
    fetchRAMSList();
  }, []);

  useEffect(() => {
    if (selectedRAMS) {
      fetchHazards(selectedRAMS.id);
    }
  }, [selectedRAMS]);

  const fetchRAMSList = async () => {
    const { data, error } = await supabase
      .from("rams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch RAMS list", variant: "destructive" });
    } else {
      setRamsList((data as RAMS[]) || []);
    }
  };

  const fetchHazards = async (ramsId: string) => {
    const { data, error } = await supabase
      .from("rams_hazards")
      .select("*")
      .eq("rams_id", ramsId)
      .order("display_order");

    if (error) {
      toast({ title: "Error", description: "Failed to fetch hazards", variant: "destructive" });
    } else {
      setHazards((data as Hazard[]) || []);
    }
  };

  const handleCreateNew = () => {
    setSelectedRAMS(null);
    setEditForm(emptyRAMS);
    setEditHazards([{ ...emptyHazard }]);
    setIsEditing(true);
  };

  const handleEdit = (rams: RAMS) => {
    setSelectedRAMS(rams);
    setEditForm({
      reference_code: rams.reference_code,
      title: rams.title,
      applicable_to: rams.applicable_to,
      notice_to_drivers: rams.notice_to_drivers || "",
      created_date: rams.created_date,
      review_date: rams.review_date,
      creator_signature: rams.creator_signature,
      creator_name: rams.creator_name || "",
      signed_at: rams.signed_at,
      is_mandatory: rams.is_mandatory,
      user_types: rams.user_types,
      assigned_users: rams.assigned_users || [],
    });
    setEditHazards(hazards.map(h => ({ ...h })));
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    if (!editForm.reference_code || !editForm.title) {
      toast({ title: "Error", description: "Reference code and title are required", variant: "destructive" });
      return;
    }
    setShowTranslationDialog(true);
  };

  const handleSaveWithTranslation = async (translationOption: TranslationOption) => {
    try {
      let ramsId: string;

      if (selectedRAMS) {
        // Update existing RAMS
        const { error } = await supabase
          .from("rams")
          .update({
            ...editForm,
            signed_at: editForm.creator_signature ? new Date().toISOString() : null,
          })
          .eq("id", selectedRAMS.id);

        if (error) throw error;
        ramsId = selectedRAMS.id;

        // Delete existing hazards and re-insert
        await supabase.from("rams_hazards").delete().eq("rams_id", ramsId);
      } else {
        // Create new RAMS
        const { data, error } = await supabase
          .from("rams")
          .insert({
            ...editForm,
            signed_at: editForm.creator_signature ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (error) throw error;
        ramsId = data.id;
      }

      // Insert hazards
      if (editHazards.length > 0) {
        const hazardsToInsert = editHazards.map((h, idx) => ({
          rams_id: ramsId,
          activity: h.activity,
          potential_hazard: h.potential_hazard,
          who_at_risk: h.who_at_risk,
          initial_likelihood: h.initial_likelihood,
          initial_severity: h.initial_severity,
          control_measures: h.control_measures,
          residual_likelihood: h.residual_likelihood,
          residual_severity: h.residual_severity,
          notes: h.notes || null,
          display_order: idx,
        }));

        const { error: hazardError } = await supabase
          .from("rams_hazards")
          .insert(hazardsToInsert);

        if (hazardError) throw hazardError;
      }

      // Translate if requested
      if (translationOption === "all") {
        setIsTranslating(true);
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
              body: JSON.stringify({ rams_id: ramsId }),
            }
          );
          const result = await response.json();
          if (result.success) {
            toast({ title: "Success", description: "RAMS saved and translated successfully" });
          } else {
            toast({ title: "Warning", description: "RAMS saved but translation failed", variant: "destructive" });
          }
        } catch (translateError) {
          console.error("Translation error:", translateError);
          toast({ title: "Warning", description: "RAMS saved but translation failed", variant: "destructive" });
        } finally {
          setIsTranslating(false);
        }
      } else {
        toast({ title: "Success", description: "RAMS saved successfully" });
      }

      setShowTranslationDialog(false);
      setIsEditing(false);
      fetchRAMSList();
      if (ramsId) {
        const { data } = await supabase.from("rams").select("*").eq("id", ramsId).single();
        if (data) {
          setSelectedRAMS(data as RAMS);
          fetchHazards(ramsId);
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save RAMS", variant: "destructive" });
      setShowTranslationDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    const { error } = await supabase.from("rams").delete().eq("id", itemToDelete);

    if (error) {
      toast({ title: "Error", description: "Failed to delete RAMS", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "RAMS deleted successfully" });
      setSelectedRAMS(null);
      fetchRAMSList();
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const addHazardRow = () => {
    setEditHazards([...editHazards, { ...emptyHazard, display_order: editHazards.length }]);
  };

  const removeHazardRow = (index: number) => {
    setEditHazards(editHazards.filter((_, i) => i !== index));
  };

  const updateHazard = (index: number, field: string, value: any) => {
    const updated = [...editHazards];
    updated[index] = { ...updated[index], [field]: value };
    setEditHazards(updated);
  };

  const toggleUserType = (type: string) => {
    if (editForm.user_types.includes(type)) {
      setEditForm({ ...editForm, user_types: editForm.user_types.filter(t => t !== type) });
    } else {
      setEditForm({ ...editForm, user_types: [...editForm.user_types, type] });
    }
  };

  const handleApplicableToChange = (value: string) => {
    const items = value.split("\n").filter(item => item.trim());
    setEditForm({ ...editForm, applicable_to: items });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const totalFiles = files.length;
    let successCount = 0;
    let errorCount = 0;
    
    toast({ title: "Processing", description: `Reading and parsing ${totalFiles} document(s)...` });
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Read file as text
          const text = await readFileAsText(file);
          
          if (!text || text.trim().length === 0) {
            throw new Error(`Could not read content from ${file.name}`);
          }

          console.log(`Document ${file.name} content length:`, text.length);

          // Call the edge function to parse with AI
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-rams-document`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ documentContent: text }),
            }
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || `Failed to parse ${file.name}`);
          }

          const data = result.data;

          // Save directly to database for each document
          const ramsData = {
            reference_code: data.reference_code || "",
            title: data.title || "",
            applicable_to: data.applicable_to || [],
            notice_to_drivers: data.notice_to_drivers || "",
            created_date: format(new Date(), "yyyy-MM-dd"),
            review_date: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
            is_mandatory: false,
            user_types: [],
            creator_signature: null,
            creator_name: "",
            signed_at: null,
          };

          const { data: newRams, error: ramsError } = await supabase
            .from("rams")
            .insert(ramsData)
            .select()
            .single();

          if (ramsError) throw ramsError;

          // Insert hazards
          if (data.hazards && data.hazards.length > 0) {
            const hazardsToInsert = data.hazards.map((h: any, idx: number) => ({
              rams_id: newRams.id,
              activity: h.activity || "",
              potential_hazard: h.potential_hazard || "",
              who_at_risk: h.who_at_risk || "",
              initial_likelihood: h.initial_likelihood || 1,
              initial_severity: h.initial_severity || 1,
              control_measures: h.control_measures || "",
              residual_likelihood: h.residual_likelihood || 1,
              residual_severity: h.residual_severity || 1,
              notes: h.notes || "",
              display_order: idx,
            }));

            const { error: hazardError } = await supabase
              .from("rams_hazards")
              .insert(hazardsToInsert);

            if (hazardError) throw hazardError;
          }

          successCount++;
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          errorCount++;
        }
      }

      // Refresh the RAMS list
      await fetchRAMSList();

      if (successCount > 0 && errorCount === 0) {
        toast({ 
          title: "Success", 
          description: `Successfully created ${successCount} RAMS document(s)`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({ 
          title: "Partial Success", 
          description: `Created ${successCount} RAMS, ${errorCount} failed`,
          variant: "destructive",
        });
      } else {
        toast({ 
          title: "Error", 
          description: "Failed to process all documents",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error parsing documents:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to parse documents",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      e.target.value = "";
    }
  };

  // Helper to read file content
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const fileName = file.name.toLowerCase();
        
        // For .docx/.docm files, we need to extract text from the XML (ZIP format)
        if (fileName.endsWith('.docx') || fileName.endsWith('.docm')) {
          extractTextFromDocx(arrayBuffer).then(resolve).catch(reject);
        } else if (fileName.endsWith('.doc')) {
          // For .doc files (legacy binary format), extract text differently
          extractTextFromDoc(arrayBuffer).then(resolve).catch(reject);
        } else {
          // For plain text files
          const decoder = new TextDecoder('utf-8');
          resolve(decoder.decode(arrayBuffer));
        }
      };
      
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Extract text from legacy .doc files (OLE Compound Document format)
  const extractTextFromDoc = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      const textChunks: string[] = [];
      
      // Method 1: Extract UTF-16LE encoded text (common in .doc files)
      // Look for runs of readable text
      let i = 0;
      while (i < uint8Array.length - 1) {
        // Check for UTF-16LE encoded text (every other byte is often 0 for ASCII)
        if (uint8Array[i] >= 32 && uint8Array[i] <= 126 && uint8Array[i + 1] === 0) {
          let text = '';
          while (i < uint8Array.length - 1 && 
                 uint8Array[i] >= 32 && uint8Array[i] <= 126 && 
                 uint8Array[i + 1] === 0) {
            text += String.fromCharCode(uint8Array[i]);
            i += 2;
          }
          if (text.length >= 3) { // Only keep text chunks of 3+ chars
            textChunks.push(text);
          }
        }
        i++;
      }
      
      // Method 2: Also extract plain ASCII text runs
      const asciiChunks: string[] = [];
      let asciiRun = '';
      for (let j = 0; j < uint8Array.length; j++) {
        const byte = uint8Array[j];
        // Printable ASCII range plus common whitespace
        if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
          asciiRun += String.fromCharCode(byte);
        } else {
          if (asciiRun.length >= 10) { // Keep runs of 10+ chars
            asciiChunks.push(asciiRun.trim());
          }
          asciiRun = '';
        }
      }
      if (asciiRun.length >= 10) {
        asciiChunks.push(asciiRun.trim());
      }
      
      // Combine and deduplicate
      const allText = [...textChunks, ...asciiChunks].join('\n');
      
      // Clean up: remove duplicate lines and very short lines
      const lines = allText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length >= 3)
        .filter((line, index, self) => self.indexOf(line) === index);
      
      const result = lines.join('\n');
      console.log("Extracted .doc content length:", result.length);
      console.log("First 500 chars:", result.substring(0, 500));
      
      if (result.length < 50) {
        throw new Error("Could not extract sufficient text from .doc file. Please convert to .docx format.");
      }
      
      return result;
    } catch (error) {
      console.error("Error extracting text from .doc:", error);
      throw new Error("Failed to read .doc file. Please convert to .docx format for better results.");
    }
  };

  // Extract text from DOCX/DOCM files (they are ZIP files with XML inside)
  const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Get the main document content
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        throw new Error("Could not find document content");
      }

      // Parse XML and extract text content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
      
      // Extract all text nodes from <w:t> elements
      const textNodes = xmlDoc.getElementsByTagName('w:t');
      const textContent: string[] = [];
      
      for (let i = 0; i < textNodes.length; i++) {
        const text = textNodes[i].textContent;
        if (text) {
          textContent.push(text);
        }
      }

      // Also check for table content
      const tableRows = xmlDoc.getElementsByTagName('w:tr');
      const tableContent: string[] = [];
      
      for (let i = 0; i < tableRows.length; i++) {
        const cells = tableRows[i].getElementsByTagName('w:tc');
        const rowContent: string[] = [];
        
        for (let j = 0; j < cells.length; j++) {
          const cellTexts = cells[j].getElementsByTagName('w:t');
          const cellContent: string[] = [];
          for (let k = 0; k < cellTexts.length; k++) {
            if (cellTexts[k].textContent) {
              cellContent.push(cellTexts[k].textContent);
            }
          }
          rowContent.push(cellContent.join(' '));
        }
        tableContent.push(rowContent.join(' | '));
      }

      const finalContent = textContent.join(' ') + '\n\nTable Data:\n' + tableContent.join('\n');
      console.log("Extracted document content:", finalContent.substring(0, 500));
      
      return finalContent;
    } catch (error) {
      console.error("Error extracting text from DOCX:", error);
      throw new Error("Could not extract text from document");
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 4) return "bg-green-500";
    if (risk <= 8) return "bg-yellow-500";
    if (risk <= 12) return "bg-orange-500";
    return "bg-red-500";
  };

  const getExpiryStatus = (reviewDate: string): { color: string; label: string; daysRemaining: number } => {
    const today = new Date();
    const review = new Date(reviewDate);
    const daysRemaining = differenceInDays(review, today);
    
    if (daysRemaining < 0) {
      return { color: 'bg-red-500', label: 'Expired', daysRemaining };
    } else if (daysRemaining <= 30) {
      return { color: 'bg-red-500', label: 'Expiring', daysRemaining };
    } else if (daysRemaining <= 90) {
      return { color: 'bg-amber-500', label: 'Due Soon', daysRemaining };
    }
    return { color: 'bg-green-500', label: 'Valid', daysRemaining };
  };

  const handleDownloadExpiryReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RAMS Expiry Report', margin, 20);
    
    y = 40;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), "PPP")}`, margin, y);
    y += 15;

    // Sort RAMS by days remaining
    const sortedRams = [...ramsList].sort((a, b) => {
      const daysA = differenceInDays(new Date(a.review_date), new Date());
      const daysB = differenceInDays(new Date(b.review_date), new Date());
      return daysA - daysB;
    });

    // Section: Expired & Expiring Soon (red)
    const expired = sortedRams.filter(r => {
      const days = differenceInDays(new Date(r.review_date), new Date());
      return days <= 30;
    });

    // Section: Due Soon (amber)
    const dueSoon = sortedRams.filter(r => {
      const days = differenceInDays(new Date(r.review_date), new Date());
      return days > 30 && days <= 90;
    });

    // Section: Valid (green)
    const valid = sortedRams.filter(r => {
      const days = differenceInDays(new Date(r.review_date), new Date());
      return days > 90;
    });

    const addSection = (title: string, items: RAMS[], bgColor: [number, number, number]) => {
      if (items.length === 0) return;
      
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${title} (${items.length})`, margin + 4, y + 6);
      y += 14;

      doc.setTextColor(0, 0, 0);
      items.forEach((rams) => {
        const status = getExpiryStatus(rams.review_date);
        
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(rams.reference_code, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(` - ${rams.title.substring(0, 50)}${rams.title.length > 50 ? '...' : ''}`, margin + 25, y);
        
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const daysText = status.daysRemaining < 0 
          ? `Expired ${Math.abs(status.daysRemaining)} days ago`
          : `${status.daysRemaining} days remaining`;
        doc.text(`Review: ${format(new Date(rams.review_date), "PPP")} (${daysText})`, margin + 5, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
      });
      y += 5;
    };

    addSection('Expired / Expiring Within 30 Days', expired, [239, 68, 68]);
    addSection('Due Within 90 Days', dueSoon, [245, 158, 11]);
    addSection('Valid', valid, [34, 197, 94]);

    // Summary
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total RAMS: ${ramsList.length}`, margin + 5, y);
    y += 5;
    doc.setTextColor(239, 68, 68);
    doc.text(`Requiring Immediate Attention: ${expired.length}`, margin + 5, y);
    y += 5;
    doc.setTextColor(245, 158, 11);
    doc.text(`Review Within 90 Days: ${dueSoon.length}`, margin + 5, y);
    y += 5;
    doc.setTextColor(34, 197, 94);
    doc.text(`Valid: ${valid.length}`, margin + 5, y);

    doc.save(`RAMS-Expiry-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Success", description: "Expiry report downloaded" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">RAMS Builder</h2>
          <p className="text-muted-foreground">Create and manage Risk Assessment Method Statements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleDownloadExpiryReport}>
            <FileDown className="h-4 w-4" />
            Expiry Report
          </Button>
          <label htmlFor="file-upload">
            <Button variant="outline" className="gap-2" asChild disabled={isUploading}>
              <span>
                <Upload className="h-4 w-4" />
                {isUploading ? "Processing..." : "Upload Document(s)"}
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".doc,.docx,.docm"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New RAMS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RAMS List */}
        <Card>
          <CardHeader>
            <CardTitle>RAMS Documents</CardTitle>
            <CardDescription>Select a document to view or edit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {ramsList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No RAMS documents yet</p>
            ) : (
              ramsList.map((rams) => {
                const expiryStatus = getExpiryStatus(rams.review_date);
                return (
                  <div
                    key={rams.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedRAMS?.id === rams.id ? "bg-accent border-primary" : "hover:bg-accent/50"
                    )}
                    onClick={() => {
                      setSelectedRAMS(rams);
                      setIsEditing(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {/* Traffic Light Indicator */}
                        <div className="flex flex-col items-center gap-0.5 pt-1" title={`${expiryStatus.label}: ${expiryStatus.daysRemaining < 0 ? 'Expired' : `${expiryStatus.daysRemaining} days remaining`}`}>
                          <div className={cn("w-3 h-3 rounded-full", expiryStatus.color)} />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {expiryStatus.daysRemaining < 0 ? 'Exp' : `${expiryStatus.daysRemaining}d`}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{rams.reference_code}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{rams.title}</p>
                          <div className="flex gap-1 flex-wrap">
                            {rams.is_mandatory && (
                              <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                            )}
                            {rams.user_types.map(type => (
                              <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRAMS(rams);
                            fetchHazards(rams.id);
                            setTimeout(() => handleEdit(rams), 100);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(rams.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* RAMS Detail/Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {isEditing ? (selectedRAMS ? "Edit RAMS" : "Create New RAMS") : "RAMS Details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <RAMSForm
                form={editForm}
                setForm={setEditForm}
                hazards={editHazards}
                updateHazard={updateHazard}
                addHazardRow={addHazardRow}
                removeHazardRow={removeHazardRow}
                toggleUserType={toggleUserType}
                handleApplicableToChange={handleApplicableToChange}
                onSave={handleSaveClick}
                onCancel={() => setIsEditing(false)}
                getRiskColor={getRiskColor}
              />
            ) : selectedRAMS ? (
              <RAMSView rams={selectedRAMS} hazards={hazards} getRiskColor={getRiskColor} />
            ) : (
              <p className="text-muted-foreground">Select a RAMS document or create a new one</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RAMS?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the RAMS document and all its hazards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TranslationSaveDialog
        open={showTranslationDialog}
        onOpenChange={setShowTranslationDialog}
        onConfirm={handleSaveWithTranslation}
        isTranslating={isTranslating}
        documentType="RAMS"
        isNew={!selectedRAMS}
      />
    </div>
  );
};

interface RAMSFormProps {
  form: Omit<RAMS, "id">;
  setForm: (form: Omit<RAMS, "id">) => void;
  hazards: (Omit<Hazard, "id" | "rams_id"> & { id?: string })[];
  updateHazard: (index: number, field: string, value: any) => void;
  addHazardRow: () => void;
  removeHazardRow: (index: number) => void;
  toggleUserType: (type: string) => void;
  handleApplicableToChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  getRiskColor: (risk: number) => string;
}

const RAMSForm = ({
  form,
  setForm,
  hazards,
  updateHazard,
  addHazardRow,
  removeHazardRow,
  toggleUserType,
  handleApplicableToChange,
  onSave,
  onCancel,
  getRiskColor,
}: RAMSFormProps) => {
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reference">Reference Code *</Label>
          <Input
            id="reference"
            value={form.reference_code}
            onChange={(e) => setForm({ ...form, reference_code: e.target.value })}
            placeholder="e.g., RA01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., RORO (Roll on and Roll Off Skips)"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Created Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.created_date ? format(new Date(form.created_date), "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.created_date ? new Date(form.created_date) : undefined}
                onSelect={(date) => date && setForm({ ...form, created_date: format(date, "yyyy-MM-dd") })}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Review Date (12 months default)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.review_date ? format(new Date(form.review_date), "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.review_date ? new Date(form.review_date) : undefined}
                onSelect={(date) => date && setForm({ ...form, review_date: format(date, "yyyy-MM-dd") })}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* User Types & Mandatory */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>User Types</Label>
          <div className="flex gap-4 flex-wrap">
            {USER_TYPE_OPTIONS.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Switch
                  checked={form.user_types.includes(type)}
                  onCheckedChange={() => toggleUserType(type)}
                />
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>
        
        <UserSelector
          selectedUsers={form.assigned_users || []}
          onSelectionChange={(users) => setForm({ ...form, assigned_users: users })}
          label="Assign Specific Users (optional)"
        />
        
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_mandatory}
            onCheckedChange={(checked) => setForm({ ...form, is_mandatory: checked })}
          />
          <Label>Mandatory</Label>
        </div>
      </div>

      {/* Applicable To */}
      <div className="space-y-2">
        <Label>Applicable To (one per line)</Label>
        <Textarea
          value={form.applicable_to.join("\n")}
          onChange={(e) => handleApplicableToChange(e.target.value)}
          placeholder="e.g., Cardboard 40YD Open&#10;End of life Vehicle Components 40YD Open"
          rows={3}
        />
      </div>

      {/* Notice to Drivers */}
      <div className="space-y-2">
        <Label>Notice to Drivers</Label>
        <Textarea
          value={form.notice_to_drivers || ""}
          onChange={(e) => setForm({ ...form, notice_to_drivers: e.target.value })}
          placeholder="Enter notice text..."
          rows={3}
        />
      </div>

      {/* Hazards Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-lg font-semibold">Risk Assessment Hazards</Label>
          <Button size="sm" onClick={addHazardRow} variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Hazard
          </Button>
        </div>

        {hazards.map((hazard, idx) => (
          <Card key={idx} className="p-4 space-y-4">
            <div className="flex justify-between items-start">
              <span className="font-medium">Hazard {idx + 1}</span>
              {hazards.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeHazardRow(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity</Label>
                <Input
                  value={hazard.activity}
                  onChange={(e) => updateHazard(idx, "activity", e.target.value)}
                  placeholder="e.g., Gaining access to bin"
                />
              </div>
              <div className="space-y-2">
                <Label>Potential Hazard</Label>
                <Input
                  value={hazard.potential_hazard}
                  onChange={(e) => updateHazard(idx, "potential_hazard", e.target.value)}
                  placeholder="e.g., Contact with moving vehicles"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Who is at Risk</Label>
              <Input
                value={hazard.who_at_risk}
                onChange={(e) => updateHazard(idx, "who_at_risk", e.target.value)}
                placeholder="e.g., HGV Driver/Forklift Driver"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Initial Likelihood (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.initial_likelihood}
                  onChange={(e) => updateHazard(idx, "initial_likelihood", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Severity (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.initial_severity}
                  onChange={(e) => updateHazard(idx, "initial_severity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Risk</Label>
                <div className={cn(
                  "h-10 rounded-md flex items-center justify-center text-white font-bold",
                  getRiskColor(hazard.initial_likelihood * hazard.initial_severity)
                )}>
                  {hazard.initial_likelihood * hazard.initial_severity}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Control Measures</Label>
              <CompactRichTextEditor
                content={hazard.control_measures}
                onChange={(content) => updateHazard(idx, "control_measures", content)}
                placeholder="Enter control measures..."
                minHeight="100px"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Residual Likelihood (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.residual_likelihood}
                  onChange={(e) => updateHazard(idx, "residual_likelihood", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Residual Severity (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={hazard.residual_severity}
                  onChange={(e) => updateHazard(idx, "residual_severity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Residual Risk</Label>
                <div className={cn(
                  "h-10 rounded-md flex items-center justify-center text-white font-bold",
                  getRiskColor(hazard.residual_likelihood * hazard.residual_severity)
                )}>
                  {hazard.residual_likelihood * hazard.residual_severity}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <CompactRichTextEditor
                content={hazard.notes || ""}
                onChange={(content) => updateHazard(idx, "notes", content)}
                placeholder="Additional notes..."
                minHeight="60px"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Signature */}
      <div className="space-y-4 border-t pt-4">
        <Label className="text-lg font-semibold">Creator Signature</Label>
        <div className="space-y-2">
          <Label>Creator Name</Label>
          <Input
            value={form.creator_name || ""}
            onChange={(e) => setForm({ ...form, creator_name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>
        
        {form.creator_signature ? (
          <div className="space-y-2">
            <Label>Signature</Label>
            <div className="border rounded-md p-2 bg-white">
              <img src={form.creator_signature} alt="Signature" className="max-h-24" />
            </div>
            <Button variant="outline" onClick={() => setForm({ ...form, creator_signature: null })}>
              Clear Signature
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowSignaturePad(true)}>
            Add Signature
          </Button>
        )}

        {showSignaturePad && (
          <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign Document</DialogTitle>
              </DialogHeader>
              <SignaturePad
                onSave={(signature) => {
                  setForm({ ...form, creator_signature: signature });
                  setShowSignaturePad(false);
                }}
                onCancel={() => setShowSignaturePad(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-1" /> Save RAMS
        </Button>
      </div>
    </div>
  );
};

interface RAMSViewProps {
  rams: RAMS;
  hazards: Hazard[];
  getRiskColor: (risk: number) => string;
}

const RAMSView = ({ rams, hazards, getRiskColor }: RAMSViewProps) => {
  const handleDownloadPDF = () => {
    const getRiskColorRGB = (risk: number): [number, number, number] => {
      if (risk <= 4) return [34, 197, 94];
      if (risk <= 8) return [234, 179, 8];
      if (risk <= 12) return [249, 115, 22];
      return [239, 68, 68];
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    const addText = (text: string, x: number, yPos: number, options?: { fontSize?: number; fontStyle?: string; maxWidth?: number }) => {
      doc.setFontSize(options?.fontSize || 10);
      doc.setFont('helvetica', options?.fontStyle === 'bold' ? 'bold' : 'normal');
      
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
    addText(rams.title, margin, 28, { fontSize: 12 });
    
    y = 45;
    doc.setTextColor(0, 0, 0);

    // Meta info
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
    y += 8;
    
    doc.setTextColor(100, 100, 100);
    addText('Created Date', margin + 5, y, { fontSize: 8 });
    addText('Review Date', margin + 70, y, { fontSize: 8 });
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
      addText('Mandatory', margin + 3, y + 5, { fontSize: 8, fontStyle: 'bold' });
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
    if (rams.applicable_to.length > 0) {
      checkNewPage(30);
      addText('Applicable To', margin, y, { fontSize: 10, fontStyle: 'bold' });
      y += 6;
      rams.applicable_to.forEach(item => {
        addText(`• ${item}`, margin + 5, y, { fontSize: 9 });
        y += 5;
      });
      y += 5;
    }

    // Notice to Drivers
    if (rams.notice_to_drivers) {
      checkNewPage(25);
      addText('Notice to Drivers', margin, y, { fontSize: 10, fontStyle: 'bold' });
      y += 6;
      doc.setFillColor(254, 249, 195);
      const noticeLines = doc.splitTextToSize(rams.notice_to_drivers, pageWidth - 2 * margin - 10);
      const noticeHeight = noticeLines.length * 4 + 8;
      doc.roundedRect(margin, y, pageWidth - 2 * margin, noticeHeight, 3, 3, 'F');
      doc.setTextColor(100, 100, 100);
      doc.text(noticeLines, margin + 5, y + 6);
      y += noticeHeight + 8;
      doc.setTextColor(0, 0, 0);
    }

    // Risk Assessment
    if (hazards.length > 0) {
      checkNewPage(20);
      addText('Risk Assessment', margin, y, { fontSize: 14, fontStyle: 'bold' });
      y += 10;

      hazards.forEach((hazard) => {
        checkNewPage(70);
        
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 60, 3, 3, 'FD');
        
        y += 8;
        addText(hazard.activity, margin + 5, y, { fontSize: 11, fontStyle: 'bold', maxWidth: pageWidth - 2 * margin - 10 });
        y += 8;
        
        doc.setTextColor(100, 100, 100);
        addText('Potential Hazard', margin + 5, y, { fontSize: 8 });
        addText('Who at Risk', margin + 85, y, { fontSize: 8 });
        y += 4;
        doc.setTextColor(0, 0, 0);
        const hazardHeight = addText(hazard.potential_hazard, margin + 5, y, { fontSize: 9, maxWidth: 75 });
        addText(hazard.who_at_risk, margin + 85, y, { fontSize: 9, maxWidth: 75 });
        y += Math.max(hazardHeight, 8);

        y += 4;
        const initialRisk = hazard.initial_likelihood * hazard.initial_severity;
        const residualRisk = hazard.residual_likelihood * hazard.residual_severity;
        
        doc.setTextColor(100, 100, 100);
        addText('Initial Risk:', margin + 5, y, { fontSize: 8 });
        const [ir, ig, ib] = getRiskColorRGB(initialRisk);
        doc.setFillColor(ir, ig, ib);
        doc.setTextColor(255, 255, 255);
        doc.roundedRect(margin + 35, y - 4, 30, 6, 2, 2, 'F');
        addText(`${hazard.initial_likelihood}×${hazard.initial_severity}=${initialRisk}`, margin + 37, y, { fontSize: 8, fontStyle: 'bold' });

        doc.setTextColor(100, 100, 100);
        addText('Residual Risk:', margin + 85, y, { fontSize: 8 });
        const [rr, rg, rb] = getRiskColorRGB(residualRisk);
        doc.setFillColor(rr, rg, rb);
        doc.setTextColor(255, 255, 255);
        doc.roundedRect(margin + 120, y - 4, 30, 6, 2, 2, 'F');
        addText(`${hazard.residual_likelihood}×${hazard.residual_severity}=${residualRisk}`, margin + 122, y, { fontSize: 8, fontStyle: 'bold' });
        
        y += 8;
        doc.setTextColor(100, 100, 100);
        addText('Control Measures', margin + 5, y, { fontSize: 8 });
        y += 4;
        doc.setTextColor(0, 0, 0);
        const cmHeight = addText(hazard.control_measures, margin + 5, y, { fontSize: 9, maxWidth: pageWidth - 2 * margin - 15 });
        y += cmHeight + 5;

        if (hazard.notes) {
          doc.setTextColor(100, 100, 100);
          addText('Notes', margin + 5, y, { fontSize: 8 });
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
      addText('Creator Signature', margin, y, { fontSize: 10, fontStyle: 'bold' });
      y += 8;
      
      try {
        doc.addImage(rams.creator_signature, 'PNG', margin, y, 50, 20);
      } catch (e) {
        // Signature failed
      }
      
      y += 25;
      if (rams.creator_name) {
        addText(rams.creator_name, margin, y, { fontSize: 10, fontStyle: 'bold' });
        y += 5;
      }
      if (rams.signed_at) {
        doc.setTextColor(100, 100, 100);
        addText(`Signed: ${format(new Date(rams.signed_at), "PPP")}`, margin, y, { fontSize: 9 });
      }
    }

    doc.save(`${rams.reference_code}.pdf`);
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <div className="flex justify-end">
        <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Reference Code</Label>
          <p className="font-medium">{rams.reference_code}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Title</Label>
          <p className="font-medium">{rams.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Created Date</Label>
          <p>{format(new Date(rams.created_date), "PPP")}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Review Date</Label>
          <p>{format(new Date(rams.review_date), "PPP")}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        {rams.is_mandatory && <Badge variant="destructive">Mandatory</Badge>}
        {rams.user_types.map(type => (
          <Badge key={type} variant="secondary">{type}</Badge>
        ))}
      </div>

      {rams.applicable_to.length > 0 && (
        <div>
          <Label className="text-muted-foreground">Applicable To</Label>
          <ul className="list-disc list-inside">
            {rams.applicable_to.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {rams.notice_to_drivers && (
        <div>
          <Label className="text-muted-foreground">Notice to Drivers</Label>
          <p className="text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200">
            {rams.notice_to_drivers}
          </p>
        </div>
      )}

      {hazards.length > 0 && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Risk Assessment</Label>
          {hazards.map((hazard, idx) => (
            <Card key={hazard.id} className="p-4">
              <div className="space-y-3">
                <div className="font-medium">{hazard.activity}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Potential Hazard</Label>
                    <p>{hazard.potential_hazard}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Who at Risk</Label>
                    <p>{hazard.who_at_risk}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Initial Risk:</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm font-bold",
                      getRiskColor(hazard.initial_likelihood * hazard.initial_severity)
                    )}>
                      {hazard.initial_likelihood} × {hazard.initial_severity} = {hazard.initial_likelihood * hazard.initial_severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Residual Risk:</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-white text-sm font-bold",
                      getRiskColor(hazard.residual_likelihood * hazard.residual_severity)
                    )}>
                      {hazard.residual_likelihood} × {hazard.residual_severity} = {hazard.residual_likelihood * hazard.residual_severity}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Control Measures</Label>
                  <div 
                    className="text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(hazard.control_measures) }}
                  />
                </div>
                {hazard.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <div 
                      className="text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(hazard.notes) }}
                    />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {rams.creator_signature && (
        <div className="border-t pt-4">
          <Label className="text-muted-foreground">Creator Signature</Label>
          <div className="flex items-end gap-4">
            <img src={rams.creator_signature} alt="Signature" className="max-h-16 border rounded" />
            <div className="text-sm">
              <p className="font-medium">{rams.creator_name}</p>
              {rams.signed_at && <p className="text-muted-foreground">Signed: {format(new Date(rams.signed_at), "PPP")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
