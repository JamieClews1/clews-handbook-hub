export type FleetRow = { id: string; name: string; category: string; fleet: number; inYard: number; onSiteClews: number };
export type InventoryProfile = { asset_type: string; size: string | null; condition: string | null; office_verified: boolean | null; value_override: number | null };
export type ValueBand = { asset_type: string; condition: string; value: number; size_group: string | null; sizes: string[] | null };
export type FleetType = { id: string; name: string; category: string; data_hub_keywords: string[] };
const key = (s: string) => s.toLowerCase().replace(/\bcu\.?\s*yds?\b/g, 'yd').replace(/\byards?\b/g, 'yd').replace(/(\d)\s*yd/g, '$1 yd').replace(/\s+/g, ' ').trim();
export function profileType(size: string, category: string, types: FleetType[]) {
  const text = key(size); let best: FleetType | undefined; let length = 0;
  for (const t of types.filter(t => t.category === category)) for (const alias of [t.name, ...t.data_hub_keywords]) {
    const normalized = key(alias);
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (normalized.length > length && new RegExp(`(^|\\W)${escaped}(\\W|$)`).test(text)) { best = t; length = normalized.length; }
  }
  return best;
}
export function profileValue(profile: InventoryProfile, bands: ValueBand[]) {
  if (profile.value_override != null) return Number(profile.value_override);
  const matches = bands.filter(b => b.asset_type === profile.asset_type && b.condition === profile.condition);
  const match = matches.find(b => b.sizes?.some(s => key(s) === key(profile.size ?? ''))) ?? matches.find(b => !b.size_group);
  return match ? Number(match.value) : null;
}
export function buyerValuation(rows: FleetRow[], profiles: InventoryProfile[], bands: ValueBand[], types: FleetType[]) {
  const active = profiles.filter(p => !['Scrapped', 'Yard Use'].includes(p.condition ?? ''));
  const byType = rows.map(row => {
    const verified = active.filter(p => p.office_verified && profileType(p.size ?? '', p.asset_type, types)?.id === row.id);
    // Never silently discard excess confirmed profiles to force an estimate to agree.
    const assumed = Math.max(0, row.fleet - verified.length);
    const fairBands = bands.filter(b => b.asset_type === row.category && b.condition === 'Fair');
    const matching = fairBands.filter(b => b.sizes?.some(s => profileType(s, row.category, types)?.id === row.id));
    const distinct = [...new Set(matching.map(b => Number(b.value)))];
    const fallback = fairBands.find(b => !b.size_group);
    const fairRate = distinct.length === 1 ? distinct[0] : distinct.length === 0 && fallback ? Number(fallback.value) : null;
    const known = verified.map(p => profileValue(p, bands));
    return { ...row, verified: verified.length, assumed, surplus: Math.max(0, verified.length - row.fleet), confirmedValue: known.reduce<number>((sum, v) => sum + (v ?? 0), 0), fairRate, assumedValue: fairRate == null ? null : assumed * fairRate, unvalued: known.filter(v => v == null).length + (fairRate == null ? assumed : 0) };
  });
  const unmatched = active.filter(p => p.office_verified && !rows.some(r => profileType(p.size ?? '', p.asset_type, types)?.id === r.id));
  return { rows: byType, fleet: rows.reduce((s,r) => s+r.fleet,0), yard: rows.reduce((s,r) => s+r.inYard,0), out: rows.reduce((s,r) => s+r.onSiteClews,0), confirmedValue: byType.reduce((s,r) => s+r.confirmedValue,0), assumedValue: byType.reduce((s,r) => s+(r.assumedValue ?? 0),0), assumed: byType.reduce((s,r) => s+r.assumed,0), verified: byType.reduce((s,r) => s+r.verified,0), unvalued: byType.reduce((s,r) => s+r.unvalued,0), surplus: byType.reduce((s,r) => s+r.surplus,0), unmatchedVerified: unmatched.length };
}