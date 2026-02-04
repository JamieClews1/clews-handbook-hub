import { useState, useEffect, useCallback } from 'react';
import { Network } from '@capacitor/network';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const OFFLINE_REPORTS_KEY = 'offline_load_reports';
const OFFLINE_LINE_ITEMS_KEY = 'offline_load_line_items';

export interface OfflineLoadReport {
  localId: string;
  operator_id: string;
  operator_name: string;
  vehicle_reg: string | null;
  notes: string | null;
  site_id: string | null;
  report_date: string;
  total_pallets: number;
  total_weight_kg: number;
  status: string;
  submitted_at: string | null;
  lineItems: OfflineLineItem[];
  synced: boolean;
  createdAt: string;
}

export interface OfflineLineItem {
  waste_type: string;
  pallet_count: number;
  avg_weight_kg: number;
  total_weight_kg: number;
  display_order: number;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();

  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch {
        // Fallback for web
        setIsOnline(navigator.onLine);
      }
    };

    checkNetwork();

    // Listen for network changes
    const listener = Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
      if (status.connected) {
        // Auto-sync when coming back online
        syncPendingReports();
      }
    });

    // Fallback listeners for web
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      listener.then(l => l.remove());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending reports
  useEffect(() => {
    const reports = getOfflineReports();
    const pending = reports.filter(r => !r.synced);
    setPendingCount(pending.length);
  }, []);

  const getOfflineReports = useCallback((): OfflineLoadReport[] => {
    try {
      const stored = localStorage.getItem(OFFLINE_REPORTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const saveOfflineReport = useCallback((report: OfflineLoadReport) => {
    const reports = getOfflineReports();
    const existingIndex = reports.findIndex(r => r.localId === report.localId);
    
    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.push(report);
    }
    
    localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(reports));
    setPendingCount(reports.filter(r => !r.synced).length);
    
    return report.localId;
  }, [getOfflineReports]);

  const deleteOfflineReport = useCallback((localId: string) => {
    const reports = getOfflineReports().filter(r => r.localId !== localId);
    localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(reports));
    setPendingCount(reports.filter(r => !r.synced).length);
  }, [getOfflineReports]);

  const syncPendingReports = useCallback(async () => {
    if (isSyncing) return;
    
    const reports = getOfflineReports().filter(r => !r.synced);
    if (reports.length === 0) return;

    setIsSyncing(true);
    let syncedCount = 0;

    try {
      for (const report of reports) {
        try {
          // Insert the report
          const { data: newReport, error: reportError } = await supabase
            .from('load_reports')
            .insert({
              operator_id: report.operator_id,
              operator_name: report.operator_name,
              vehicle_reg: report.vehicle_reg,
              notes: report.notes,
              site_id: report.site_id,
              report_date: report.report_date,
              total_pallets: report.total_pallets,
              total_weight_kg: report.total_weight_kg,
              status: report.status,
              submitted_at: report.submitted_at,
            })
            .select()
            .single();

          if (reportError) throw reportError;

          // Insert line items
          if (newReport && report.lineItems.length > 0) {
            const lineItemsPayload = report.lineItems.map(item => ({
              load_report_id: newReport.id,
              waste_type: item.waste_type,
              pallet_count: item.pallet_count,
              avg_weight_kg: item.avg_weight_kg,
              total_weight_kg: item.total_weight_kg,
              display_order: item.display_order,
            }));

            const { error: itemsError } = await supabase
              .from('load_line_items')
              .insert(lineItemsPayload);

            if (itemsError) throw itemsError;
          }

          // Mark as synced
          report.synced = true;
          syncedCount++;
        } catch (error) {
          console.error('Failed to sync report:', report.localId, error);
        }
      }

      // Update local storage with sync status
      const allReports = getOfflineReports();
      const updatedReports = allReports.map(r => {
        const synced = reports.find(sr => sr.localId === r.localId && sr.synced);
        return synced ? { ...r, synced: true } : r;
      });
      localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(updatedReports));
      setPendingCount(updatedReports.filter(r => !r.synced).length);

      if (syncedCount > 0) {
        toast({
          title: 'Sync Complete',
          description: `${syncedCount} report${syncedCount > 1 ? 's' : ''} synced successfully.`,
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: 'Some reports could not be synced. Will retry when online.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [getOfflineReports, isSyncing, toast]);

  const clearSyncedReports = useCallback(() => {
    const reports = getOfflineReports().filter(r => !r.synced);
    localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(reports));
  }, [getOfflineReports]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    getOfflineReports,
    saveOfflineReport,
    deleteOfflineReport,
    syncPendingReports,
    clearSyncedReports,
  };
}
