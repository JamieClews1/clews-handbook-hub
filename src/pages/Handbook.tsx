import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HandbookSearch } from "@/components/HandbookSearch";
import { HandbookSection } from "@/components/HandbookSection";
import { HandbookPrintDialog } from "@/components/HandbookPrintDialog";
import { useHandbookContent } from "@/hooks/useHandbookContent";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";

interface HandbookProps {
  language: string;
}

const introductions = {
  en: "Welcome to the Clews Recycling team! You are a valued member of our staff, and this handbook has been created to help you understand our policies, procedures, and workplace culture. We're here to support you every step of the way.",
  pl: "Witamy w zespole Clews Recycling! Jesteś cenionym członkiem naszego zespołu, a ten podręcznik został stworzony, aby pomóc Ci zrozumieć nasze zasady, procedury i kulturę miejsca pracy. Jesteśmy tu, aby wspierać Cię na każdym kroku.",
  uk: "Ласкаво просимо до команди Clews Recycling! Ви є цінним членом нашого персоналу, і цей довідник створено, щоб допомогти вам зрозуміти наші політики, процедури та культуру на робочому місці. Ми тут, щоб підтримувати вас на кожному кроці.",
  ro: "Bun venit în echipa Clews Recycling! Sunteți un membru valoros al personalului nostru, iar acest manual a fost creat pentru a vă ajuta să înțelegeți politicile, procedurile și cultura noastră la locul de muncă. Suntem aici pentru a vă sprijini la fiecare pas."
};

export const Handbook = ({ language }: HandbookProps) => {
  const { sections, loading, error } = useHandbookContent(language);
  const [expandedSection, setExpandedSection] = useState<string>("");
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const handleSearchResultClick = (sectionId: string, subsectionId: string) => {
    setExpandedSection(sectionId);
    
    // Wait for accordion to expand, then scroll to subsection
    setTimeout(() => {
      // Find the subsection data to get the subsection_key
      const section = sections.find(s => s.id === sectionId);
      const subsection = section?.subsections.find(sub => sub.id === subsectionId);
      
      if (subsection) {
        const domId = `${sectionId}-${subsection.subsection_key}`;
        const element = document.getElementById(domId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 300);
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center text-destructive">
              <p>{error}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Employee Handbook</h1>
        <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="text-foreground max-w-2xl mx-auto leading-relaxed mb-6">
          {introductions[language as keyof typeof introductions] || introductions.en}
        </p>
        <Button onClick={() => setShowPrintDialog(true)} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

        <HandbookSearch data={sections} onResultClick={handleSearchResultClick} />

        {sections.length > 0 && (
          <Accordion
            type="single"
            collapsible
            className="space-y-4"
            value={expandedSection}
            onValueChange={setExpandedSection}
          >
            {sections.map((section) => (
              <HandbookSection key={section.id} section={section} />
            ))}
          </Accordion>
        )}

        <HandbookPrintDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          sections={sections}
          language={language}
        />
      </div>
    </main>
  );
};
