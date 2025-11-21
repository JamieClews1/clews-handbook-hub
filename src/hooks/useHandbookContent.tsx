import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HandbookSubsection {
  id: string;
  section_id: string;
  subsection_key: string;
  title: string;
  content: string;
  display_order: number;
}

export interface HandbookSection {
  id: string;
  section_key: string;
  title: string;
  subsections: HandbookSubsection[];
  display_order: number;
}

export const useHandbookContent = (language: string) => {
  const [sections, setSections] = useState<HandbookSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        
        // Fetch sections
        const { data: sectionsData, error: sectionsError } = await supabase
          .from("handbook_sections")
          .select("*")
          .order("display_order");

        if (sectionsError) throw sectionsError;

        // Fetch subsections
        const { data: subsectionsData, error: subsectionsError } = await supabase
          .from("handbook_subsections")
          .select("*")
          .order("display_order");

        if (subsectionsError) throw subsectionsError;

        // Map language-specific fields
        const titleField = `title_${language}` as keyof typeof sectionsData[0];
        const contentField = `content_${language}` as keyof typeof subsectionsData[0];

        // Organize data by sections
        const organizedSections: HandbookSection[] = (sectionsData || []).map((section) => {
          const sectionSubsections = (subsectionsData || [])
            .filter((sub) => sub.section_id === section.id)
            .map((sub) => ({
              id: sub.id,
              section_id: sub.section_id,
              subsection_key: sub.subsection_key,
              title: (sub[titleField] || sub.title_en) as string,
              content: (sub[contentField] || sub.content_en) as string,
              display_order: sub.display_order,
            }));

          return {
            id: section.id,
            section_key: section.section_key,
            title: (section[titleField] || section.title_en) as string,
            subsections: sectionSubsections,
            display_order: section.display_order,
          };
        });

        setSections(organizedSections);
        setError(null);
      } catch (err) {
        console.error("Error fetching handbook content:", err);
        setError("Failed to load handbook content");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [language]);

  return { sections, loading, error };
};
