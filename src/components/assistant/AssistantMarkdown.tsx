import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Markdown renderer for assistant answers with proper tables, headings and lists. */
export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="not-prose my-2 overflow-x-auto rounded-md border border-border">
              <Table className="text-xs">{children}</Table>
            </div>
          ),
          thead: ({ children }) => <TableHeader className="bg-muted/50">{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead className="h-8 whitespace-nowrap px-2 text-xs">{children}</TableHead>,
          td: ({ children }) => <TableCell className="px-2 py-1.5 tabular-nums">{children}</TableCell>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
