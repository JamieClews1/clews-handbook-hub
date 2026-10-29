import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import type { ToolboxTalkSignature } from "./toolbox-talk-signatures";

export async function loadToolboxTalkSignatures(talkId: string): Promise<ToolboxTalkSignature[]> {
  const signatures: Omit<ToolboxTalkSignature, "name">[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await withTimeout(supabase.from("toolbox_talk_signatures")
      .select("id, user_id, signed_at, signature_image").eq("toolbox_talk_id", talkId)
      .order("signed_at").order("id").range(offset, offset + pageSize - 1), 20000, "Signature read");
    if (error) throw error;
    if (!data) throw new Error("Unable to read signatures");
    signatures.push(...data);
    if (data.length < pageSize) break;
  }
  const ids = [...new Set(signatures.map(s => s.user_id))];
  const names = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await withTimeout(supabase.from("profiles").select("id, full_name")
      .in("id", ids.slice(offset, offset + 100)), 20000, "Signer names");
    if (error) throw error;
    for (const profile of data || []) if (profile.full_name) names.set(profile.id, profile.full_name);
  }
  return signatures.map(s => ({ ...s, name: names.get(s.user_id) || `User ${s.user_id}` }));
}