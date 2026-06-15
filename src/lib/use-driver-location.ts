import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { driverAction } from "@/lib/driver-api";

/**
 * Continuously reports a driver's GPS position to the backend while they are
 * logged in to the Driver App.
 *
 * - On a native build (the RouteOne Driver APK) it uses the
 *   @capacitor-community/background-geolocation plugin so location keeps
 *   updating even when the phone is locked / the app is backgrounded.
 * - On the web / PWA it falls back to the browser Geolocation API, which only
 *   runs while the app is open and on screen.
 *
 * Positions are throttled so we never write more than once every MIN_INTERVAL.
 */

const MIN_INTERVAL_MS = 15_000; // don't write more often than every 15s

type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
};

async function readBattery(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (typeof nav.getBattery === "function") {
      const b = await nav.getBattery();
      return Math.round(b.level * 100);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useDriverLocationTracking(
  driverId: string | undefined,
  driverName: string | undefined,
  enabled: boolean = true,
) {
  const lastSentRef = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !driverId) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const report = async (c: Coords) => {
      const now = Date.now();
      if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
      if (sendingRef.current) return;
      sendingRef.current = true;
      lastSentRef.current = now;
      try {
        const battery_level = await readBattery();
        await driverAction("update_location", {
          driver_id: driverId,
          driver_name: driverName ?? null,
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy: c.accuracy ?? null,
          speed: c.speed ?? null,
          heading: c.heading ?? null,
          battery_level,
        });
      } catch (err) {
        console.warn("location report failed", err);
      } finally {
        sendingRef.current = false;
      }
    };

    const startNative = async () => {
      try {
        const { BackgroundGeolocation } = await import(
          "@capacitor-community/background-geolocation"
        );
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Location is shared with dispatch while you are on shift.",
            backgroundTitle: "RouteOne tracking active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 25, // metres before a new update
          },
          (location, error) => {
            if (error || !location) return;
            report({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              speed: location.speed,
              heading: location.bearing,
            });
          },
        );
        if (cancelled) {
          BackgroundGeolocation.removeWatcher({ id: watcherId });
          return;
        }
        cleanup = () => {
          BackgroundGeolocation.removeWatcher({ id: watcherId });
        };
      } catch (err) {
        console.warn("native background geolocation unavailable, falling back to web", err);
        startWeb();
      }
    };

    const startWeb = () => {
      if (!("geolocation" in navigator)) return;
      const id = navigator.geolocation.watchPosition(
        (pos) =>
          report({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          }),
        (err) => console.warn("geolocation error", err),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
      );
      cleanup = () => navigator.geolocation.clearWatch(id);
    };

    if (Capacitor.isNativePlatform()) {
      startNative();
    } else {
      startWeb();
    }

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [driverId, driverName, enabled]);
}
