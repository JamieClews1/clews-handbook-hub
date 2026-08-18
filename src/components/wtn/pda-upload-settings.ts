import { supabase } from "@/integrations/supabase/client";

export type PdaUploadSettings = {
  require_job_prefix: boolean;
  replace_existing: boolean;
};

export const DEFAULT_PDA_UPLOAD_SETTINGS: PdaUploadSettings = {
  require_job_prefix: true,
  replace_existing: true,
};

export async function fetchPdaUploadSettings(): Promise<PdaUploadSettings> {
  const { data } = await supabase
    .from("pda_upload_settings")
    .select("require_job_prefix, replace_existing")
    .limit(1);
  const row = data?.[0];
  return row ? { require_job_prefix: !!row.require_job_prefix, replace_existing: !!row.replace_existing } : DEFAULT_PDA_UPLOAD_SETTINGS;
}

export async function savePdaUploadSettings(patch: Partial<PdaUploadSettings>) {
  const { data } = await supabase.from("pda_upload_settings").select("id").limit(1);
  const id = data?.[0]?.id;
  if (id) {
    const { error } = await supabase.from("pda_upload_settings").update(patch).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("pda_upload_settings")
      .insert({ ...DEFAULT_PDA_UPLOAD_SETTINGS, ...patch });
    if (error) throw error;
  }
}

/** Filenames must start with "JOB" (case-insensitive) when the rule is on. */
export function hasJobPrefix(name: string) {
  return /^job/i.test(name.trim());
}
