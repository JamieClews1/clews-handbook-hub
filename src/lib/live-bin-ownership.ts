export function liveBinOwnership(key: string, count: number, ownKeys: Set<string>, collectedKeys: Set<string>) {
  const onSite = collectedKeys.has(key) ? 0 : count;
  return { onSite, own: ownKeys.has(key) ? onSite : 0 };
}