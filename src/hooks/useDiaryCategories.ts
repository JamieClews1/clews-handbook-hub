import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DiaryCategory,
  DEFAULT_DIARY_CATEGORIES,
  slugifyCategoryKey,
} from "@/lib/diary-utils";

/**
 * Loads the user's diary categories, seeding the defaults on first use,
 * and exposes add/update/delete for the settings dialog.
 */
export function useDiaryCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<DiaryCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("diary_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true });

    if (!error && data && data.length === 0) {
      const rows = DEFAULT_DIARY_CATEGORIES.map((c, i) => ({
        user_id: user.id,
        key: c.key,
        label: c.label,
        color: c.color,
        display_order: i,
      }));
      const { data: seeded } = await supabase
        .from("diary_categories")
        .insert(rows)
        .select();
      setCategories(
        (seeded ?? rows).map((r) => ({ key: r.key, label: r.label, color: r.color }))
      );
    } else {
      setCategories(
        (data ?? []).map((r) => ({ key: r.key, label: r.label, color: r.color }))
      );
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = async (label: string, color: string) => {
    if (!user) return;
    const key = slugifyCategoryKey(label, categories.map((c) => c.key));
    const { data, error } = await supabase
      .from("diary_categories")
      .insert({
        user_id: user.id,
        key,
        label,
        color,
        display_order: categories.length,
      })
      .select()
      .single();
    if (!error && data) {
      setCategories((prev) => [
        ...prev,
        { key: data.key, label: data.label, color: data.color },
      ]);
    }
  };

  const updateCategory = async (key: string, updates: Partial<DiaryCategory>) => {
    if (!user) return;
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...updates } : c))
    );
    await supabase
      .from("diary_categories")
      .update(updates)
      .eq("user_id", user.id)
      .eq("key", key);
  };

  const deleteCategory = async (key: string) => {
    if (!user) return;
    setCategories((prev) => prev.filter((c) => c.key !== key));
    await supabase
      .from("diary_categories")
      .delete()
      .eq("user_id", user.id)
      .eq("key", key);
    // Entries in the deleted category fall back to General
    await supabase
      .from("diary_cards")
      .update({ category: null })
      .eq("user_id", user.id)
      .eq("category", key);
  };

  return { categories, loaded, addCategory, updateCategory, deleteCategory };
}
