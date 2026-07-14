import { useCallback, useEffect, useState } from "react";

/**
 * Persist sidebar group open/closed state per user in localStorage.
 * Falls back to the provided default when nothing is stored.
 */
export function useSidebarGroupState(key: string, defaultOpen: boolean) {
  const storageKey = `w1.sidebar.group.${key}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return defaultOpen;
    return raw === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [storageKey, open]);

  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);

  return [open, handleOpenChange] as const;
}
