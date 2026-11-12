import { useEffect, useState } from "react";

/** Chrome/Edge/Android "install app" prompt event (not in the TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * One-tap install support. `canInstall` is true only when the browser has offered
 * an install prompt for the manifest currently linked on the page (Chrome/Edge/Android).
 * iPhone never offers this, so callers keep the manual Share → Add to Home Screen steps.
 */
export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferred) return false;
    const evt = deferred;
    deferred = null;
    notify();
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome === "accepted";
  };

  return { canInstall: deferred !== null, install, isStandalone: isStandaloneDisplay() };
}
