import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit } from "lucide-react";
import { HandbookSignaturesList } from "@/components/HandbookSignaturesList";
import { HRContactSettings } from "@/components/HRContactSettings";
import { UserManagement } from "@/components/UserManagement";
import { RAMSBuilder } from "@/components/RAMSBuilder";
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

export const AdminContent = () => {
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CMS Admin Panel</h1>
        <p className="text-muted-foreground">Manage handbook sections and content in all languages</p>
      </div>

      <Tabs defaultValue="handbook" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="handbook">Handbook Builder</TabsTrigger>
          <TabsTrigger value="rams">RAMS Builder</TabsTrigger>
          <TabsTrigger value="hr-contact">HR Contact</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="handbook" className="space-y-6">
          <Tabs defaultValue="content" className="space-y-4">
            <TabsList>
              <TabsTrigger value="content">Content Management</TabsTrigger>
              <TabsTrigger value="signatures">Signatures</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6">
              <div className="flex justify-end">
                <Button
              onClick={handleTranslate} 
              disabled={isTranslating}
              size="lg"
            >
              {isTranslating ? "Translating..." : "Translate All Content"}
            </Button>
          </div>

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

            <TabsContent value="signatures">
              <HandbookSignaturesList />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="rams">
          <RAMSBuilder />
        </TabsContent>

        <TabsContent value="hr-contact">
          <HRContactSettings />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
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
                <Label>Title (English)</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  required
                />
              </TabsContent>

              <TabsContent value="pl" className="space-y-2">
                <Label>Title (Polish)</Label>
                <Input
                  value={formData.title_pl || ""}
                  onChange={(e) => setFormData({ ...formData, title_pl: e.target.value })}
                />
              </TabsContent>

              <TabsContent value="uk" className="space-y-2">
                <Label>Title (Ukrainian)</Label>
                <Input
                  value={formData.title_uk || ""}
                  onChange={(e) => setFormData({ ...formData, title_uk: e.target.value })}
                />
              </TabsContent>

              <TabsContent value="ro" className="space-y-2">
                <Label>Title (Romanian)</Label>
                <Input
                  value={formData.title_ro || ""}
                  onChange={(e) => setFormData({ ...formData, title_ro: e.target.value })}
                />
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.id) {
      const { error } = await supabase
        .from("handbook_subsections")
        .update(formData)
        .eq("id", formData.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update subsection",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Subsection updated successfully",
        });
        onSave();
      }
    } else {
      const { error } = await supabase
        .from("handbook_subsections")
        .insert([formData]);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create subsection",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Subsection created successfully",
        });
        onSave();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <TabsContent value="en" className="space-y-2">
                <Label>Title (English)</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  required
                />
                <Label>Content (English)</Label>
                <Textarea
                  value={formData.content_en}
                  onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                  rows={6}
                  required
                />
              </TabsContent>

              <TabsContent value="pl" className="space-y-2">
                <Label>Title (Polish)</Label>
                <Input
                  value={formData.title_pl || ""}
                  onChange={(e) => setFormData({ ...formData, title_pl: e.target.value })}
                />
                <Label>Content (Polish)</Label>
                <Textarea
                  value={formData.content_pl || ""}
                  onChange={(e) => setFormData({ ...formData, content_pl: e.target.value })}
                  rows={6}
                />
              </TabsContent>

              <TabsContent value="uk" className="space-y-2">
                <Label>Title (Ukrainian)</Label>
                <Input
                  value={formData.title_uk || ""}
                  onChange={(e) => setFormData({ ...formData, title_uk: e.target.value })}
                />
                <Label>Content (Ukrainian)</Label>
                <Textarea
                  value={formData.content_uk || ""}
                  onChange={(e) => setFormData({ ...formData, content_uk: e.target.value })}
                  rows={6}
                />
              </TabsContent>

              <TabsContent value="ro" className="space-y-2">
                <Label>Title (Romanian)</Label>
                <Input
                  value={formData.title_ro || ""}
                  onChange={(e) => setFormData({ ...formData, title_ro: e.target.value })}
                />
                <Label>Content (Romanian)</Label>
                <Textarea
                  value={formData.content_ro || ""}
                  onChange={(e) => setFormData({ ...formData, content_ro: e.target.value })}
                  rows={6}
                />
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
