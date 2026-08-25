import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_WTN_TEMPLATE,
  SAMPLE_WTN_VARS,
  WTN_PLACEHOLDERS,
  renderWtnSheet,
} from "@/lib/wtn-ticket-template";

/** Load the active WTN design (falls back to the built-in default). */
export function useWtnTemplate() {
  return useQuery({
    queryKey: ["wtn-ticket-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wtn_ticket_templates")
        .select("id, name, html")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as { id: string; name: string; html: string } | undefined) ?? null;
    },
  });
}

export const WtnTemplateEditor = () => {
  const queryClient = useQueryClient();
  const { data: tpl, isLoading } = useWtnTemplate();
  const [html, setHtml] = useState(DEFAULT_WTN_TEMPLATE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tpl?.html) setHtml(tpl.html);
  }, [tpl?.html]);

  const preview = useMemo(() => renderWtnSheet(html, SAMPLE_WTN_VARS), [html]);

  const save = async () => {
    setSaving(true);
    try {
      if (tpl?.id) {
        const { error } = await supabase.from("wtn_ticket_templates").update({ html }).eq("id", tpl.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wtn_ticket_templates")
          .insert({ name: "Default", html, is_active: true });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["wtn-ticket-template"] });
      toast.success("Waste transfer note design saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const printPreview = () => {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(preview);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Design (one half of the A4 sheet)</p>
          <p className="text-xs text-muted-foreground">
            This block is printed twice: the top half is the customer copy, the bottom half is retained by
            Clews Recycling. Use the placeholders below — they are filled from the weighbridge ticket.
          </p>
        </div>
        <Textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs h-[52vh]"
          disabled={isLoading}
        />
        <div className="flex flex-wrap gap-1">
          {WTN_PLACEHOLDERS.map((p) => (
            <Badge
              key={p.key}
              variant="outline"
              title={p.label}
              className="cursor-pointer font-mono text-[10px]"
              onClick={() => {
                navigator.clipboard?.writeText(`{{${p.key}}}`);
                toast.success(`Copied {{${p.key}}}`);
              }}
            >
              {`{{${p.key}}}`}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save design"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setHtml(DEFAULT_WTN_TEMPLATE)}>
            <RotateCcw className="h-4 w-4" /> Reset to default
          </Button>
          <Button variant="outline" className="gap-2" onClick={printPreview}>
            <Printer className="h-4 w-4" /> Print preview
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Live preview (A4)</p>
        <iframe
          title="WTN preview"
          srcDoc={preview}
          className="w-full h-[70vh] border border-border rounded-md bg-white"
        />
      </div>
    </div>
  );
};

export default WtnTemplateEditor;
