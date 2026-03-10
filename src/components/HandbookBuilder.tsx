import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, FileSignature, Languages } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { HandbookSignaturesList } from "@/components/HandbookSignaturesList";
import { HandbookTranslationSettings } from "@/components/HandbookTranslationSettings";
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

interface Section {
  id: string;
  section_key: string;
  title_en: string;
  title_pl: string | null;
  title_uk: string | null;
  title_ro: string | null;
  display_order: number;
}

interface Subsection {
  id: string;
  section_id: string;
  subsection_key: string;
  title_en: string;
  title_pl: string | null;
  title_uk: string | null;
  title_ro: string | null;
  content_en: string;
  content_pl: string | null;
  content_uk: string | null;
  content_ro: string | null;
  display_order: number;
}

export const HandbookBuilder = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingSubsection, setEditingSubsection] = useState<Subsection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "section" | "subsection"; id: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      fetchSubsections(selectedSection);
    }
  }, [selectedSection]);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from("handbook_sections")
      .select("*")
      .order("display_order");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sections",
        variant: "destructive",
      });
    } else {
      setSections(data || []);
      if (data && data.length > 0 && !selectedSection) {
        setSelectedSection(data[0].id);
      }
    }
  };

  const fetchSubsections = async (sectionId: string) => {
    const { data, error } = await supabase
      .from("handbook_subsections")
      .select("*")
      .eq("section_id", sectionId)
      .order("display_order");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch subsections",
        variant: "destructive",
      });
    } else {
      setSubsections(data || []);
    }
  };

  const handleDeleteSection = async (id: string) => {
    const { error } = await supabase
      .from("handbook_sections")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
      fetchSections();
      if (selectedSection === id) {
        setSelectedSection(null);
      }
    }
  };

  const handleDeleteSubsection = async (id: string) => {
    const { error } = await supabase
      .from("handbook_subsections")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete subsection",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Subsection deleted successfully",
      });
      if (selectedSection) {
        fetchSubsections(selectedSection);
      }
    }
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      if (itemToDelete.type === "section") {
        handleDeleteSection(itemToDelete.id);
      } else {
        handleDeleteSubsection(itemToDelete.id);
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-handbook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Translated ${data.sections} sections and ${data.subsections} subsections`,
        });
        fetchSections();
        if (selectedSection) {
          fetchSubsections(selectedSection);
        }
      } else {
        throw new Error(data.error || "Translation failed");
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to translate content",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Tabs defaultValue="content" className="space-y-6">
      <TabsList>
        <TabsTrigger value="content">Content Management</TabsTrigger>
        <TabsTrigger value="translations" className="gap-2">
          <Languages className="h-4 w-4" />
          Translations
        </TabsTrigger>
        <TabsTrigger value="signatures" className="gap-2">
          <FileSignature className="h-4 w-4" />
          Signatures
        </TabsTrigger>
      </TabsList>

      <TabsContent value="content" className="space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sections List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Sections
                <Button size="sm" onClick={() => setEditingSection({ 
                  id: "", 
                  section_key: "", 
                  title_en: "", 
                  title_pl: null, 
                  title_uk: null, 
                  title_ro: null,
                  display_order: sections.length 
                })}>
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${
                    selectedSection === section.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <span className="font-medium">{section.title_en}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSection(section);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({ type: "section", id: section.id });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Subsections List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Subsections
                {selectedSection && (
                  <Button size="sm" onClick={() => setEditingSubsection({
                    id: "",
                    section_id: selectedSection,
                    subsection_key: "",
                    title_en: "",
                    title_pl: null,
                    title_uk: null,
                    title_ro: null,
                    content_en: "",
                    content_pl: null,
                    content_uk: null,
                    content_ro: null,
                    display_order: subsections.length
                  })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {selectedSection ? "Manage subsections for the selected section" : "Select a section to manage subsections"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {subsections.map((subsection) => (
                <div
                  key={subsection.id}
                  className="p-3 rounded-lg border hover:bg-accent/50 flex items-start justify-between"
                >
                  <div>
                    <h4 className="font-medium">{subsection.title_en}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{subsection.content_en}</p>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSubsection(subsection)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setItemToDelete({ type: "subsection", id: subsection.id });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Edit Section Dialog */}
        {editingSection && (
          <EditSectionDialog
            section={editingSection}
            onClose={() => setEditingSection(null)}
            onSave={() => {
              fetchSections();
              setEditingSection(null);
            }}
          />
        )}

        {/* Edit Subsection Dialog */}
        {editingSubsection && (
          <EditSubsectionDialog
            subsection={editingSubsection}
            onClose={() => setEditingSubsection(null)}
            onSave={() => {
              if (selectedSection) {
                fetchSubsections(selectedSection);
              }
              setEditingSubsection(null);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the {itemToDelete?.type}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>

      <TabsContent value="translations">
        <HandbookTranslationSettings />
      </TabsContent>

      <TabsContent value="signatures">
        <HandbookSignaturesList />
      </TabsContent>
    </Tabs>
  );
};

const EditSectionDialog = ({ section, onClose, onSave }: { section: Section; onClose: () => void; onSave: () => void }) => {
  const [formData, setFormData] = useState(section);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.id) {
      const { error } = await supabase
        .from("handbook_sections")
        .update(formData)
        .eq("id", formData.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update section",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Section updated successfully",
        });
        onSave();
      }
    } else {
      const { error } = await supabase
        .from("handbook_sections")
        .insert([formData]);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create section",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Section created successfully",
        });
        onSave();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{formData.id ? "Edit" : "Create"} Section</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section_key">Section Key</Label>
              <Input
                id="section_key"
                value={formData.section_key}
                onChange={(e) => setFormData({ ...formData, section_key: e.target.value })}
                required
              />
            </div>

            <Tabs defaultValue="en">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="pl">Polish</TabsTrigger>
                <TabsTrigger value="uk">Ukrainian</TabsTrigger>
                <TabsTrigger value="ro">Romanian</TabsTrigger>
              </TabsList>

              <TabsContent value="en" className="space-y-2">
                <Label htmlFor="title_en">Title (English)</Label>
                <Input
                  id="title_en"
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  required
                />
              </TabsContent>

              <TabsContent value="pl" className="space-y-2">
                <Label htmlFor="title_pl">Title (Polish)</Label>
                <Input
                  id="title_pl"
                  value={formData.title_pl || ""}
                  onChange={(e) => setFormData({ ...formData, title_pl: e.target.value || null })}
                />
              </TabsContent>

              <TabsContent value="uk" className="space-y-2">
                <Label htmlFor="title_uk">Title (Ukrainian)</Label>
                <Input
                  id="title_uk"
                  value={formData.title_uk || ""}
                  onChange={(e) => setFormData({ ...formData, title_uk: e.target.value || null })}
                />
              </TabsContent>

              <TabsContent value="ro" className="space-y-2">
                <Label htmlFor="title_ro">Title (Romanian)</Label>
                <Input
                  id="title_ro"
                  value={formData.title_ro || ""}
                  onChange={(e) => setFormData({ ...formData, title_ro: e.target.value || null })}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const EditSubsectionDialog = ({ subsection, onClose, onSave }: { subsection: Subsection; onClose: () => void; onSave: () => void }) => {
  const [formData, setFormData] = useState(subsection);
  const [isSavingAndTranslating, setIsSavingAndTranslating] = useState(false);
  const { toast } = useToast();

  const saveSubsection = async (): Promise<string | null> => {
    if (formData.id) {
      const { error } = await supabase
        .from("handbook_subsections")
        .update(formData)
        .eq("id", formData.id);
      if (error) {
        toast({ title: "Error", description: "Failed to update subsection", variant: "destructive" });
        return null;
      }
      return formData.id;
    } else {
      const { data, error } = await supabase
        .from("handbook_subsections")
        .insert([formData])
        .select("id")
        .single();
      if (error || !data) {
        toast({ title: "Error", description: "Failed to create subsection", variant: "destructive" });
        return null;
      }
      return data.id;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await saveSubsection();
    if (id) {
      toast({ title: "Success", description: "Subsection saved successfully" });
      onSave();
    }
  };

  const handleSaveAndTranslate = async () => {
    setIsSavingAndTranslating(true);
    try {
      const id = await saveSubsection();
      if (!id) return;

      toast({ title: "Saved", description: "Now translating to all languages..." });

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-handbook-section`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ mode: 'selective', subsection_ids: [id] }),
        }
      );

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      // Consume SSE stream to completion
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      toast({ title: "Success", description: "Subsection saved and translated to all languages" });
      onSave();
    } catch (error) {
      toast({
        title: "Translation Error",
        description: error instanceof Error ? error.message : "Failed to translate",
        variant: "destructive",
      });
    } finally {
      setIsSavingAndTranslating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{formData.id ? "Edit" : "Create"} Subsection</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subsection_key">Subsection Key</Label>
              <Input
                id="subsection_key"
                value={formData.subsection_key}
                onChange={(e) => setFormData({ ...formData, subsection_key: e.target.value })}
                required
              />
            </div>

            <Tabs defaultValue="en">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="pl">Polish</TabsTrigger>
                <TabsTrigger value="uk">Ukrainian</TabsTrigger>
                <TabsTrigger value="ro">Romanian</TabsTrigger>
              </TabsList>

              <TabsContent value="en" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title_en">Title (English)</Label>
                  <Input
                    id="title_en"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (English)</Label>
                  <RichTextEditor
                    content={formData.content_en}
                    onChange={(content) => setFormData({ ...formData, content_en: content })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="pl" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title_pl">Title (Polish)</Label>
                  <Input
                    id="title_pl"
                    value={formData.title_pl || ""}
                    onChange={(e) => setFormData({ ...formData, title_pl: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Polish)</Label>
                  <RichTextEditor
                    content={formData.content_pl || ""}
                    onChange={(content) => setFormData({ ...formData, content_pl: content || null })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="uk" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title_uk">Title (Ukrainian)</Label>
                  <Input
                    id="title_uk"
                    value={formData.title_uk || ""}
                    onChange={(e) => setFormData({ ...formData, title_uk: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Ukrainian)</Label>
                  <RichTextEditor
                    content={formData.content_uk || ""}
                    onChange={(content) => setFormData({ ...formData, content_uk: content || null })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="ro" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title_ro">Title (Romanian)</Label>
                  <Input
                    id="title_ro"
                    value={formData.title_ro || ""}
                    onChange={(e) => setFormData({ ...formData, title_ro: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Romanian)</Label>
                  <RichTextEditor
                    content={formData.content_ro || ""}
                    onChange={(content) => setFormData({ ...formData, content_ro: content || null })}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">Save</Button>
              <Button
                type="button"
                onClick={handleSaveAndTranslate}
                disabled={isSavingAndTranslating}
                className="gap-2"
              >
                <Languages className="h-4 w-4" />
                {isSavingAndTranslating ? "Saving & Translating..." : "Save & Translate"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
