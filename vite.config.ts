import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/

/** Newest modification time across the app sources, cached briefly. */
function newestSourceMtime(root: string): number {
  let newest = 0;
  const watch = (dir: string, depth: number) => {
    if (depth > 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        watch(full, depth + 1);
      } else {
        try {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > newest) newest = mtime;
        } catch {
          /* file vanished mid-scan */
        }
      }
    }
  };
  watch(path.join(root, "src"), 0);
  for (const extra of ["index.html", "package.json", "tailwind.config.ts"]) {
    try {
      const mtime = fs.statSync(path.join(root, extra)).mtimeMs;
      if (mtime > newest) newest = mtime;
    } catch {
      /* optional file */
    }
  }
  return Math.round(newest);
}

/**
 * Stamp the served page with the newest source change so already-open tabs can
 * notice a newer build. In dev the page always loads the same module URLs, so
 * without this stamp a tab has no way to detect that the code behind it changed.
 */
function buildStampPlugin() {
  const root = process.cwd();
  let cached = 0;
  let cachedAt = 0;
  return {
    name: "lovable-build-stamp",
    apply: "serve" as const,
    transformIndexHtml(html: string) {
      const now = Date.now();
      if (now - cachedAt > 1500) {
        cached = newestSourceMtime(root);
        cachedAt = now;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { src: `/build-stamp.js?ts=${cached}` },
            injectTo: "head-prepend" as const,
          },
        ],
      };
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && buildStampPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
