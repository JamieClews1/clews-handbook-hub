import { supabase } from '@/integrations/supabase/client';
import {
  getPendingSyncReports,
  updateReportSyncStatus,
  deleteOfflineReport,
  OfflineLoadReport,
} from './offline-db';

let isSyncing = false;
let syncListeners: Array<() => void> = [];

export function addSyncListener(listener: () => void): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  syncListeners.forEach((l) => l());
}

export async function syncPendingReports(): Promise<{ synced: number; errors: number }> {
  if (isSyncing) return { synced: 0, errors: 0 };
  if (!navigator.onLine) return { synced: 0, errors: 0 };

  isSyncing = true;
  let synced = 0;
  let errors = 0;

  try {
    const pendingReports = await getPendingSyncReports();

    for (const report of pendingReports) {
      try {
        await syncSingleReport(report);
        synced++;
      } catch (error) {
        console.error('Error syncing report:', report.localId, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateReportSyncStatus(report.localId, 'error', undefined, errorMessage);
        errors++;
      }
    }
  } finally {
    isSyncing = false;
    if (synced > 0 || errors > 0) {
      notifyListeners();
    }
  }

  return { synced, errors };
}

async function syncSingleReport(report: OfflineLoadReport): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const reportPayload = {
    operator_id: userData.user.id,
    operator_name: report.operatorName,
    vehicle_reg: report.vehicleReg,
    notes: report.jobNumber,
    site_id: report.siteId,
    report_date: report.reportDate,
    total_pallets: report.totalPallets,
    total_weight_kg: report.totalWeightKg,
    pallets_out: report.palletsOut || 0,
    status: report.status,
    submitted_at: report.status === 'submitted' ? new Date().toISOString() : null,
  };

  let serverId = report.serverId;

  if (serverId) {
    // Update existing report
    const { error } = await supabase
      .from('load_reports')
      .update(reportPayload)
      .eq('id', serverId);
    if (error) throw error;
  } else {
    // Create new report
    const { data, error } = await supabase
      .from('load_reports')
      .insert(reportPayload)
      .select()
      .single();
    if (error) throw error;
    serverId = data.id;
  }

  // Delete existing line items and re-insert
  await supabase.from('load_line_items').delete().eq('load_report_id', serverId);

  const lineItemsPayload = report.lineItems.map((item) => ({
    load_report_id: serverId,
    waste_type: item.wasteType,
    pallet_count: item.palletCount,
    avg_weight_kg: item.avgWeightKg,
    total_weight_kg: item.totalWeightKg,
    display_order: item.displayOrder,
  }));

  const { error: itemsError } = await supabase
    .from('load_line_items')
    .insert(lineItemsPayload);
  if (itemsError) throw itemsError;

  // Mark as synced
  await updateReportSyncStatus(report.localId, 'synced', serverId);

  // If submitted and synced, remove from local DB
  if (report.status === 'submitted') {
    await deleteOfflineReport(report.localId);
  }
}

// Auto-sync when coming online
export function initAutoSync(): () => void {
  const handleOnline = () => {
    console.log('Network online - starting sync...');
    syncPendingReports().then(({ synced, errors }) => {
      if (synced > 0) {
        console.log(`Synced ${synced} reports`);
      }
      if (errors > 0) {
        console.warn(`${errors} reports failed to sync`);
      }
    });
  };

  window.addEventListener('online', handleOnline);

  // Try an initial sync
  if (navigator.onLine) {
    syncPendingReports();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

export function isOnline(): boolean {
  return navigator.onLine;
}
