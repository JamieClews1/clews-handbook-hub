import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSpreadsheet, Download, AlertCircle, ChevronsUpDown, Check, CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// Available fields from data_hub_jobs for grouping
const AVAILABLE_FIELDS = [
  { key: "waste_description", label: "Waste Description" },
  { key: "site", label: "Site" },
  { key: "container_type", label: "Container Type" },
  { key: "category", label: "Category" },
  { key: "ewc", label: "EWC Code" },
  { key: "job_type", label: "Job Type" },
  { key: "job_number", label: "Job Number" },
  { key: "movement_type", label: "Movement Type" },
  { key: "vehicle_registration", label: "Vehicle Reg" },
  { key: "source", label: "Source" },
  { key: "order_number_override", label: "Order Number" },
  { key: "job_date", label: "Job Date" },
] as const;

type DataSourceFilter = "combined" | "skiptrak" | "midweigh";

type FieldKey = typeof AVAILABLE_FIELDS[number]["key"];

interface BreakdownRow {
  [key: string]: string | number | null;
  totalWeightT: number;
  jobCount: number;
}

export const DataHubCustomerReport = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(["waste_description"]);
  const [dataSource, setDataSource] = useState<DataSourceFilter>("combined");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Fetch unique customer names from data_hub_jobs (handling pagination for large datasets)
  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["data-hub-customers"],
    queryFn: async () => {
      const allCustomers: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("customer")
          .not("customer", "is", null)
          .order("customer")
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          const customers = data.map((d) => d.customer).filter(Boolean) as string[];
          allCustomers.push(...customers);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Get unique customer names and sort
      const uniqueCustomers = [...new Set(allCustomers)].sort();
      return uniqueCustomers;
    },
  });

  const periodStart = startDate;
  const periodEnd = endDate;

  // Fetch jobs for selected customer and period (handling pagination)
  const { data: jobsData, isLoading: loadingJobs, refetch } = useQuery({
    queryKey: ["data-hub-customer-report", selectedCustomer, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), dataSource],
    queryFn: async () => {
      if (!selectedCustomer) return null;

      const allJobs: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("data_hub_jobs")
          .select("*")
          .eq("customer", selectedCustomer)
          .gte("job_date", format(periodStart, "yyyy-MM-dd"))
          .lte("job_date", format(periodEnd, "yyyy-MM-dd"));

        if (dataSource !== "combined") {
          query = query.eq("source", dataSource);
        }

        const { data, error } = await query
          .order("job_date", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allJobs.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allJobs;
    },
    enabled: !!selectedCustomer,
  });

  // Calculate breakdown based on selected fields
  const breakdown = useMemo<BreakdownRow[]>(() => {
    if (!jobsData || jobsData.length === 0) return [];

    const breakdownMap = new Map<string, BreakdownRow>();

    for (const job of jobsData) {
      // Create composite key from all selected fields
      const keyParts = selectedFields.map((field) => String(job[field] || "Unknown"));
      const compositeKey = keyParts.join("|||");

      const existing = breakdownMap.get(compositeKey) || {
        ...Object.fromEntries(selectedFields.map((field) => [field, job[field] || "Unknown"])),
        totalWeightT: 0,
        jobCount: 0,
      };

      existing.totalWeightT += job.weight_t || 0;
      existing.jobCount += 1;
      breakdownMap.set(compositeKey, existing);
    }

    return Array.from(breakdownMap.values()).sort(
      (a, b) => b.totalWeightT - a.totalWeightT
    );
  }, [jobsData, selectedFields]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!breakdown.length) return { totalWeightT: 0, totalJobs: 0 };
    return {
      totalWeightT: breakdown.reduce((sum, w) => sum + w.totalWeightT, 0),
      totalJobs: breakdown.reduce((sum, w) => sum + w.jobCount, 0),
    };
  }, [breakdown]);

  // Quick period presets
  const applyPreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "this-month":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "last-month":
        setStartDate(startOfMonth(subMonths(now, 1)));
        setEndDate(endOfMonth(subMonths(now, 1)));
        break;
      case "last-3":
        setStartDate(startOfMonth(subMonths(now, 2)));
        setEndDate(endOfMonth(now));
        break;
      case "last-6":
        setStartDate(startOfMonth(subMonths(now, 5)));
        setEndDate(endOfMonth(now));
        break;
      case "last-12":
        setStartDate(startOfMonth(subMonths(now, 11)));
        setEndDate(endOfMonth(now));
        break;
      case "ytd":
        setStartDate(startOfYear(now));
        setEndDate(endOfMonth(now));
        break;
    }
  };

  // Toggle field selection
  const toggleField = (field: FieldKey) => {
    setSelectedFields((prev) => {
      if (prev.includes(field)) {
        // Don't allow removing the last field
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  };

  // Export to Excel
  const handleExport = () => {
    if (!breakdown.length || !selectedCustomer) return;

    const fieldLabels = selectedFields.map(
      (f) => AVAILABLE_FIELDS.find((af) => af.key === f)?.label || f
    );

    const exportData = breakdown.map((row) => {
      const rowData: Record<string, string | number> = {};
      selectedFields.forEach((field, idx) => {
        rowData[fieldLabels[idx]] = String(row[field] || "");
      });
      rowData["Weight (t)"] = Number(row.totalWeightT.toFixed(3));
      rowData["Job Count"] = row.jobCount;
      return rowData;
    });

    // Add totals row
    const totalsRow: Record<string, string | number> = {};
    fieldLabels.forEach((label, idx) => {
      totalsRow[label] = idx === 0 ? "TOTAL" : "";
    });
    totalsRow["Weight (t)"] = Number(totals.totalWeightT.toFixed(3));
    totalsRow["Job Count"] = totals.totalJobs;
    exportData.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Waste Breakdown");

    // Add summary sheet
    const summaryData = [
      { Field: "Customer", Value: selectedCustomer },
      { Field: "Period", Value: `${format(periodStart, "dd/MM/yyyy")} - ${format(periodEnd, "dd/MM/yyyy")}` },
      { Field: "Grouped By", Value: fieldLabels.join(", ") },
      { Field: "Total Weight (t)", Value: totals.totalWeightT.toFixed(3) },
      { Field: "Total Jobs", Value: totals.totalJobs },
      { Field: "Generated", Value: format(new Date(), "dd/MM/yyyy HH:mm") },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    const fileName = `DataHub_${selectedCustomer.replace(/[^a-zA-Z0-9]/g, "_")}_${format(periodStart, "yyyy-MM-dd")}_to_${format(periodEnd, "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Searchable Customer Selection */}
        <div className="space-y-2">
          <Label>Data Hub Customer</Label>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={customerOpen}
                className="w-full justify-between h-10 font-normal"
              >
                {selectedCustomer || "Select customer..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search customers..." />
                <CommandList>
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandGroup>
                    {loadingCustomers ? (
                      <div className="p-2 text-center text-muted-foreground">
                        Loading...
                      </div>
                    ) : (
                      customers?.map((customer) => (
                        <CommandItem
                          key={customer}
                          value={customer}
                          onSelect={() => {
                            setSelectedCustomer(customer);
                            setCustomerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === customer ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {customer}
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Range Selection */}
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => d && setStartDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => d && setEndDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Data Source Selection */}
        <div className="space-y-2">
          <Label>Data Source</Label>
          <Select value={dataSource} onValueChange={(v) => setDataSource(v as DataSourceFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="combined">Combined</SelectItem>
              <SelectItem value="skiptrak">Skiptrak</SelectItem>
              <SelectItem value="midweigh">Midweigh</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Field Selection */}
        <div className="space-y-2">
          <Label>Group By Fields</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 font-normal">
                {selectedFields.length} field(s) selected
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-2" align="start">
              <div className="space-y-2">
                {AVAILABLE_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <label
                      htmlFor={field.key}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {field.label}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {selectedFields.map((f) => AVAILABLE_FIELDS.find((af) => af.key === f)?.label).join(", ")}
          </p>
        </div>
      </div>

      {/* Quick Period Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center mr-1">Quick select:</span>
        {[
          { label: "YTD", value: "ytd" },
          { label: "This Month", value: "this-month" },
          { label: "Last Month", value: "last-month" },
          { label: "Last 3 Months", value: "last-3" },
          { label: "Last 6 Months", value: "last-6" },
          { label: "Last 12 Months", value: "last-12" },
        ].map((preset) => (
          <Button key={preset.value} variant="outline" size="sm" onClick={() => applyPreset(preset.value)}>
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Results */}
      {selectedCustomer && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedCustomer} - {format(periodStart, "dd/MM/yyyy")} to {format(periodEnd, "dd/MM/yyyy")}
              </CardTitle>
              <CardDescription>
                Waste breakdown from Data Hub records
              </CardDescription>
            </div>
            {breakdown.length > 0 && (
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : breakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>No records found for this customer in the selected period</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Weight</p>
                    <p className="text-2xl font-bold">{totals.totalWeightT.toFixed(2)}t</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                    <p className="text-2xl font-bold">{totals.totalJobs}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Unique Rows</p>
                    <p className="text-2xl font-bold">{breakdown.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Avg Weight/Job</p>
                    <p className="text-2xl font-bold">
                      {totals.totalJobs > 0
                        ? (totals.totalWeightT / totals.totalJobs).toFixed(3)
                        : "0"}
                      t
                    </p>
                  </div>
                </div>

                {/* Breakdown Table */}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectedFields.map((field) => (
                          <TableHead key={field}>
                            {AVAILABLE_FIELDS.find((f) => f.key === field)?.label || field}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Weight (t)</TableHead>
                        <TableHead className="text-right">Jobs</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          {selectedFields.map((field) => (
                            <TableCell key={field} className="font-medium">
                              {String(item[field] || "-")}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono">
                            {item.totalWeightT.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.jobCount}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {totals.totalWeightT > 0
                              ? ((item.totalWeightT / totals.totalWeightT) * 100).toFixed(1)
                              : "0"}
                            %
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        {selectedFields.slice(1).map((field) => (
                          <TableCell key={field}></TableCell>
                        ))}
                        <TableCell className="text-right font-mono">
                          {totals.totalWeightT.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {totals.totalJobs}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCustomer && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Select a customer from Data Hub to generate a report
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This allows reporting on customers that haven't been set up in the system yet
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
