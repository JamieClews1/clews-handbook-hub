import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { useEwcCodes } from "@/hooks/useCodeRegisters";
import { codeMatches } from "@/lib/code-registers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import wm3 from "@/assets/wm3-waste-classification.pdf.asset.json";

const PAGE_SIZE = 50;

export function EwcRegisterSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: codes = [], isLoading, isError, refetch } = useEwcCodes(true);
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("all");
  const [classification, setClassification] = useState("all");
  const [page, setPage] = useState(0);
  const chapters = useMemo(() => [...new Map(codes.map(c => [c.chapter, c.chapter_name])).entries()].sort(), [codes]);
  const filtered = useMemo(() => codes.filter(c =>
    codeMatches(search, c.code, c.description) &&
    (chapter === "all" || c.chapter === chapter) &&
    (classification === "all" || (classification === "hazardous" ? c.hazardous : !c.hazardous))
  ), [codes, search, chapter, classification]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">EWC Code Register</h2>
        <p className="text-sm text-muted-foreground">List of Wastes · six-digit codes grouped by chapter and sub-chapter</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><a href={wm3.url} target="_blank" rel="noopener noreferrer"><BookOpen className="h-4 w-4 mr-2" />WM3 guidance</a></Button>
        {isAdmin && <Button variant="outline" asChild><Link to="/admin/settings?tab=codes"><Settings className="h-4 w-4 mr-2" />Manage codes</Link></Button>}
      </div>
    </div>
    <p className="text-sm text-muted-foreground">An asterisk (*) identifies a hazardous entry. Mirror entries require assessment of the waste’s composition and hazardous properties; a code alone does not establish site acceptance. WM3 reference: supplied edition v1.2.GB, October 2021.</p>
    <div className="flex flex-wrap items-center gap-3">
      <Input aria-label="Search EWC codes" placeholder="Search code or waste description" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-80" />
      <Select value={chapter} onValueChange={v => { setChapter(v); setPage(0); }}>
        <SelectTrigger aria-label="EWC chapter" className="w-full sm:w-80"><SelectValue placeholder="All chapters" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All chapters</SelectItem>{chapters.map(([code, name]) => <SelectItem key={code} value={code}>{code} — {name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={classification} onValueChange={v => { setClassification(v); setPage(0); }}>
        <SelectTrigger aria-label="EWC hazard filter" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All entries</SelectItem><SelectItem value="hazardous">Hazardous entries</SelectItem><SelectItem value="non-hazardous">Non-hazardous entries</SelectItem></SelectContent>
      </Select>
      {!isLoading && !isError && <span className="text-sm text-muted-foreground sm:ml-auto">{filtered.length} of {codes.length} codes</span>}
    </div>
    {isLoading ? <p className="py-8 text-muted-foreground">Loading EWC register…</p> : isError ? <div className="py-8 space-y-3"><p className="text-destructive">Could not load the EWC register.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : <>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3 font-semibold">EWC code</th><th className="p-3 font-semibold">Waste description</th><th className="p-3 font-semibold">Chapter / sub-chapter</th><th className="p-3 font-semibold">Classification</th><th className="p-3 font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-border">{visible.map(c => <tr key={c.id} className="hover:bg-muted/30">
            <td className="p-3 align-top font-mono whitespace-nowrap font-medium">{c.code}{c.hazardous && !c.code.includes("*") ? "*" : ""}</td>
            <td className="p-3 align-top min-w-[240px]"><p>{c.description}</p>{c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}</td>
            <td className="p-3 align-top min-w-[220px] text-muted-foreground"><p>{c.chapter} — {c.chapter_name}</p><p className="mt-1 text-xs">{c.sub_chapter} — {c.sub_chapter_name}</p></td>
            <td className="p-3 align-top"><Badge variant={c.hazardous ? "destructive" : "secondary"}>{c.hazardous ? "Hazardous" : "Non-hazardous"}</Badge></td>
            <td className="p-3 align-top whitespace-nowrap text-muted-foreground">{c.is_active ? "Active" : "Inactive"}{c.is_common && <p className="mt-1 text-xs">Commonly used</p>}</td>
          </tr>)}</tbody>
        </table>
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No EWC codes match these filters.</p>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {pages}</span>
        <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous EWC page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Next EWC page" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
    </>}
  </section>;
}