import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Download, Loader2, User, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: any[];
  query?: any;
  error?: string;
  timestamp: Date;
}

const EXAMPLE_QUESTIONS = [
  "Show all jobs from last month",
  "What's the total weight by customer?",
  "How many jobs per site this year?",
  "Compare Skiptrak vs Midweigh weights",
  "List all jobs with EWC code starting with 17",
];

export default function DataHubAIChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("data-hub-ai", {
        body: { question },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.explanation || "Here are the results:",
        results: data.results,
        query: data.query,
        error: data.error,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      console.error("Chat error:", e);
      toast({
        title: "Error",
        description: e?.message || "Failed to process your question",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I couldn't process that question. Please try again.",
        error: e?.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportToExcel = (results: any[], explanation: string) => {
    if (!results || results.length === 0) {
      toast({ title: "No data to export" });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Create header rows
    const headerRows = [
      ["Data Hub AI Query Results"],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Query: ${explanation}`],
      [`Total Records: ${results.length}`],
      [],
    ];

    // Get column headers from the first result
    const columns = Object.keys(results[0]);

    // Create worksheet data
    const wsData = [
      ...headerRows,
      columns,
      ...results.map((row) => columns.map((col) => row[col])),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = columns.map(() => ({ wch: 20 }));

    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `data-hub-query-${Date.now()}.xlsx`);

    toast({ title: "Excel file downloaded" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderResults = (message: Message) => {
    if (!message.results || message.results.length === 0) return null;

    const columns = Object.keys(message.results[0]);
    const displayRows = message.results.slice(0, 20);

    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {displayRows.length} of {message.results.length} results
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExportToExcel(message.results!, message.content)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <ScrollArea className="max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      {col.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col} className="whitespace-nowrap">
                        {row[col] != null ? String(row[col]) : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Ask AI
        </CardTitle>
        <CardDescription>
          Ask questions about your Data Hub data in natural language
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Ask questions about your data
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              I can help you filter, aggregate, and compare data from the Data
              Hub. Try one of these examples:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(q);
                  }}
                  className="text-xs"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                    {message.error && (
                      <p className="text-sm text-destructive mt-2">
                        Error: {message.error}
                      </p>
                    )}
                    {message.role === "assistant" && renderResults(message)}
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 pt-4 border-t mt-auto">
          <Textarea
            placeholder="Ask a question about your data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
