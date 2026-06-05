import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.a9dfefed4d4b4e7dbca078f7aa930a7c",
  appName: "RouteOne Driver",
  webDir: "dist",
  server: {
    // The APK is a thin wrapper that loads the live published Driver App,
    // so drivers always get the latest version with no APK rebuild needed.
    // For local hot-reload during development, swap this URL for the sandbox
    // preview URL instead:
    // url: "https://a9dfefed-4d4b-4e7d-bca0-78f7aa930a7c.lovableproject.com?forceHideBadge=true",
    url: "https://clewshandbook.lovable.app/driver",
    cleartext: true,
  },
  android: {
    backgroundColor: "#0f172a",
  },
};

export default config;
