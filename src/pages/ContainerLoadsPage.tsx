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
import clewsLogo from "@/assets/clews-logo.png";
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
      return [l.reference, l.customer_name, l.container_number, l.material, l.destination_country]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedId ? (
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleBackToList}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              ) : (
                <Link to="/load-reports">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Load Reports</span>
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Container className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-foreground hidden sm:inline">Container Loads</span>
              </div>
            </div>
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto hidden sm:block" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-screen-2xl mx-auto">
          {selectedId ? (
            <ContainerLoadEditor loadId={selectedId} onBack={handleBackToList} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Boxes className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Container Loads</h1>
                    <p className="text-muted-foreground text-sm">
                      Prep, track and document outgoing export containers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ContainerLoadSettingsDialog />
                  <Button onClick={handleNew} disabled={creating} className="gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    New container load
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search reference, customer, container, material…"
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((l) => {
                    const meta = CONTAINER_STATUS_META[l.status];
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelectedId(l.id)}
                        className="text-left"
                      >
                        <Card className="h-full hover:shadow-md transition-shadow hover:border-primary/40">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-lg">{containerLoadTitle(l)}</span>
                              <Badge variant="outline" className={meta.badgeClass}>
                                {meta.label}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium">
                              {l.customer_name || (
                                <span className="text-muted-foreground italic">Unassigned</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <div>{l.material || "—"}</div>
                              <div className="flex flex-wrap gap-x-3">
                                <span>{l.bale_count} bales</span>
                                {l.container_number && <span>· {l.container_number}</span>}
                                {l.photos.length > 0 && <span>· {l.photos.length} photos</span>}
                              </div>
                              {(l.destination_country || l.export_date) && (
                                <div className="flex flex-wrap gap-x-3 pt-1">
                                  {l.destination_country && <span>{l.destination_country}</span>}
                                  {l.export_date && (
                                    <span>
                                      {new Date(l.export_date).toLocaleDateString("en-GB")}
                                    </span>
                                  )}
                                </div>
                              )}
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
