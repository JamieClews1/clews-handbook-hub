import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export type LockedReport = {
  id: string;
  customer_id: string;
  site_id: string | null;
  period_start: string;
  period_end: string;
  report_type: string;
  locked_by: string | null;
  locked_at: string;
  report_snapshot: any;
  rebate_values_snapshot: any;
  total_rebate: number;
  total_weight: number;
  notes: string | null;
};

export type RebateValueChange = {
  item_name: string;
  field: string;
  locked_value: number;
  current_value: number;
};

export function useLockedRebateReport(
  siteId: string | null,
  customerId: string,
  periodStart: Date | undefined,
  periodEnd: Date | undefined,
  reportType: string
) {
  const { user } = useAuth();
  const [lockedReport, setLockedReport] = useState<LockedReport | null>(null);
  const [valueChanges, setValueChanges] = useState<RebateValueChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const periodStartStr = periodStart ? format(periodStart, "yyyy-MM-dd") : null;
  const periodEndStr = periodEnd ? format(periodEnd, "yyyy-MM-dd") : null;

  // Check for existing locked report
  const checkLocked = useCallback(async () => {
    if (!customerId || !periodStartStr || !periodEndStr) {
      setLockedReport(null);
      setValueChanges([]);
      return;
    }

    setChecking(true);
    try {
      let query = supabase
        .from("locked_rebate_reports")
        .select("*")
        .eq("customer_id", customerId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .eq("report_type", reportType);

      if (siteId) {
        query = query.eq("site_id", siteId);
      } else {
        query = query.is("site_id", null);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setLockedReport(data as unknown as LockedReport);
        // Check for value changes
        await detectChanges(data as unknown as LockedReport);
      } else {
        setLockedReport(null);
        setValueChanges([]);
      }
    } finally {
      setChecking(false);
    }
  }, [customerId, siteId, periodStartStr, periodEndStr, reportType]);

  const detectChanges = async (locked: LockedReport) => {
    const snapshot = locked.rebate_values_snapshot as Record<string, { lower: number; higher: number; name: string }>;
    if (!snapshot || Object.keys(snapshot).length === 0) {
      setValueChanges([]);
      return;
    }

    // Fetch current monthly values for the same period
    const itemIds = Object.keys(snapshot);
    const { data: currentValues } = await supabase
      .from("rebate_monthly_values")
      .select("item_id, lower_range, higher_range, month_start")
      .in("item_id", itemIds)
      .eq("month_start", locked.period_start);

    const currentMap: Record<string, { lower: number; higher: number }> = {};
    for (const v of currentValues ?? []) {
      currentMap[v.item_id] = { lower: v.lower_range ?? 0, higher: v.higher_range ?? 0 };
    }

    const changes: RebateValueChange[] = [];
    for (const [itemId, snapshotVal] of Object.entries(snapshot)) {
      const current = currentMap[itemId];
      if (!current) continue;

      if (snapshotVal.lower !== current.lower) {
        changes.push({
          item_name: snapshotVal.name || itemId,
          field: "Lower Range",
          locked_value: snapshotVal.lower,
          current_value: current.lower,
        });
      }
      if (snapshotVal.higher !== current.higher) {
        changes.push({
          item_name: snapshotVal.name || itemId,
          field: "Higher Range",
          locked_value: snapshotVal.higher,
          current_value: current.higher,
        });
      }
    }

    setValueChanges(changes);
  };

  useEffect(() => {
    checkLocked();
  }, [checkLocked]);

  const lockReport = async (
    reportSnapshot: any,
    rebateValuesSnapshot: Record<string, { lower: number; higher: number; name: string }>,
    totalRebate: number,
    totalWeight: number
  ) => {
    if (!customerId || !periodStartStr || !periodEndStr) return;

    setLoading(true);
    try {
      const payload = {
        customer_id: customerId,
        site_id: siteId || null,
        period_start: periodStartStr,
        period_end: periodEndStr,
        report_type: reportType,
        locked_by: user?.id || null,
        report_snapshot: reportSnapshot,
        rebate_values_snapshot: rebateValuesSnapshot,
        total_rebate: totalRebate,
        total_weight: totalWeight,
      };

      if (lockedReport) {
        // Update existing lock
        const { data, error } = await supabase
          .from("locked_rebate_reports")
          .update(payload)
          .eq("id", lockedReport.id)
          .select()
          .single();

        if (error) throw error;
        setLockedReport(data as unknown as LockedReport);
        setValueChanges([]);
      } else {
        // Create new lock
        const { data, error } = await supabase
          .from("locked_rebate_reports")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setLockedReport(data as unknown as LockedReport);
        setValueChanges([]);
      }

      return true;
    } catch (err) {
      console.error("Failed to lock report:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlockReport = async () => {
    if (!lockedReport) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("locked_rebate_reports")
        .delete()
        .eq("id", lockedReport.id);

      if (error) throw error;
      setLockedReport(null);
      setValueChanges([]);
      return true;
    } catch (err) {
      console.error("Failed to unlock report:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const dismissChanges = () => {
    setValueChanges([]);
  };

  return {
    lockedReport,
    valueChanges,
    loading,
    checking,
    lockReport,
    unlockReport,
    dismissChanges,
    refreshLock: checkLocked,
  };
}
