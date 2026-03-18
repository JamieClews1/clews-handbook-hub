import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Edit, Printer, Eye, EyeOff, Sparkles } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { ToolboxTalkPrintDialog } from "./ToolboxTalkPrintDialog";
import { UserSelector } from "./UserSelector";
import { TranslationSaveDialog, TranslationOption } from "./TranslationSaveDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ToolboxTalk {
  id: string;
  reference_code: string;
  title: string;
  content: string;
  user_types: string[];
  is_mandatory: boolean;
  is_published: boolean;
  created_date: string;
  assigned_users: string[];
}

const USER_TYPES = ["driver", "yard", "office", "management"];

export const ToolboxTalkBuilder = () => {
  const { toast } = useToast();
  const [toolboxTalks, setToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTalk, setEditingTalk] = useState<ToolboxTalk | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedTalkForPrint, setSelectedTalkForPrint] = useState<ToolboxTalk | null>(null);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [pendingSaveTalkId, setPendingSaveTalkId] = useState<string | null>(null);

  // AI Generator state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiUserTypes, setAiUserTypes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [isMandatory, setIsMandatory] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    fetchToolboxTalks();
  }, []);

  const fetchToolboxTalks = async () => {
    try {
      const { data, error } = await supabase
        .from("toolbox_talks")
        .select("*")
        .order("reference_code", { ascending: false });

      if (error) throw error;
      setToolboxTalks(data || []);
    } catch (error) {
      console.error("Error fetching toolbox talks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch toolbox talks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setUserTypes([]);
    setIsMandatory(false);
    setIsPublished(false);
    setAssignedUsers([]);
    setEditingTalk(null);
    setIsCreating(false);
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: "Enter a topic", description: "Please describe what the Toolbox Talk should be about.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-toolbox-talk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ topic: aiTopic, userTypes: aiUserTypes.length > 0 ? aiUserTypes : undefined }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate");
      }
      const result = await response.json();
      setTitle(result.title || "");
      setContent(result.content || "");
      if (aiUserTypes.length > 0) {
        setUserTypes(aiUserTypes.includes("all") ? USER_TYPES : aiUserTypes);
      }
      setShowAiDialog(false);
      setAiTopic("");
      setAiUserTypes([]);
      setIsCreating(true);
      toast({ title: "Generated!", description: "Your AI Toolbox Talk is ready to edit and save." });
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({ title: "Generation failed", description: error.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiUserTypeToggle = (type: string) => {
    if (type === "all") {
      setAiUserTypes(prev => prev.includes("all") ? [] : ["all"]);
      return;
    }
    setAiUserTypes(prev => {
      const filtered = prev.filter(t => t !== "all");
      return filtered.includes(type) ? filtered.filter(t => t !== type) : [...filtered, type];
    });
  };

  const handleEdit = (talk: ToolboxTalk) => {
    setEditingTalk(talk);
    setTitle(talk.title);
    setContent(talk.content);
    setUserTypes(talk.user_types);
    setIsMandatory(talk.is_mandatory);
    setIsPublished(talk.is_published);
    setAssignedUsers(talk.assigned_users || []);
    setIsCreating(true);
  };

  const handleUserTypeToggle = (type: string) => {
    setUserTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSaveClick = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Validation Error",
        description: "Content is required",
        variant: "destructive",
      });
      return;
    }

    // Require either user types or assigned users
    if (userTypes.length === 0 && assignedUsers.length === 0) {
      toast({
        title: "Validation Error",
        description: "Select user types or assign specific users",
        variant: "destructive",
      });
      return;
    }

    setShowTranslationDialog(true);
  };

  const handleSaveWithTranslation = async (translationOption: TranslationOption) => {
    try {
      let savedTalkId: string;

      if (editingTalk) {
        const { error } = await supabase
          .from("toolbox_talks")
          .update({
            title,
            content,
            user_types: userTypes,
            is_mandatory: isMandatory,
            is_published: isPublished,
            assigned_users: assignedUsers,
          })
          .eq("id", editingTalk.id);

        if (error) throw error;
        savedTalkId = editingTalk.id;
      } else {
        // Generate next reference code
        const { data: lastTalk } = await supabase
          .from("toolbox_talks")
          .select("reference_code")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextNumber = 1;
        if (lastTalk?.reference_code) {
          const match = lastTalk.reference_code.match(/TBT-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }

        const { data, error } = await supabase.from("toolbox_talks").insert({
          reference_code: `TBT-${nextNumber}`,
          title,
          content,
          user_types: userTypes,
          is_mandatory: isMandatory,
          is_published: isPublished,
          assigned_users: assignedUsers,
        }).select().single();

        if (error) throw error;
        savedTalkId = data.id;
      }

      // Translate if requested
      if (translationOption === "all") {
        setIsTranslating(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-toolbox-talk`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ toolbox_talk_id: savedTalkId }),
            }
          );
          const result = await response.json();
          if (result.success) {
            toast({
              title: "Success",
              description: "Toolbox Talk saved and translated successfully",
            });
          } else {
            toast({
              title: "Warning",
              description: "Toolbox Talk saved but translation failed",
              variant: "destructive",
            });
          }
        } catch (translateError) {
          console.error("Translation error:", translateError);
          toast({
            title: "Warning",
            description: "Toolbox Talk saved but translation failed",
            variant: "destructive",
          });
        } finally {
          setIsTranslating(false);
        }
      } else {
        toast({
          title: "Success",
          description: editingTalk ? "Toolbox Talk updated successfully" : "Toolbox Talk created successfully",
        });
      }

      setShowTranslationDialog(false);
      resetForm();
      fetchToolboxTalks();
    } catch (error) {
      console.error("Error saving toolbox talk:", error);
      toast({
        title: "Error",
        description: "Failed to save toolbox talk",
        variant: "destructive",
      });
      setShowTranslationDialog(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Toolbox Talk?")) return;

    try {
      const { error } = await supabase.from("toolbox_talks").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Toolbox Talk deleted successfully",
      });
      fetchToolboxTalks();
    } catch (error) {
      console.error("Error deleting toolbox talk:", error);
      toast({
        title: "Error",
        description: "Failed to delete toolbox talk",
        variant: "destructive",
      });
    }
  };

  const handlePrint = (talk: ToolboxTalk) => {
    setSelectedTalkForPrint(talk);
    setPrintDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingTalk ? "Edit Toolbox Talk" : "Create Toolbox Talk"}
          </h3>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter toolbox talk title"
            />
          </div>

          <div>
            <Label>Content</Label>
            <RichTextEditor content={content} onChange={setContent} />
          </div>

          <div>
            <Label>User Types</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {USER_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={userTypes.includes(type) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUserTypeToggle(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <UserSelector
            selectedUsers={assignedUsers}
            onSelectionChange={setAssignedUsers}
            label="Assign Specific Users (optional)"
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="mandatory"
                checked={isMandatory}
                onCheckedChange={setIsMandatory}
              />
              <Label htmlFor="mandatory">Mandatory</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label htmlFor="published">Published</Label>
            </div>
          </div>

          <Button onClick={handleSaveClick} className="gap-2">
            <Save className="h-4 w-4" />
            {editingTalk ? "Update" : "Create"} Toolbox Talk
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Toolbox Talks ({toolboxTalks.length})</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAiDialog(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Toolbox Talk
          </Button>
        </div>
      </div>

      {toolboxTalks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No toolbox talks created yet. Click "Create Toolbox Talk" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {toolboxTalks.map((talk) => (
            <Card key={talk.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      <span className="text-muted-foreground font-normal">{talk.reference_code}</span> - {talk.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {talk.user_types.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full capitalize"
                        >
                          {type}
                        </span>
                      ))}
                      {talk.is_mandatory && (
                        <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full">
                          Mandatory
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${talk.is_published ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                        {talk.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePrint(talk)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(talk)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(talk.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(talk.created_date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ToolboxTalkPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        toolboxTalk={selectedTalkForPrint}
      />

      <TranslationSaveDialog
        open={showTranslationDialog}
        onOpenChange={setShowTranslationDialog}
        onConfirm={handleSaveWithTranslation}
        isTranslating={isTranslating}
        documentType="Toolbox Talk"
        isNew={!editingTalk}
      />
    </div>
  );
};
