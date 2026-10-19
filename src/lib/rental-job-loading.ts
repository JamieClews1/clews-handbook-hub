import type { OverRentalJob } from "./overRental";

type JobPage = { data: OverRentalJob[] | null; error: { message: string } | null };

// Publish a list only when every page succeeded; never turn failures into zero rentals.
export async function loadRentalJobPages(
  fetchPage: (from: number, to: number) => PromiseLike<JobPage>,
  pageSize = 1000,
): Promise<OverRentalJob[]> {
  const jobs: OverRentalJob[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Rental jobs could not be loaded");
    jobs.push(...data);
    if (data.length < pageSize) return jobs;
  }
}