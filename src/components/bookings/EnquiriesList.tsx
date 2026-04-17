import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Search, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";

type Enquiry = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  user_email: string;
  subject: string;
  message: string;
  urgency: string;
  status: string;
  internal_notes: string | null;
  created_at: string;
};

const STATUSES = ["new", "in_progress", "resolved", "archived"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-300",
  in_progress: "bg-orange-100 text-orange-800 border-orange-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
  archived: "bg-gray-100 text-gray-800 border-gray-300",
};
const URGENCY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-300",
  normal: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-sky-100 text-sky-800 border-sky-300",
};

export const EnquiriesList = () => {
  const { toast } = useToast();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState<Enquiry | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enquiries")
      .select("*")
      .order("created_at", { ascending: false });
    setEnquiries((data ?? []) as Enquiry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateEnquiry = async (id: string, patch: Partial<Enquiry>) => {
    const { error } = await supabase.from("enquiries").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Enquiry updated" });
    fetchData();
    if (viewing && viewing.id === id) {
      setViewing({ ...viewing, ...patch } as Enquiry);
    }
  };

  const deleteEnquiry = async (id: string) => {
    if (!confirm("Delete this enquiry?")) return;
    const { error } = await supabase.from("enquiries").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Enquiry deleted" });
    setViewing(null);
    fetchData();
  };

  const filtered = enquiries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.customer_name.toLowerCase().includes(q) ||
      e.user_email.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = enquiries.filter((e) => e.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <Card
            key={s}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{counts[s]}</p>
              <p className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search enquiries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No enquiries found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Card key={e.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold">{e.customer_name}</span>
                      <Badge variant="outline" className={STATUS_COLORS[e.status]}>
                        {e.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className={URGENCY_COLORS[e.urgency]}>
                        {e.urgency}
                      </Badge>
                    </div>
                    <div className="text-sm text-foreground truncate">{e.subject}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.user_email} · {format(new Date(e.created_at), "dd MMM yyyy HH:mm")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewing(e);
                        setNotesDraft(e.internal_notes || "");
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteEnquiry(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enquiry from {viewing?.customer_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">From</div>
                  <a className="text-primary hover:underline" href={`mailto:${viewing.user_email}`}>
                    {viewing.user_email}
                  </a>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Submitted</div>
                  <div>{format(new Date(viewing.created_at), "dd MMM yyyy HH:mm")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Subject</div>
                  <div>{viewing.subject}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Urgency</div>
                  <Badge variant="outline" className={URGENCY_COLORS[viewing.urgency]}>
                    {viewing.urgency}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm">
                  {viewing.message}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <Select
                    value={viewing.status}
                    onValueChange={(v) => updateEnquiry(viewing.id, { status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Internal notes</div>
                <Textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(ev) => setNotesDraft(ev.target.value)}
                  placeholder="Add internal notes..."
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={() => updateEnquiry(viewing.id, { internal_notes: notesDraft })}
                  >
                    Save notes
                  </Button>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`mailto:${viewing.user_email}?subject=Re: ${encodeURIComponent(viewing.subject)}`)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Reply by email
                </Button>
                <Button variant="ghost" onClick={() => deleteEnquiry(viewing.id)}>
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};