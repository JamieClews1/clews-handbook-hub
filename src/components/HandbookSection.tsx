import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HandbookSubsection } from "@/hooks/useHandbookContent";
import { HandbookSignature } from "@/components/HandbookSignature";

interface HandbookSectionProps {
  section: {
    id: string;
    section_key: string;
    title: string;
    subsections: HandbookSubsection[];
  };
}

const stripHtmlAndFormat = (content: string) => {
  // Convert HTML list items to bullet points
  let cleaned = content
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .trim();
  
  return cleaned;
};

const parseContentWithBold = (content: string) => {
  const cleanedContent = stripHtmlAndFormat(content);
  const parts = cleanedContent.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return <strong key={index}>{boldText}</strong>;
    }
    return part;
  });
};

export const HandbookSection = ({ section }: HandbookSectionProps) => {
  return (
    <AccordionItem value={section.id} className="bg-card border rounded-lg px-6">
      <AccordionTrigger className="hover:no-underline">
        <h2 className="text-xl font-semibold">{section.title}</h2>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pt-4 space-y-6">
          {section.subsections.map((subsection) => (
            <div 
              key={subsection.id} 
              id={`${section.id}-${subsection.subsection_key}`}
              className="scroll-mt-24"
            >
              <h3 className="text-lg font-semibold mb-2">{subsection.title}</h3>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {parseContentWithBold(subsection.content)}
              </p>
            </div>
          ))}
          {section.section_key === "handbook_receipt" && <HandbookSignature />}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
