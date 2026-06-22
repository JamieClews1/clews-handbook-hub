import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search } from "lucide-react";

export type PostcodeMatch = {
  postcode_prefix: string;
  zone_code: string;
  area: string | null;
  services: string | null;
};

const ZONE_CODE_MAP: Record<string, string> = {
  "Zone 1": "Z1",
  "Zone 2": "Z2",
  "Zone 3": "Z3",
  "Zone 3 RoRo Only": "Z3R",
  "Zone 4 RoRo Only": "Z4R",
};

export function PostcodeZoneChecker({
  onZoneResolved,
}: {
  onZoneResolved?: (cardZoneCode: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PostcodeMatch[] | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const q = query.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ");
    if (!q) return;
    setSearching(true);
    // try exact "AB12 3" prefix then broader outward code
    const outward = q.split(" ")[0];
    const { data } = await supabase
      .from("pricing_zone_postcodes")
      .select("postcode_prefix,zone_code,area,services")
      .or(`postcode_prefix.ilike.${q}%,postcode_prefix.ilike.${outward}%`)
      .order("postcode_prefix")
      .limit(15);
    const results = (data as PostcodeMatch[]) || [];
    setMatches(results);
    setSearching(false);
    if (results.length && onZoneResolved) {
      onZoneResolved(ZONE_CODE_MAP[results[0].zone_code] ?? null);
    } else if (onZoneResolved) {
      onZoneResolved(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Postcode → Zone Checker
        </CardTitle>
        <CardDescription>
          Type a postcode to find its delivery zone, then the matching column is highlighted on the rate cards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="e.g. CV21 3 or LE17"
            className="max-w-xs"
          />
          <Button onClick={search} disabled={searching}>
            <Search className="h-4 w-4 mr-1" /> Check
          </Button>
        </div>

        {matches && matches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No zone found for that postcode — this is likely a <strong>phone-for-quote</strong> area.
          </p>
        )}

        {matches && matches.length > 0 && (
          <div className="space-y-1.5">
            {matches.map((m) => (
              <div
                key={`${m.postcode_prefix}-${m.zone_code}`}
                className="flex items-center gap-3 text-sm border rounded-md px-3 py-2"
              >
                <code className="font-mono font-semibold w-20">{m.postcode_prefix}</code>
                <Badge variant="default">{m.zone_code}</Badge>
                <span className="text-muted-foreground truncate">{m.area}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
