import { useMemo, useState } from "react";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pin, PinOff, Pencil, Trash2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Conversation = { id: string; title: string; pinned: boolean; updated_at: string };

interface Props {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (c: Conversation) => void;
  onDelete: (id: string) => void;
}

function groupOf(c: Conversation): string {
  if (c.pinned) return "Pinned";
  const d = new Date(c.updated_at);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isAfter(d, subDays(new Date(), 7))) return "Last 7 days";
  return "Older";
}
const ORDER = ["Pinned", "Today", "Yesterday", "Last 7 days", "Older"];

export function ConversationList({ conversations, activeId, onSelect, onNew, onRename, onTogglePin, onDelete }: Props) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const filtered = conversations.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
    const map = new Map<string, Conversation[]>();
    for (const c of filtered) {
      const g = groupOf(c);
      map.set(g, [...(map.get(g) || []), c]);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => ({ name: g, items: map.get(g)! }));
  }, [conversations, q]);

  const commit = (id: string) => {
    const t = draft.trim();
    if (t) onRename(id, t);
    setEditing(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" size="sm">
          <Plus className="h-4 w-4" /> New conversation
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="h-8 pl-8 text-sm" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No conversations yet</p>}
        {groups.map((g) => (
          <div key={g.name} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.name}</p>
            {g.items.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                  c.id === activeId ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                )}
              >
                {editing === c.id ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(c.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(c.id); if (e.key === "Escape") setEditing(null); }}
                    className="h-7 text-sm"
                  />
                ) : (
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(c.id)} title={c.title}>
                    {c.title}
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="Conversation options">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(c.id); setDraft(c.title); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTogglePin(c)}>
                      {c.pinned ? <PinOff className="mr-2 h-3.5 w-3.5" /> : <Pin className="mr-2 h-3.5 w-3.5" />}
                      {c.pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c.id)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
