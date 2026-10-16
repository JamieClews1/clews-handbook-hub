export type RentalAssignee = {
  id: string;
  user_types: string[] | null;
  is_archived: boolean | null;
};

export function eligibleRentalAssignees<T extends RentalAssignee>(profiles: T[], staffIds: string[]): T[] {
  const staff = new Set(staffIds);
  return profiles.filter((p) => staff.has(p.id) && p.user_types?.includes("office") && !p.is_archived);
}