import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineLoadReport {
  localId: string;
  serverId?: string;
  operatorId: string;
  operatorName: string;
  vehicleReg: string | null;
  jobNumber: string | null;
  siteId: string | null;
  reportDate: string;
  status: 'draft' | 'submitted';
  syncStatus: 'pending' | 'synced' | 'error';
  syncError?: string;
  totalPallets: number;
  totalWeightKg: number;
  palletsOut?: number;
  noPalletsOnLoad?: boolean;
  wetChargePercent?: number;
  lineItems: OfflineLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OfflineLineItem {
  wasteType: string;
  palletCount: number;
  avgWeightKg: number;
  totalWeightKg: number;
  displayOrder: number;
  wetChargeApplied?: boolean;
}

interface LoadReportsDB extends DBSchema {
  'load-reports': {
    key: string;
    value: OfflineLoadReport;
    indexes: {
      'by-sync-status': string;
      'by-status': string;
    };
  };
  'waste-types': {
    key: string;
    value: {
      id: string;
      wasteType: string;
      defaultAvgWeightKg: number;
      displayOrder: number;
      palletWeightKg: number;
      isActive: boolean;
    };
  };
  'sites': {
    key: string;
    value: {
      id: string;
      siteName: string;
    };
  };
}

let db: IDBPDatabase<LoadReportsDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<LoadReportsDB>> {
  if (db) return db;

  db = await openDB<LoadReportsDB>('clews-load-reports', 1, {
    upgrade(database) {
      // Load reports store
      const reportsStore = database.createObjectStore('load-reports', {
        keyPath: 'localId',
      });
      reportsStore.createIndex('by-sync-status', 'syncStatus');
      reportsStore.createIndex('by-status', 'status');

      // Waste types cache
      database.createObjectStore('waste-types', { keyPath: 'id' });

      // Sites cache
      database.createObjectStore('sites', { keyPath: 'id' });
    },
  });

  return db;
}

// Load Reports Operations
export async function saveOfflineReport(report: OfflineLoadReport): Promise<void> {
  const database = await getDB();
  await database.put('load-reports', report);
}

export async function getOfflineReport(localId: string): Promise<OfflineLoadReport | undefined> {
  const database = await getDB();
  return database.get('load-reports', localId);
}

export async function getAllOfflineReports(): Promise<OfflineLoadReport[]> {
  const database = await getDB();
  return database.getAll('load-reports');
}

export async function getPendingSyncReports(): Promise<OfflineLoadReport[]> {
  const database = await getDB();
  return database.getAllFromIndex('load-reports', 'by-sync-status', 'pending');
}

export async function deleteOfflineReport(localId: string): Promise<void> {
  const database = await getDB();
  await database.delete('load-reports', localId);
}

export async function updateReportSyncStatus(
  localId: string,
  syncStatus: 'pending' | 'synced' | 'error',
  serverId?: string,
  syncError?: string
): Promise<void> {
  const database = await getDB();
  const report = await database.get('load-reports', localId);
  if (report) {
    report.syncStatus = syncStatus;
    if (serverId) report.serverId = serverId;
    if (syncError) report.syncError = syncError;
    report.updatedAt = new Date().toISOString();
    await database.put('load-reports', report);
  }
}

// Waste Types Cache
export async function cacheWasteTypes(wasteTypes: Array<{
  id: string;
  waste_type: string;
  default_avg_weight_kg: number;
  display_order: number;
  pallet_weight_kg: number;
  is_active: boolean;
}>): Promise<void> {
  const database = await getDB();
  const tx = database.transaction('waste-types', 'readwrite');
  await tx.store.clear();
  for (const wt of wasteTypes) {
    await tx.store.put({
      id: wt.id,
      wasteType: wt.waste_type,
      defaultAvgWeightKg: wt.default_avg_weight_kg,
      displayOrder: wt.display_order,
      palletWeightKg: wt.pallet_weight_kg,
      isActive: wt.is_active,
    });
  }
  await tx.done;
}

export async function getCachedWasteTypes(): Promise<Array<{
  id: string;
  wasteType: string;
  defaultAvgWeightKg: number;
  displayOrder: number;
  palletWeightKg: number;
  isActive: boolean;
}>> {
  const database = await getDB();
  return database.getAll('waste-types');
}

// Sites Cache
export async function cacheSites(sites: Array<{ id: string; site_name: string }>): Promise<void> {
  const database = await getDB();
  const tx = database.transaction('sites', 'readwrite');
  await tx.store.clear();
  for (const site of sites) {
    await tx.store.put({
      id: site.id,
      siteName: site.site_name,
    });
  }
  await tx.done;
}

export async function getCachedSites(): Promise<Array<{ id: string; siteName: string }>> {
  const database = await getDB();
  return database.getAll('sites');
}

// Generate local ID
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
