import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface PeriodOption {
  id: string;
  label: string;
  from: Date;
  to: Date;
}

interface ReportingPeriodQuickSelectProps {
  /** Filter periods to a specific customer (by customers.id). */
  customerId?: string;
  /** Filter periods to a customer matched by customer_name or data_hub_customer. */
  customerName?: string;
  /** Show periods across all customers that have custom reporting periods enabled. */
  allCustomers?: boolean;
  /** Called when a period is chosen, with the computed start/end dates. */
  onSelect: (from: Date, to: Date) => void;
  label?: string;
  className?: string;
}

/**
 * Quick-select dropdown for customer custom reporting periods (e.g. Biffa).
 * Renders nothing when there are no matching custom periods.
 */
export function ReportingPeriodQuickSelect({
  customerId,
  customerName,
  allCustomers,
  onSelect,
  label = "Reporting Period",
  className,
}: ReportingPeriodQuickSelectProps) {
  const [options, setOptions] = useState<PeriodOption[]>([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, customer_name, data_hub_customer, custom_reporting_periods_enabled")
        .eq("custom_reporting_periods_enabled", true);

      let targetCustomers = custs ?? [];

      if (customerId) {
        targetCustomers = targetCustomers.filter((c) => c.id === customerId);
      } else if (customerName) {
        const n = customerName.trim().toLowerCase();
        targetCustomers = targetCustomers.filter(
          (c) =>
            c.customer_name?.toLowerCase() === n ||
            c.data_hub_customer?.toLowerCase() === n,
        );
      }
      // else: allCustomers — keep all enabled customers

      if (targetCustomers.length === 0) {
        if (active) setOptions([]);
        return;
      }

      const ids = targetCustomers.map((c) => c.id);
      const { data: periods } = await supabase
        .from("customer_reporting_periods")
        .select("*")
        .in("customer_id", ids)
        .order("display_order");

      const multi = targetCustomers.length > 1;
      const opts: PeriodOption[] = [];

      for (const c of targetCustomers) {
        const cp = (periods ?? []).filter((p) => p.customer_id === c.id);
        cp.forEach((p, idx) => {
          const end = new Date(p.period_end_date + "T00:00:00");
          let start: Date;
          if (idx > 0) {
            const prevEnd = new Date(cp[idx - 1].period_end_date + "T00:00:00");
            start = new Date(prevEnd);
            start.setDate(start.getDate() + 1);
          } else {
            start = startOfMonth(end);
          }
          opts.push({
            id: p.id,
            label: `${multi ? `${c.customer_name} — ` : ""}${p.period_label} (${p.month_name})`,
            from: start,
            to: end,
          });
        });
      }

      if (active) setOptions(opts);
    };

    load();
    return () => {
      active = false;
    };
  }, [customerId, customerName, allCustomers]);

  if (options.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}
      <Select
        value={value}
        onValueChange={(v) => {
          setValue(v);
          const opt = options.find((o) => o.id === v);
          if (opt) onSelect(opt.from, opt.to);
        }}
      >
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Quick select period" />
        </SelectTrigger>
        <SelectContent className="z-[200]">
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
