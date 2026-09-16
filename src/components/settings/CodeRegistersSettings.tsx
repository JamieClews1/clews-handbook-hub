import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, StarOff, Trash2 } from "lucide-react";
import { useEwcCodes, useSicCodes } from "@/hooks/useCodeRegisters";
import { codeMatches, normaliseEwcCode, normaliseSicCode } from "@/lib/code-registers";

const EwcRegister = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useEwcCodes(true);
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("all");
  const [hazardOnly, setHazardOnly] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const rows = data ?? [];
  const chapters = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.chapter, r.chapter_name));
    return [...map.entries()].sort();
  }, [rows]);

  const filtered = rows.filter(
    (r) =>
      codeMatches(search, r.code, r.description) &&
      (chapter === "all" || r.chapter === chapter) &&
      (!hazardOnly || r.hazardous),
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["ewc_codes"] });

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("ewc_codes").update(values).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refresh();
  };

  const addCode = async () => {
    const code = normaliseEwcCode(newCode).replace("*", "");
    if (code.replace(/\s/g, "").length !== 6 || !newDesc.trim()) {
      toast({ title: "Check the entry", description: "Enter a six-digit code and a description.", variant: "destructive" });
      return;
    }
    const chapterCode = code.slice(0, 2);
    const sub = code.slice(0, 5);
    const existing = rows.find((r) => r.chapter === chapterCode);
    const { error } = await supabase.from("ewc_codes").insert({
      code,
      description: newDesc.trim(),
      chapter: chapterCode,
      chapter_name: existing?.chapter_name ?? "Locally added",
      sub_chapter: sub,
      sub_chapter_name: rows.find((r) => r.sub_chapter === sub)?.sub_chapter_name ?? "Locally added",
      hazardous: newCode.includes("*"),
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setNewCode("");
      setNewDesc("");
      refresh();
      toast({ title: "Added", description: `${code} added to the register.` });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ewc_codes").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>EWC waste code register</CardTitle>
        <CardDescription>
          The official List of Wastes: 20 chapters, four-digit sub-chapters and six-digit waste codes. Codes marked
          hazardous carry an asterisk. Star the codes your team uses most so they appear first when picking a code on a job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or description"
          />
          <Select value={chapter} onValueChange={setChapter}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">All chapters</SelectItem>
              {chapters.map(([c, name]) => (
                <SelectItem key={c} value={c}>
                  {c} — {name.length > 50 ? `${name.slice(0, 50)}…` : name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={hazardOnly} onCheckedChange={setHazardOnly} />
            <Label className="text-xs">Hazardous only</Label>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length}</span>
        </div>

        <ScrollArea className="h-[520px] rounded-md border border-border">
          <div className="divide-y divide-border">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => patch(r.id, { is_common: !r.is_common })}
                  title={r.is_common ? "Remove from commonly used" : "Mark as commonly used"}
                >
                  {r.is_common ? <Star className="h-4 w-4 text-primary fill-current" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <span className="font-mono text-sm w-24 shrink-0">
                  {r.code}{r.hazardous ? "*" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{r.description}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.sub_chapter} {r.sub_chapter_name}</p>
                </div>
                {r.hazardous && <Badge variant="destructive" className="text-[10px]">Hazardous</Badge>}
                <div className="flex items-center gap-1.5">
                  <Label className="text-[11px] text-muted-foreground">Active</Label>
                  <Switch checked={r.is_active} onCheckedChange={(v) => patch(r.id, { is_active: v })} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <div className="w-40">
            <Label className="text-xs">Code</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="17 09 04" className="font-mono" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Description</Label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="mixed construction and demolition wastes" />
          </div>
          <Button onClick={addCode} className="gap-2">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const SicRegister = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useSicCodes(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const rows = data ?? [];
  const sections = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.section, r.section_name));
    return [...map.entries()].sort();
  }, [rows]);

  const filtered = rows.filter(
    (r) => codeMatches(search, r.code, r.description) && (section === "all" || r.section === section),
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["sic_codes"] });

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("sic_codes").update(values).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refresh();
  };

  const addCode = async () => {
    const code = normaliseSicCode(newCode);
    if (code.length !== 5 || !newDesc.trim()) {
      toast({ title: "Check the entry", description: "Enter a five-digit code and a description.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("sic_codes").insert({
      code,
      description: newDesc.trim(),
      section: rows.find((r) => r.code.slice(0, 2) === code.slice(0, 2))?.section ?? "U",
      section_name: rows.find((r) => r.code.slice(0, 2) === code.slice(0, 2))?.section_name ?? "Locally added",
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setNewCode("");
      setNewDesc("");
      refresh();
      toast({ title: "Added", description: `${code} added to the register.` });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("sic_codes").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SIC industry code register</CardTitle>
        <CardDescription>
          The Companies House condensed SIC 2007 list — five-digit codes grouped into 21 sections, describing the
          business activity that produced the waste. Star the codes you use most so they appear first on a job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or description"
          />
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">All sections</SelectItem>
              {sections.map(([s, name]) => (
                <SelectItem key={s} value={s}>
                  {s} — {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length}</span>
        </div>

        <ScrollArea className="h-[520px] rounded-md border border-border">
          <div className="divide-y divide-border">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => patch(r.id, { is_common: !r.is_common })}
                  title={r.is_common ? "Remove from commonly used" : "Mark as commonly used"}
                >
                  {r.is_common ? <Star className="h-4 w-4 text-primary fill-current" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <span className="font-mono text-sm w-16 shrink-0">{r.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{r.description}</p>
                  <p className="text-[11px] text-muted-foreground truncate">Section {r.section} — {r.section_name}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-[11px] text-muted-foreground">Active</Label>
                  <Switch checked={r.is_active} onCheckedChange={(v) => patch(r.id, { is_active: v })} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <div className="w-40">
            <Label className="text-xs">Code</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="38320" className="font-mono" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Description</Label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Recovery of sorted materials" />
          </div>
          <Button onClick={addCode} className="gap-2">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const CodeRegistersSettings = () => (
  <Tabs defaultValue="ewc" className="space-y-4">
    <TabsList>
      <TabsTrigger value="ewc">EWC waste codes</TabsTrigger>
      <TabsTrigger value="sic">SIC industry codes</TabsTrigger>
    </TabsList>
    <TabsContent value="ewc">
      <EwcRegister />
    </TabsContent>
    <TabsContent value="sic">
      <SicRegister />
    </TabsContent>
  </Tabs>
);
