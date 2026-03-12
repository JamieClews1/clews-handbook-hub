import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

/** Returns the latest job_date from data_hub_jobs as a formatted string */
export const useLatestDataDate = () => {
  const [latestDate, setLatestDate] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("data_hub_jobs")
        .select("job_date")
        .not("job_date", "is", null)
        .order("job_date", { ascending: false })
        .limit(1)
        .single();

      if (data?.job_date) {
        setLatestDate(format(parseISO(data.job_date), "dd MMM yyyy"));
      }
    };
    fetch();
  }, []);

  return latestDate;
};
