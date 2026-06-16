import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, BatteryMedium, Gauge, RefreshCw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverLocation {
  id: string;
  driver_id: string;
  driver_name: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  recorded_at: string;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // considered "live" if seen in last 5 min

const isOnline = (loc: DriverLocation) =>
  Date.now() - new Date(loc.recorded_at).getTime() < ONLINE_WINDOW_MS;

const initials = (name: string | null) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const markerIcon = (loc: DriverLocation): google.maps.Icon => {
  const online = isOnline(loc);
  const colour = online ? "#10b981" : "#9ca3af";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <path d="M20 1C10.6 1 3 8.6 3 18c0 12 17 28 17 28s17-16 17-28C37 8.6 29.4 1 20 1z"
        fill="${colour}" stroke="#fff" stroke-width="2"/>
      <text x="20" y="23" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="13" font-weight="700" fill="#fff">${initials(loc.driver_name)}</text>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 48),
    anchor: new google.maps.Point(20, 46),
  };
};

const popupHtml = (loc: DriverLocation) =>
  `<div style="font-size:12px;line-height:1.4;"><strong>${loc.driver_name ?? "Driver"}</strong><br/>${
    isOnline(loc) ? "Live" : "Last seen"
  } ${formatDistanceToNow(new Date(loc.recorded_at), { addSuffix: true })}</div>`;

const DriverTrackingMap = () => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const fittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: locations = [], refetch, isFetching } = useQuery({
    queryKey: ["driver-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DriverLocation[];
    },
    refetchInterval: 20000,
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("driver-locations-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: 52.6, lng: -2.0 },
          zoom: 9,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err) => console.error("Google Maps failed to load", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync markers with data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const seen = new Set<string>();
    const bounds = new google.maps.LatLngBounds();

    for (const loc of locations) {
      seen.add(loc.driver_id);
      const position = { lat: loc.latitude, lng: loc.longitude };
      bounds.extend(position);

      const existing = markersRef.current[loc.driver_id];
      if (existing) {
        existing.setPosition(position);
        existing.setIcon(markerIcon(loc));
      } else {
        const marker = new google.maps.Marker({
          position,
          map,
          icon: markerIcon(loc),
          title: loc.driver_name ?? "Driver",
        });
        marker.addListener("click", () => {
          setSelectedId(loc.driver_id);
          infoWindowRef.current?.setContent(popupHtml(loc));
          infoWindowRef.current?.open({ map, anchor: marker });
        });
        markersRef.current[loc.driver_id] = marker;
      }
    }

    // Remove markers for drivers no longer present
    for (const [driverId, marker] of Object.entries(markersRef.current)) {
      if (!seen.has(driverId)) {
        marker.setMap(null);
        delete markersRef.current[driverId];
      }
    }

    // Fit bounds on first load only
    if (locations.length && !fittedRef.current) {
      map.fitBounds(bounds, 50);
      fittedRef.current = true;
    }
  }, [locations, mapReady]);

  const focusDriver = (loc: DriverLocation) => {
    setSelectedId(loc.driver_id);
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat: loc.latitude, lng: loc.longitude });
    map.setZoom(15);
    const marker = markersRef.current[loc.driver_id];
    if (marker) {
      infoWindowRef.current?.setContent(popupHtml(loc));
      infoWindowRef.current?.open({ map, anchor: marker });
    }
  };



  const onlineCount = useMemo(() => locations.filter(isOnline).length, [locations]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">
      {/* Driver list */}
      <Card className="lg:w-80 shrink-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Drivers</p>
            <p className="text-xs text-muted-foreground">
              {onlineCount} live · {locations.length} tracked
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
        <div className="overflow-y-auto divide-y">
          {locations.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No driver locations yet. Drivers appear here once they log in to the
              Driver App with location sharing enabled.
            </div>
          )}
          {locations.map((loc) => {
            const online = isOnline(loc);
            return (
              <button
                key={loc.driver_id}
                onClick={() => focusDriver(loc)}
                className={cn(
                  "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                  selectedId === loc.driver_id && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">
                    {loc.driver_name ?? "Driver"}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] shrink-0",
                      online
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1",
                        online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground",
                      )}
                    />
                    {online ? "Live" : "Offline"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {formatDistanceToNow(new Date(loc.recorded_at), { addSuffix: true })}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {loc.speed != null && (
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {Math.round((loc.speed ?? 0) * 2.23694)} mph
                    </span>
                  )}
                  {loc.battery_level != null && (
                    <span className="flex items-center gap-1">
                      <BatteryMedium className="h-3 w-3" />
                      {Math.round(loc.battery_level)}%
                    </span>
                  )}
                  {loc.accuracy != null && (
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" />±{Math.round(loc.accuracy)}m
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Map */}
      <Card className="flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full h-full min-h-[300px]" />
      </Card>
    </div>
  );
};

export default DriverTrackingMap;
