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
  // Convert h4 headings to bold markdown with proper spacing
  let cleaned = content
    .replace(/<h4>(.*?)<\/h4>/gi, '\n\n**$1**\n');

  // Handle ordered lists: number each <li> sequentially
  cleaned = cleaned.replace(/<ol>([\s\S]*?)<\/ol>/gi, (_, listContent: string) => {
    let counter = 0;
    return listContent.replace(/<li>([\s\S]*?)<\/li>/gi, () => {
      counter++;
      const itemText = arguments.length ? '' : ''; // placeholder
      return '';
    });
  });

  // Actually, let's do this properly with a stateful replace
  cleaned = content
    .replace(/<h4>(.*?)<\/h4>/gi, '\n\n**$1**\n');

  // Replace <ol>...</ol> blocks with numbered items
  cleaned = cleaned.replace(/<ol>([\s\S]*?)<\/ol>/gi, (_match, inner: string) => {
    let i = 0;
    return inner.replace(/<li>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
      i++;
      return `${i}. ${text.trim()}\n`;
    });
  });

  // Replace <ul>...</ul> blocks with bullet items
  cleaned = cleaned.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_match, inner: string) => {
    return inner.replace(/<li>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
      return `• ${text.trim()}\n`;
    });
  });

  // Clean remaining tags
  cleaned = cleaned
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(• [^\n]+\n)\n+(?=• )/g, '$1')
    .replace(/(\d+\. [^\n]+\n)\n+(?=\d+\. )/g, '$1')
    .replace(/^\n+/, '')
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
