import { supabase } from "@/integrations/supabase/client";

/**
 * PostgREST caps responses at 1000 rows. This pages through the full result set.
 */
export async function fetchAllCustomers<T = any>(
  columns: string,
  orderColumn = "customer_name",
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select(columns)
      .order(orderColumn)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Same paged fetch for any table — PostgREST caps responses at 1000 rows. */
export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  orderColumn: string,
  filters: (q: any) => any = (q) => q,
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = filters(
      supabase.from(table as any).select(columns).order(orderColumn),
    ).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
