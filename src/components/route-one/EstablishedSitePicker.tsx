import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { MapPin, Search, Plus } from "lucide-react";
import type { BookingSite } from "@/lib/route-booking-sites";

export function EstablishedSitePicker({ sites, value, onSelect, onNew }: { sites: BookingSite[]; value: string; onSelect: (site: BookingSite) => void; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const matches = sites.filter(site => [site.name, site.address, site.postcode].some(v => v?.toLowerCase().includes(search.toLowerCase().trim())));
  return <>
    <Button type="button" variant="outline" className="w-full justify-start h-auto min-h-10 text-left whitespace-normal" aria-label="Established site" onClick={() => { setSearch(""); setOpen(true); }}><MapPin className="h-4 w-4 mr-2 shrink-0" />{value || `Select site (${sites.length})`}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader><DialogTitle>Established customer sites</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input aria-label="Search established sites" placeholder="Search site, address or postcode" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="overflow-auto min-h-0"><Table><TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Full address</TableHead><TableHead>Postcode</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {matches.map(site => <TableRow key={site.name} className={site.name === value ? "bg-accent" : ""}><TableCell className="font-medium">{site.name}</TableCell><TableCell className="whitespace-pre-line">{site.address || "Not recorded"}</TableCell><TableCell className="whitespace-nowrap">{site.postcode || "—"}</TableCell><TableCell><Button type="button" variant="secondary" size="sm" onClick={() => { onSelect(site); setOpen(false); }}>Select</Button></TableCell></TableRow>)}
          {!matches.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No matching sites</TableCell></TableRow>}
        </TableBody></Table></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => { setOpen(false); onNew(); }}><Plus className="h-4 w-4 mr-2" />New site</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}