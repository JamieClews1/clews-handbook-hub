import { useEffect, useMemo, useState } from "react";
import { format, getWeek, getYear, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Download } from "lucide-react";

type RawJob = {
  id: string;
  job_date: string | null;
  customer: string | null;
  movement_type: string | null;
  source: string;
  raw: Record<string, unknown>;
};

type DataSource = "combined" | "skiptrak" | "midweigh";

// Helper to extract total price from raw JSON
const getTotalPrice = (raw: Record<string, unknown> | null): number => {
  if (!raw) return 0;
  const price = raw["Total Price"] ?? raw["TotalPrice"] ?? raw["Price"];
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const parsed = parseFloat(price.replace(/[£,]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Color palette for years
const YEAR_COLORS: Record<number, string> = {
  2022: "hsl(var(--chart-1))",
  2023: "hsl(var(--chart-2))",
  2024: "hsl(var(--chart-3))",
  2025: "hsl(var(--chart-4))",
  2026: "hsl(var(--chart-5))",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Source toggle component
const SourceToggle = ({ 
  value, 
  onChange 
}: { 
  value: DataSource; 
  onChange: (v: DataSource) => void;
}) => (
  <ToggleGroup 
    type="single" 
    value={value} 
    onValueChange={(v) => v && onChange(v as DataSource)}
    className="bg-muted rounded-md p-0.5"
  >
    <ToggleGroupItem value="combined" className="text-xs px-2 py-1 h-7 data-[state=on]:bg-background">
      Combined
    </ToggleGroupItem>
    <ToggleGroupItem value="skiptrak" className="text-xs px-2 py-1 h-7 data-[state=on]:bg-background">
      Skiptrak
    </ToggleGroupItem>
    <ToggleGroupItem value="midweigh" className="text-xs px-2 py-1 h-7 data-[state=on]:bg-background">
      Midweigh
    </ToggleGroupItem>
  </ToggleGroup>
);

const DataHubAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<RawJob[]>([]);

  // State for chart controls
  const currentYear = new Date().getFullYear();
  const [jobsYear, setJobsYear] = useState(currentYear.toString());
  const [incomeYear, setIncomeYear] = useState(currentYear.toString());
  const [showIncomePrevYear, setShowIncomePrevYear] = useState(false);
  const [movementYear, setMovementYear] = useState(currentYear.toString());
  const [topCustomersMonth, setTopCustomersMonth] = useState(format(new Date(), "yyyy-MM"));

  // Source selectors for each chart
  const [revenueSource, setRevenueSource] = useState<DataSource>("combined");
  const [jobsSource, setJobsSource] = useState<DataSource>("combined");
  const [incomeSource, setIncomeSource] = useState<DataSource>("combined");
  const [movementSource, setMovementSource] = useState<DataSource>("combined");
  const [topCustomersSource, setTopCustomersSource] = useState<DataSource>("combined");

  // Filter jobs by source
  const filterBySource = (allJobs: RawJob[], source: DataSource) => {
    if (source === "combined") return allJobs;
    return allJobs.filter((j) => j.source === source);
  };

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    jobs.forEach((j) => {
      if (j.job_date) {
        years.add(getYear(parseISO(j.job_date)));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [jobs]);

  // Fetch ALL jobs (both sources)
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        let allJobs: RawJob[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("data_hub_jobs")
            .select("id, job_date, customer, movement_type, source, raw")
            .order("job_date", { ascending: true })
            .range(offset, offset + limit - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allJobs = [...allJobs, ...(data as RawJob[])];
            offset += limit;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }

        setJobs(allJobs);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  // 1. Annual Revenue by Month - Year on Year Comparison
  const annualRevenueData = useMemo(() => {
    const filteredJobs = filterBySource(jobs, revenueSource);
    const monthlyData: Record<string, Record<number, number>> = {};
    MONTHS.forEach((m) => {
      monthlyData[m] = {};
    });

    filteredJobs.forEach((job) => {
      if (!job.job_date) return;
      const date = parseISO(job.job_date);
      const year = getYear(date);
      const month = MONTHS[date.getMonth()];
      const price = getTotalPrice(job.raw as Record<string, unknown>);
      monthlyData[month][year] = (monthlyData[month][year] || 0) + price;
    });

    return MONTHS.map((month) => ({
      month,
      ...monthlyData[month],
    }));
  }, [jobs, revenueSource]);

  // 2. Jobs by Week for selected year
  const jobsByWeekData = useMemo(() => {
    const filteredJobs = filterBySource(jobs, jobsSource);
    const weeklyJobs: Record<number, number> = {};
    const year = parseInt(jobsYear);

    filteredJobs.forEach((job) => {
      if (!job.job_date) return;
      const date = parseISO(job.job_date);
      if (getYear(date) !== year) return;
      const week = getWeek(date, { weekStartsOn: 1 });
      weeklyJobs[week] = (weeklyJobs[week] || 0) + 1;
    });

    return Array.from({ length: 52 }, (_, i) => ({
      week: `W${i + 1}`,
      jobs: weeklyJobs[i + 1] || 0,
    }));
  }, [jobs, jobsYear, jobsSource]);

  // 3. Income by Week with optional previous year comparison
  const incomeByWeekData = useMemo(() => {
    const filteredJobs = filterBySource(jobs, incomeSource);
    const year = parseInt(incomeYear);
    const prevYear = year - 1;
    const weeklyIncome: Record<number, number> = {};
    const prevYearIncome: Record<number, number> = {};

    filteredJobs.forEach((job) => {
      if (!job.job_date) return;
      const date = parseISO(job.job_date);
      const jobYear = getYear(date);
      const week = getWeek(date, { weekStartsOn: 1 });
      const price = getTotalPrice(job.raw as Record<string, unknown>);

      if (jobYear === year) {
        weeklyIncome[week] = (weeklyIncome[week] || 0) + price;
      } else if (jobYear === prevYear && showIncomePrevYear) {
        prevYearIncome[week] = (prevYearIncome[week] || 0) + price;
      }
    });

    return Array.from({ length: 52 }, (_, i) => ({
      week: `W${i + 1}`,
      [year]: weeklyIncome[i + 1] || 0,
      ...(showIncomePrevYear ? { [prevYear]: prevYearIncome[i + 1] || 0 } : {}),
    }));
  }, [jobs, incomeYear, showIncomePrevYear, incomeSource]);

  // 4. Collections vs Exchanges+Deliveries by Week
  const movementByWeekData = useMemo(() => {
    const filteredJobs = filterBySource(jobs, movementSource);
    const year = parseInt(movementYear);
    const weeklyCollections: Record<number, number> = {};
    const weeklyExchangesDeliveries: Record<number, number> = {};

    filteredJobs.forEach((job) => {
      if (!job.job_date || !job.movement_type) return;
      const date = parseISO(job.job_date);
      if (getYear(date) !== year) return;
      const week = getWeek(date, { weekStartsOn: 1 });
      const mvt = job.movement_type.toLowerCase();

      if (mvt === "collect") {
        weeklyCollections[week] = (weeklyCollections[week] || 0) + 1;
      } else if (mvt === "exchange" || mvt === "deliver") {
        weeklyExchangesDeliveries[week] = (weeklyExchangesDeliveries[week] || 0) + 1;
      }
    });

    return Array.from({ length: 52 }, (_, i) => ({
      week: `W${i + 1}`,
      Collections: weeklyCollections[i + 1] || 0,
      "Exchanges & Deliveries": weeklyExchangesDeliveries[i + 1] || 0,
    }));
  }, [jobs, movementYear, movementSource]);

  // 5. Top 10 Revenue by Customer for selected month
  const topCustomersData = useMemo(() => {
    const filteredJobs = filterBySource(jobs, topCustomersSource);
    const [yearStr, monthStr] = topCustomersMonth.split("-");
    const targetYear = parseInt(yearStr);
    const targetMonth = parseInt(monthStr) - 1; // 0-indexed

    const customerRevenue: Record<string, number> = {};

    filteredJobs.forEach((job) => {
      if (!job.job_date || !job.customer) return;
      const date = parseISO(job.job_date);
      if (getYear(date) !== targetYear || date.getMonth() !== targetMonth) return;
      const price = getTotalPrice(job.raw as Record<string, unknown>);
      customerRevenue[job.customer] = (customerRevenue[job.customer] || 0) + price;
    });

    return Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([customer, revenue]) => ({
        customer: customer.length > 20 ? customer.substring(0, 20) + "..." : customer,
        fullName: customer,
        revenue,
      }));
  }, [jobs, topCustomersMonth, topCustomersSource]);

  // Export helper
  const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // Generate month options for top customers dropdown
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const startYear = 2022;
    const endYear = currentYear;
    for (let y = endYear; y >= startYear; y--) {
      const maxMonth = y === currentYear ? new Date().getMonth() + 1 : 12;
      for (let m = maxMonth; m >= 1; m--) {
        months.push(`${y}-${m.toString().padStart(2, "0")}`);
      }
    }
    return months;
  }, [currentYear]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
        <Skeleton className="h-[400px] w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Annual Revenue by Month - YoY Comparison */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Annual Revenue by Month</CardTitle>
            <CardDescription>Year on Year Comparison (2022-2026)</CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <SourceToggle value={revenueSource} onChange={setRevenueSource} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(annualRevenueData, `annual-revenue-by-month-${revenueSource}`)}
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualRevenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) => [`£${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`, ""]}
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                {availableYears.map((year) => (
                  <Bar
                    key={year}
                    dataKey={year}
                    fill={YEAR_COLORS[year] || "hsl(var(--primary))"}
                    name={year.toString()}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 2. Jobs by Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Jobs by Week</CardTitle>
              <CardDescription>Total job count per week</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SourceToggle value={jobsSource} onChange={setJobsSource} />
              <Select value={jobsYear} onValueChange={setJobsYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(jobsByWeekData, `jobs-by-week-${jobsYear}-${jobsSource}`)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jobsByWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" interval={3} />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="jobs" fill="hsl(var(--primary))" name="Jobs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. Income by Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Income by Week</CardTitle>
              <CardDescription>Weekly revenue with optional YoY comparison</CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <SourceToggle value={incomeSource} onChange={setIncomeSource} />
              <div className="flex items-center gap-2">
                <Switch
                  id="prev-year-toggle"
                  checked={showIncomePrevYear}
                  onCheckedChange={setShowIncomePrevYear}
                />
                <Label htmlFor="prev-year-toggle" className="text-sm">
                  Show {parseInt(incomeYear) - 1}
                </Label>
              </div>
              <Select value={incomeYear} onValueChange={setIncomeYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(incomeByWeekData, `income-by-week-${incomeYear}-${incomeSource}`)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={incomeByWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" interval={3} />
                  <YAxis
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => [`£${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`, ""]}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={parseInt(incomeYear)}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    name={incomeYear}
                  />
                  {showIncomePrevYear && (
                    <Line
                      type="monotone"
                      dataKey={parseInt(incomeYear) - 1}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={(parseInt(incomeYear) - 1).toString()}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Collections vs Exchanges+Deliveries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Collections vs Exchanges & Deliveries</CardTitle>
              <CardDescription>Movement type comparison by week</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SourceToggle value={movementSource} onChange={setMovementSource} />
              <Select value={movementYear} onValueChange={setMovementYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(movementByWeekData, `movements-by-week-${movementYear}-${movementSource}`)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementByWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" interval={3} />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Collections"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Exchanges & Deliveries"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 5. Top 10 Revenue by Customer */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Top 10 Revenue by Customer</CardTitle>
              <CardDescription>Highest revenue customers for the month</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SourceToggle value={topCustomersSource} onChange={setTopCustomersSource} />
              <Select value={topCustomersMonth} onValueChange={setTopCustomersMonth}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {format(parseISO(`${m}-01`), "MMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToExcel(
                    topCustomersData.map((c) => ({ Customer: c.fullName, Revenue: c.revenue })),
                    `top-customers-${topCustomersMonth}-${topCustomersSource}`
                  )
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCustomersData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <YAxis type="category" dataKey="customer" width={120} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [`£${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`, "Revenue"]}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-3))" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataHubAnalytics;
