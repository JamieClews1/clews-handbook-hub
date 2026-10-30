import { normaliseResponse, type RegisterResponse } from "@/lib/public-register-response";
import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Search, ShieldCheck, MapPin, Trash2, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from "lucide-react";
import {
  useVerifiedTippingSites,
  useSaveVerifiedTippingSite,
  useDeleteVerifiedTippingSite,
} from "@/hooks/useVerifiedTippingSites";

type RegisterKey = "waste-operations" | "companies";

export function PublicRegisterSection() {
  const [register, setRegister] = useState<RegisterKey>("waste-operations");
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState("");
  const [facility, setFacility] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data: saved = [], isLoading: savedLoading } = useVerifiedTippingSites();
  const saveSite = useSaveVerifiedTippingSite();
  const deleteSite = useDeleteVerifiedTippingSite();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const usePermit = async (id: string, permit: string) => {
    const { error } = await supabase.from("verified_tipping_sites").update({ registration_number: permit }).eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["verified-tipping-sites"] });
  };

  const search = async (targetPage = 1) => {
    setSearching(true);
    setSearchError(null);
    try {
      const { data, error } = await supabase.functions.invoke("register-lookup", {
        body: { register, q: query, operator: register === "waste-operations" ? operator : "", facility: register === "waste-operations" ? facility : "", page: targetPage },
      });
      if (error) {
        // Non-2xx responses throw; read the real message out of the response body.
        const body = await (error as any)?.context?.json?.().catch(() => null);
        setSearchError(body?.error ?? "Register temporarily unavailable");
        setResult(null);
      } else if (data?.error) {
        setSearchError(data.error);
        setResult(null);
      } else {
        setResult(normaliseResponse(data));
        setPage(targetPage);
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Register temporarily unavailable");
      setResult(null);
    } finally {
      setSearching(false);
    }
  };

  const savedKeys = new Set(saved.map(s => `${s.site_name.trim().toLowerCase()}|${(s.postcode ?? "").trim().toLowerCase()}`));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Public waste register</CardTitle>
          <CardDescription>
            Check the Environment Agency public register before choosing a tipping or transfer site. Saving a site here pins it to the top of the tipping-site choices in RouteOne Waste Out and WeighOne.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Register</Label>
              <Select value={register} onValueChange={(v) => { setRegister(v as RegisterKey); setFacility(""); setResult(null); }}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="waste-operations">Waste operators (sites we go to)</SelectItem>
                  <SelectItem value="companies">Waste carriers (companies)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-52">
              <Label className="text-xs" htmlFor="register-q">{register === "companies" ? "Waste carrier name" : "Site name, town or postcode"}</Label>
              <Input id="register-q" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={register === "companies" ? "Company name or registration — carriers tipping at our site" : "e.g. Ling Hall or Rugby…"}
                onKeyDown={e => { if (e.key === "Enter") search(1); }} />
            </div>
            {register === "waste-operations" && (
              <div className="space-y-1.5 min-w-52">
                <Label className="text-xs" htmlFor="register-operator">Operator (optional)</Label>
                <Input id="register-operator" value={operator} onChange={e => setOperator(e.target.value)}
                  placeholder="e.g. Veolia…"
                  onKeyDown={e => { if (e.key === "Enter") search(1); }} />
              </div>
            )}
            {register === "waste-operations" && (result?.facilityTypes.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Facility type</Label>
                <Select value={facility || "all"} onValueChange={v => setFacility(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All facility types</SelectItem>
                    {result!.facilityTypes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => search(1)} disabled={searching}>
              {searching ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search register
            </Button>
          </div>

          {register === "waste-operations" && (
            <p className="text-xs text-muted-foreground">
              Tip: the register matches one field at a time, so search the <strong>site name or place</strong> (e.g. "Ling Hall") and use <strong>Operator</strong> to narrow to a company (e.g. "Veolia").
            </p>
          )}

          {register === "companies" && (
            <p className="text-xs text-muted-foreground">
              Waste carriers are the companies that bring waste to us — check their registration here. Tipping sites (where we take waste to) live in the <strong>Waste operators</strong> register instead.
            </p>
          )}

          {searchError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span>{searchError}</span>
              <Button variant="outline" size="sm" onClick={() => search(page)}>Retry</Button>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{register === "companies" ? "Company" : "Site"}</TableHead>
                      <TableHead>Registration / permit</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.records.map((r, i) => {
                      const key = `${r.name.trim().toLowerCase()}|${r.postcode.trim().toLowerCase()}`;
                      const already = savedKeys.has(key);
                      return (
                        <TableRow key={`${r.name}-${r.registrationNumber}-${i}`}>
                          <TableCell className="font-medium">
                            {r.name}
                            {r.operator && r.operator !== r.name && <div className="text-xs text-muted-foreground">{r.operator}</div>}
                            {r.address && <div className="text-xs text-muted-foreground whitespace-pre-line">{r.address}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{r.registrationNumber || "—"}</TableCell>
                          <TableCell>{r.facilityType || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.postcode || "—"}</TableCell>
                          <TableCell>{r.status ? <Badge variant="secondary">{r.status}</Badge> : "—"}</TableCell>
                          <TableCell>
                            {register === "companies" ? (
                              <span className="text-xs text-muted-foreground">Carrier</span>
                            ) : already ? (
                              <Badge variant="secondary">Saved</Badge>
                            ) : (
                              <Button size="sm" variant="secondary" disabled={saveSite.isPending}
                                onClick={() => saveSite.mutate({
                                  site_name: r.name,
                                  operator_name: r.operator || null,
                                  registration_number: r.registrationNumber || null,
                                  register,
                                  facility_type: r.facilityType || null,
                                  address: r.address || null,
                                  postcode: r.postcode || null,
                                  status: r.status || null,
                                  notes: null,
                                })}>
                                <MapPin className="h-4 w-4 mr-1" />Save as tipping site
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!result.records.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No matching register entries</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || searching} onClick={() => search(page - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {result.page} of {result.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= result.totalPages || searching} onClick={() => search(page + 1)}>
                    Next<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
              {result.attribution && (
                <p className="text-xs text-muted-foreground border-t pt-2">{result.attribution}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verified tipping sites</CardTitle>
          <CardDescription>Sites checked against the public register. These appear first when choosing tipping locations in RouteOne and WeighOne.</CardDescription>
        </CardHeader>
        <CardContent>
          {savedLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verified sites yet — search the register above and save the sites you tip at.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Registration / permit</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saved.map(s => {
                    const open = openId === s.id;
                    const permits = s.register_details?.permits ?? [];
                    const carriers = s.register_details?.carriers ?? [];
                    return (
                    <Fragment key={s.id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpenId(open ? null : s.id)} aria-expanded={open}>
                      <TableCell className="font-medium">
                        <div className="flex items-start gap-2">
                          <ChevronDown className={`h-4 w-4 mt-0.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
                          <div>
                            {s.site_name}
                            {s.operator_name && <div className="text-xs text-muted-foreground">{s.operator_name}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.registration_number || "—"}</TableCell>
                      <TableCell>{s.facility_type || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.postcode || "—"}</TableCell>
                      <TableCell>{s.status ? <Badge variant="secondary">{s.status}</Badge> : "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" disabled={deleteSite.isPending} onClick={e => { e.stopPropagation(); deleteSite.mutate(s.id); }} aria-label={`Remove ${s.site_name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="space-y-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2 text-sm">
                            <div><div className="text-xs text-muted-foreground">Address</div>{s.address || "—"}</div>
                            <div><div className="text-xs text-muted-foreground">Notes</div>{s.notes || "—"}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">Environmental permits at this postcode</div>
                            {permits.length === 0 ? <p className="text-sm text-muted-foreground">No permits found on the public register for this postcode.</p> : (
                              <div className="space-y-1">
                                {permits.map(p => (
                                  <div key={p.permit_number} className="flex flex-wrap items-center gap-2 text-sm rounded border bg-background px-3 py-2">
                                    <span className="font-mono font-medium">{p.permit_number}</span>
                                    <span>{p.licence_holder}</span>
                                    <span className="text-muted-foreground">· {p.site_name} · {p.facility_type}</span>
                                    {p.status && <Badge variant={p.status === "Effective" ? "secondary" : "outline"}>{p.status}</Badge>}
                                    {p.holder_match && <Badge variant="outline">Likely match</Badge>}
                                    <span className="ml-auto">
                                      {s.registration_number === p.permit_number ? <Badge>In use</Badge> : (
                                        <Button size="sm" variant="outline" onClick={() => usePermit(s.id, p.permit_number)}>Use this permit</Button>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">Waste carrier registrations</div>
                            {carriers.length === 0 ? <p className="text-sm text-muted-foreground">No carrier registration found for this company name.</p> : (
                              <div className="space-y-1">
                                {carriers.map(c => (
                                  <div key={c.registration_number} className="flex flex-wrap gap-2 text-sm rounded border bg-background px-3 py-2">
                                    <span className="font-mono font-medium">{c.registration_number}</span>
                                    <span>{c.business_name}</span>
                                    <span className="text-muted-foreground">· {c.postcode} · {c.company_type} {c.tier ? `(${c.tier} tier)` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.register_checked_at ? `Checked against the Environment Agency public register on ${new Date(s.register_checked_at).toLocaleDateString("en-GB")}.` : "Not yet checked against the public register."} Contains public sector information licensed under the Open Government Licence v3.0.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
