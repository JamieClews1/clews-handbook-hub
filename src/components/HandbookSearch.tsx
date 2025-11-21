import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HandbookSection as HandbookSectionType } from "@/hooks/useHandbookContent";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  sectionTitle: string;
}

interface HandbookSearchProps {
  data: HandbookSectionType[];
  onResultClick: (sectionId: string, subsectionId: string) => void;
}

export const HandbookSearch = ({ data, onResultClick }: HandbookSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchContent = (query: string) => {
    setSearchQuery(query);
    
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    (data || []).forEach((section: any) => {
      (section.subsections || []).forEach((subsection: any) => {
        const titleText = (subsection.title || "").toLowerCase();
        const contentText = (subsection.content || "").toLowerCase();
        const titleMatch = titleText.includes(lowerQuery);
        const contentMatch = contentText.includes(lowerQuery);

        if (titleMatch || contentMatch) {
          results.push({
            id: subsection.id,
            title: subsection.title,
            content: (subsection.content || "").substring(0, 150) + "...",
            sectionTitle: section.title,
          });
        }
      });
    });

    setSearchResults(results);
  };

  const handleSelect = (sectionId: string, subsectionId: string) => {
    setOpen(false);
    onResultClick(sectionId, subsectionId);
  };

  return (
    <>
      <div className="relative w-full max-w-2xl">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-2 text-left text-muted-foreground bg-background border border-input rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search handbook...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search employee handbook..."
          onValueChange={searchContent}
          value={searchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searchQuery ? "No results found." : "Type to search..."}
          </CommandEmpty>
          {searchResults.length > 0 && (
            <CommandGroup heading="Search Results">
              {searchResults.map((result) => {
                const parts = result.id.split("-");
                const sectionId = (data || []).find((s: any) =>
                  s.subsections?.some((sub: any) => sub.id === result.id)
                )?.id || "";

                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(sectionId, result.id)}
                    className="flex flex-col items-start gap-1 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{result.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-6">
                      {result.sectionTitle}
                    </span>
                    <p className="text-sm text-muted-foreground line-clamp-2 ml-6">
                      {result.content}
                    </p>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
