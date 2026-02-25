import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Percent } from "lucide-react";

const GROUP_COLORS = {
  landfill: "hsl(0, 70%, 50%)",
  rdf: "hsl(35, 85%, 55%)",
  recycled: "hsl(142, 70%, 45%)",
};

interface Props {
  chartData: Array<{
    week: string;
    landfill: number;
    rdf: number;
    recycled: number;
    totalIn: number;
  }>;
  isLoading: boolean;
  viewMode?: "week" | "month" | "total";
}

const ZeroToLandfillPercentChart = ({ chartData, isLoading, viewMode = "week" }: Props) => {
  const pctData = useMemo(() => {
    return chartData.map((d) => {
      const totalOut = d.landfill + d.rdf + d.recycled;
      return {
        week: d.week,
        landfillPct: totalOut > 0 ? Math.round((d.landfill / totalOut) * 10000) / 100 : 0,
        rdfPct: totalOut > 0 ? Math.round((d.rdf / totalOut) * 10000) / 100 : 0,
        recycledPct: totalOut > 0 ? Math.round((d.recycled / totalOut) * 10000) / 100 : 0,
      };
    });
  }, [chartData]);

  const chartConfig = {
    landfillPct: { label: "Landfill %", color: GROUP_COLORS.landfill },
    rdfPct: { label: "RDF %", color: GROUP_COLORS.rdf },
    recycledPct: { label: "Recycled %", color: GROUP_COLORS.recycled },
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Percent className="h-5 w-5 text-primary" />
        </div>
        <div>
          <CardTitle className="text-lg">Zero To Landfill — % Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            {viewMode === "week" ? "Weekly" : viewMode === "month" ? "Monthly" : "Total"} outward waste as percentage of total
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: "1400px" }}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={pctData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    interval={3}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: "% of Outward", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="landfillPct"
                    stroke={GROUP_COLORS.landfill}
                    strokeWidth={2}
                    dot={false}
                    name="Landfill %"
                  />
                  <Line
                    type="monotone"
                    dataKey="rdfPct"
                    stroke={GROUP_COLORS.rdf}
                    strokeWidth={2}
                    dot={false}
                    name="RDF %"
                  />
                  <Line
                    type="monotone"
                    dataKey="recycledPct"
                    stroke={GROUP_COLORS.recycled}
                    strokeWidth={2}
                    dot={false}
                    name="Recycled %"
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ZeroToLandfillPercentChart;
