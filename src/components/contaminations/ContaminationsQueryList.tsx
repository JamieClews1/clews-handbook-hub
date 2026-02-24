import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Search } from "lucide-react";

interface Props {
  onSelectQuery: (id: string) => void;
}

const statusColors: Record<string, string> = {
  query: "bg-red-500",
  actioned: "bg-amber-500",
  complete: "bg-green-500",
  resolved: "bg-muted",
};

const ContaminationsQueryList = ({ onSelectQuery }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const { data: queries = [] } = useQuery({
    queryKey: ["contamination-queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_queries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const owners = [...new Set(queries.map((q) => q.owner_name).filter(Boolean))] as string[];

  const filtered = queries.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (ownerFilter !== "all" && q.owner_name !== ownerFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        q.job_number?.toLowerCase().includes(s) ||
        q.customer?.toLowerCase().includes(s) ||
        q.site?.toLowerCase().includes(s) ||
        q.order_number?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job, customer, site, order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="query">Query</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} queries found</p>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">Status</TableHead>
              <TableHead>Job #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Site</TableHead>
              <TableHead className="hidden lg:table-cell">Order No</TableHead>
              <TableHead className="hidden lg:table-cell">Cost</TableHead>
              <TableHead className="hidden md:table-cell">Owner</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No queries found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q) => (
                <TableRow
                  key={q.id}
                  onClick={() => onSelectQuery(q.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div className={`w-3 h-3 rounded-full ${statusColors[q.status]}`} />
                  </TableCell>
                  <TableCell className="font-medium">{q.job_number}</TableCell>
                  <TableCell>{q.customer}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{q.site}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{q.order_number}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {q.initial_cost != null ? `£${Number(q.initial_cost).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{q.owner_name || "Unassigned"}</TableCell>
                  <TableCell className="text-sm">
                    {q.created_at ? format(new Date(q.created_at), "dd/MM/yy") : ""}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ContaminationsQueryList;
