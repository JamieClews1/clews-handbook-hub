import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Camera, PackagePlus, Loader2, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const SEEN_KEY = "stock-inventory-notifications-seen";

type Item = {
  id: string;
  kind: "asset" | "photos";
  asset_number: string;
  asset_type: string | null;
  at: string;
  by: string | null;
  photoCount: number;
  location: string | null;
};

const photoCount = (photos: unknown) =>
  Array.isArray(photos) ? photos.length : 0;

export const StockCheckNotifications = () => {
  const [days, setDays] = useState("30");
  const [seenAt, setSeenAt] = useState<string | null>(() =>
    localStorage.getItem(SEEN_KEY),
  );

  const since = useMemo(
    () => new Date(Date.now() - Number(days) * 86400000).toISOString(),
    [days],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["stock-inventory-notifications", since],
    queryFn: async () => {
      const [assets, reports] = await Promise.all([
        supabase
          .from("skip_inventory")
          .select(
            "id, asset_number, asset_type, created_at, last_reported_by, last_location, photos",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        supabase
          .from("skip_tracker_reports")
          .select(
            "id, asset_number, asset_type, created_at, reporter_name, location, photos",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
      ]);
      if (assets.error) throw assets.error;
      if (reports.error) throw reports.error;

      const items: Item[] = [];
      for (const a of assets.data || []) {
        items.push({
          id: `a-${a.id}`,
          kind: "asset",
          asset_number: a.asset_number,
          asset_type: a.asset_type,
          at: a.created_at as string,
          by: a.last_reported_by,
          photoCount: photoCount(a.photos),
          location: a.last_location,
        });
      }
      for (const r of reports.data || []) {
        const count = photoCount(r.photos);
        if (!count) continue;
        items.push({
          id: `p-${r.id}`,
          kind: "photos",
          asset_number: r.asset_number,
          asset_type: r.asset_type,
          at: r.created_at as string,
          by: r.reporter_name,
          photoCount: count,
          location: r.location,
        });
      }
      return items.sort((x, y) => y.at.localeCompare(x.at));
    },
  });

  const items = data || [];
  const newAssets = items.filter((i) => i.kind === "asset");
  const newPhotos = items.filter((i) => i.kind === "photos");
  const unread = items.filter((i) => !seenAt || i.at > seenAt).length;

  const markSeen = () => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setSeenAt(now);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unread > 0 && (
              <Badge className="ml-1">{unread} new</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            New containers added to inventory and new photos logged, with who
            added them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={markSeen}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              New containers
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {newAssets.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Photo uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {newPhotos.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Photos added
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {newPhotos.reduce((s, i) => s + i.photoCount, 0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No inventory activity in this period.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((i) => {
                const isNew = !seenAt || i.at > seenAt;
                return (
                  <div
                    key={i.id}
                    className={cn(
                      "flex items-start gap-3 py-3",
                      isNew && "bg-primary/5 -mx-2 px-2 rounded-md",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 rounded-md p-2",
                        i.kind === "asset"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-blue-500/15 text-blue-700",
                      )}
                    >
                      {i.kind === "asset" ? (
                        <PackagePlus className="h-4 w-4" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {i.kind === "asset"
                          ? `New ${i.asset_type || "container"} added: ${i.asset_number}`
                          : `${i.photoCount} photo${i.photoCount > 1 ? "s" : ""} added to ${i.asset_number}`}
                        {isNew && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            New
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.by ? `By ${i.by}` : "By unknown"}
                        {i.location ? ` · ${i.location}` : ""}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(i.at), "d MMM yyyy HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
