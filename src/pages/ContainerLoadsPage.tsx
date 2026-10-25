import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Container, Plus, Loader2, Search, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/components/PageHeading";
import {
  ContainerLoad,
  ContainerStatus,
  CONTAINER_STATUS_META,
  CONTAINER_STATUS_ORDER,
  containerLoadTitle,
  normalizeContainerLoad,
} from "@/lib/container-loads";
import { ContainerLoadEditor } from "@/components/container-loads/ContainerLoadEditor";
import { ContainerLoadSettingsDialog } from "@/components/container-loads/ContainerLoadSettingsDialog";

const ContainerLoadsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loads, setLoads] = useState<ContainerLoad[]>([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ContainerStatus | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const fetchLoads = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("container_loads")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (!error && data) setLoads(data.map(normalizeContainerLoad));
    setFetching(false);
  };

  useEffect(() => {
    if (user) fetchLoads();
  }, [user]);

  // Support deep-link ?new=1 from the Load Reports "Container" tile
  useEffect(() => {
    if (user && searchParams.get("new") === "1") {
      setSearchParams({}, { replace: true });
      handleNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  const handleNew = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const { data, error } = await supabase
        .from("container_loads")
        .insert({
          status: "prepping",
          created_by: user.id,
          operator_name: profile?.full_name ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      await fetchLoads();
      setSelectedId(data.id);
    } catch (e: any) {
      toast({ title: "Could not create load", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleBackToList = () => {
    setSelectedId(null);
    fetchLoads();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const filtered = loads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return [l.load_name, l.booking_reference, l.reference, l.customer_name, l.container_number, l.material, l.destination_country]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-screen-2xl mx-auto">
          {selectedId ? (
            <ContainerLoadEditor loadId={selectedId} onBack={handleBackToList} />
          ) : (
            <>
              <PageHeading title="Container Loads" description="Outgoing export containers" actions={
                <div className="flex items-center gap-2">
                  <ContainerLoadSettingsDialog />
                  <Button onClick={handleNew} disabled={creating} className="gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    New container load
                  </Button>
                </div>
              } />

              <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer reference, customer, container, material…"
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {CONTAINER_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CONTAINER_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fetching ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Container className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>No container loads yet.</p>
                    <Button onClick={handleNew} variant="outline" className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Create the first one
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((l) => {
                    const meta = CONTAINER_STATUS_META[l.status];
                    const materials = l.material
                      ? l.material.split(",").map((m) => m.trim()).filter(Boolean)
                      : [];
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelectedId(l.id)}
                        className="text-left w-full"
                      >
                        <Card className="hover:shadow-md transition-shadow hover:border-primary/40">
                          <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                            <div className="min-w-[180px]">
                              <div className="font-bold text-lg">{containerLoadTitle(l)}</div>
                              <div className="text-sm font-medium">
                                {l.customer_name || (
                                  <span className="text-muted-foreground italic">Unassigned</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-[240px] space-y-1">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Material
                                </span>
                                {materials.length > 0 ? (
                                  materials.map((m) => (
                                    <Badge key={m} variant="outline" className="font-medium">
                                      {m}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">Not set</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                                <span>{l.bale_count} bales</span>
                                {l.container_number && <span>· {l.container_number}</span>}
                                {l.photos.length > 0 && <span>· {l.photos.length} photos</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className={meta.badgeClass}>
                                {meta.label}
                              </Badge>
                              <div className="flex flex-wrap justify-end gap-x-3 text-sm text-muted-foreground">
                                {l.destination_country && <span>{l.destination_country}</span>}
                                {l.export_date && (
                                  <span>{new Date(l.export_date).toLocaleDateString("en-GB")}</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContainerLoadsPage;
