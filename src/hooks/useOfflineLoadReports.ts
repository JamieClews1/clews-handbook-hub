import { useState, useEffect, useCallback } from 'react';
import {
  getAllOfflineReports,
  saveOfflineReport,
  getOfflineReport,
  deleteOfflineReport,
  generateLocalId,
  OfflineLoadReport,
  OfflineLineItem,
  cacheWasteTypes,
  getCachedWasteTypes,
  cacheSites,
  getCachedSites,
} from '@/lib/offline-db';
import { syncPendingReports, addSyncListener, isOnline } from '@/lib/sync-service';
import { supabase } from '@/integrations/supabase/client';
import { normalizeLoadReportDate } from '@/lib/load-report-dates';

export interface UseOfflineLoadReportsReturn {
  reports: OfflineLoadReport[];
  isLoading: boolean;
  isOnline: boolean;
  pendingCount: number;
  wasteTypes: Array<{
    id: string;
    wasteType: string;
    defaultAvgWeightKg: number;
    displayOrder: number;
    palletWeightKg: number;
    isActive: boolean;
  }>;
  sites: Array<{ id: string; siteName: string }>;
  saveReport: (report: Omit<OfflineLoadReport, 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => Promise<string>;
  updateReport: (localId: string, updates: Partial<OfflineLoadReport>) => Promise<void>;
  removeReport: (localId: string) => Promise<void>;
  syncNow: () => Promise<{ synced: number; errors: number }>;
  refreshData: () => Promise<void>;
}

export function useOfflineLoadReports(userId?: string): UseOfflineLoadReportsReturn {
  const [reports, setReports] = useState<OfflineLoadReport[]>([]);
  const [wasteTypes, setWasteTypes] = useState<UseOfflineLoadReportsReturn['wasteTypes']>([]);
  const [sites, setSites] = useState<UseOfflineLoadReportsReturn['sites']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [online, setOnline] = useState(isOnline());

  const pendingCount = reports.filter((r) => r.syncStatus === 'pending').length;

  const loadLocalData = useCallback(async () => {
    const [localReports, cachedWasteTypes, cachedSites] = await Promise.all([
      getAllOfflineReports(),
      getCachedWasteTypes(),
      getCachedSites(),
    ]);
    setReports(localReports.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
    setWasteTypes(cachedWasteTypes.sort((a, b) => a.displayOrder - b.displayOrder));
    setSites(cachedSites.sort((a, b) => a.siteName.localeCompare(b.siteName)));
    setIsLoading(false);
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      // Fetch and cache waste types
      const { data: serverWasteTypes } = await supabase
        .from('load_waste_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (serverWasteTypes) {
        await cacheWasteTypes(serverWasteTypes);
        setWasteTypes(serverWasteTypes.map(wt => ({
          id: wt.id,
          wasteType: wt.waste_type,
          defaultAvgWeightKg: wt.default_avg_weight_kg,
          displayOrder: wt.display_order,
          palletWeightKg: wt.pallet_weight_kg,
          isActive: wt.is_active,
        })).sort((a, b) => a.displayOrder - b.displayOrder));
      }

      // Fetch and cache sites
      const { data: serverSites } = await supabase
        .from('customer_sites')
        .select('id, site_name')
        .order('site_name');
      
      if (serverSites) {
        await cacheSites(serverSites);
        setSites(serverSites.map(s => ({
          id: s.id,
          siteName: s.site_name,
        })));
      }
    } catch (error) {
      console.error('Error refreshing from server:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadLocalData(), refreshFromServer()]);
  }, [loadLocalData, refreshFromServer]);

  useEffect(() => {
    loadLocalData();
    refreshFromServer();

    // Listen for online/offline changes
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync events
    const unsubscribe = addSyncListener(() => {
      loadLocalData();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [loadLocalData, refreshFromServer]);

  const saveReport = useCallback(async (
    reportData: Omit<OfflineLoadReport, 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus'>
  ): Promise<string> => {
    const localId = generateLocalId();
    const now = new Date().toISOString();
    const normalizedReportDate = normalizeLoadReportDate(reportData.reportDate);
    
    const report: OfflineLoadReport = {
      ...reportData,
      reportDate: normalizedReportDate || reportData.reportDate,
      localId,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await saveOfflineReport(report);
    await loadLocalData();

    // Try to sync immediately if online
    if (navigator.onLine) {
      syncPendingReports();
    }

    return localId;
  }, [loadLocalData]);

  const updateReport = useCallback(async (
    localId: string,
    updates: Partial<OfflineLoadReport>
  ): Promise<void> => {
    const existing = await getOfflineReport(localId);
    if (!existing) return;

    const updated: OfflineLoadReport = {
      ...existing,
      ...updates,
      reportDate: updates.reportDate
        ? normalizeLoadReportDate(updates.reportDate) || updates.reportDate
        : existing.reportDate,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending', // Mark for re-sync
    };

    await saveOfflineReport(updated);
    await loadLocalData();

    if (navigator.onLine) {
      syncPendingReports();
    }
  }, [loadLocalData]);

  const removeReport = useCallback(async (localId: string): Promise<void> => {
    await deleteOfflineReport(localId);
    await loadLocalData();
  }, [loadLocalData]);

  const syncNow = useCallback(async (): Promise<{ synced: number; errors: number }> => {
    const result = await syncPendingReports();
    await loadLocalData();
    return result;
  }, [loadLocalData]);

  return {
    reports,
    isLoading,
    isOnline: online,
    pendingCount,
    wasteTypes,
    sites,
    saveReport,
    updateReport,
    removeReport,
    syncNow,
    refreshData,
  };
}
