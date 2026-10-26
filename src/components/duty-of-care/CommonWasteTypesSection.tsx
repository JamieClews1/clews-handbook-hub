import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEwcCodes } from "@/hooks/useCodeRegisters";
import { normaliseEwcCode } from "@/lib/code-registers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = { ewc: string; waste_description: string | null; skiptrak_jobs: number; midweigh_jobs: number; total_jobs: number; tonnes: number; last_date: string | null };

export function CommonWasteTypesSection() {
  const { data: codes = [] } = useEwcCodes(true);
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["common_waste_types", 18],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase.rpc as any)("get_common_waste_types", { _months: 18 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const register = useMemo(() => new Map(codes.map(c => [c.code.replace(/[^0-9]/g, ""), c])), [codes]);
  const rows = data.slice(0, 30);

  return <section className="space-y-3">
    <div>
      <h2 className="text-xl font-semibold">Most common waste types · last 18 months</h2>
      <p className="text-sm text-muted-foreground">Skiptrak and Midweigh jobs grouped by EWC code. Midweigh weights converted from kg to tonnes.</p>
    </div>
    {isLoading ? <p className="py-6 text-muted-foreground">Loading waste activity…</p> : isError ? <div className="py-6 space-y-2"><p className="text-destructive">Could not load waste activity.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> :
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-3 font-semibold">EWC code</th><th className="p-3 font-semibold">Register description</th><th className="p-3 font-semibold">Waste type on jobs</th>
          <th className="p-3 font-semibold text-right">Skiptrak jobs</th><th className="p-3 font-semibold text-right">Midweigh jobs</th><th className="p-3 font-semibold text-right">Total jobs</th><th className="p-3 font-semibold text-right">Tonnes</th>
        </tr></thead>
        <tbody className="divide-y divide-border">{rows.map(r => {
          const digits = r.ewc.replace(/\*/g, "");
          const reg = register.get(digits);
          return <tr key={r.ewc || "none"} className="hover:bg-muted/30">
            <td className="p-3 font-mono font-medium whitespace-nowrap">{r.ewc ? normaliseEwcCode(r.ewc) : "—"}</td>
            <td className="p-3 min-w-[220px]">{reg ? <span>{reg.description} {reg.hazardous && <Badge variant="destructive" className="ml-1">Hazardous</Badge>}</span> : <span className="text-muted-foreground">{r.ewc ? "Not in register — check code" : "No EWC recorded"}</span>}</td>
            <td className="p-3 text-muted-foreground">{r.waste_description || "—"}</td>
            <td className="p-3 text-right tabular-nums">{r.skiptrak_jobs.toLocaleString()}</td>
            <td className="p-3 text-right tabular-nums">{r.midweigh_jobs.toLocaleString()}</td>
            <td className="p-3 text-right tabular-nums font-semibold">{r.total_jobs.toLocaleString()}</td>
            <td className="p-3 text-right tabular-nums">{Number(r.tonnes).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-center text-muted-foreground">No jobs in the last 18 months.</p>}
    </div>}
  </section>;
}
