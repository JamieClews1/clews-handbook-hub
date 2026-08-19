import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Building2, FolderOpen, Inbox } from "lucide-react";

export interface FolderTicket {
  id: string;
  customer_id: string | null;
  is_read: boolean;
  status: string;
}

interface Props {
  tickets: FolderTicket[];
  customerNames: Record<string, string>;
  value: string | null; // customer id, "unassigned", or null = all
  onChange: (value: string | null) => void;
}

/** Left-hand customer folder list for the CRM inbox. */
export function CrmCustomerFolders({ tickets, customerNames, value, onChange }: Props) {
  const [q, setQ] = useState("");

  const folders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; unread: number }>();
    let unassignedTotal = 0;
    let unassignedUnread = 0;
    for (const t of tickets) {
      if (!t.customer_id) {
        unassignedTotal++;
        if (!t.is_read) unassignedUnread++;
        continue;
      }
      const name = customerNames[t.customer_id] ?? "Unknown customer";
      const entry = map.get(t.customer_id) ?? { id: t.customer_id, name, total: 0, unread: 0 };
      entry.total++;
      if (!t.is_read) entry.unread++;
      map.set(t.customer_id, entry);
    }
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { list, unassignedTotal, unassignedUnread };
  }, [tickets, customerNames]);

  const search = q.trim().toLowerCase();
  const visible = search
    ? folders.list.filter((f) => f.name.toLowerCase().includes(search))
    : folders.list;

  const row = (
    key: string,
    label: string,
    icon: React.ReactNode,
    total: number,
    unread: number,
    selected: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors border",
        selected ? "bg-accent border-border" : "border-transparent hover:bg-muted/50",
      )}
    >
      {icon}
      <span className={cn("truncate flex-1", unread > 0 && "font-semibold")}>{label}</span>
      {unread > 0 && (
        <Badge variant="default" className="h-5 px-1.5 text-[10px]">
          {unread}
        </Badge>
      )}
      <span className="text-[10px] text-muted-foreground w-6 text-right">{total}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      <Input
        placeholder="Find customer…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />
      <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1">
        {row(
          "all",
          "All mail",
          <Inbox className="h-4 w-4 text-muted-foreground shrink-0" />,
          tickets.length,
          tickets.filter((t) => !t.is_read).length,
          value === null,
          () => onChange(null),
        )}
        {row(
          "unassigned",
          "Unlinked",
          <FolderOpen className="h-4 w-4 text-amber-600 shrink-0" />,
          folders.unassignedTotal,
          folders.unassignedUnread,
          value === "unassigned",
          () => onChange("unassigned"),
        )}
        <div className="pt-2 pb-1 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          Customers
        </div>
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3">No customer folders yet.</p>
        ) : (
          visible.map((f) =>
            row(
              f.id,
              f.name,
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />,
              f.total,
              f.unread,
              value === f.id,
              () => onChange(f.id),
            ),
          )
        )}
      </div>
    </div>
  );
}
