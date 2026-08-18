/**
 * Remembers a picked folder (File System Access API) in IndexedDB so the
 * next upload reads straight from that folder without a file dialog.
 */
const DB_NAME = "wasteone-folders";
const STORE = "handles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFolderHandle(key: string, handle: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle as any, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable */
  }
}

export async function getFolderHandle(key: string): Promise<any | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearFolderHandle(key: string) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
  } catch {
    /* ignore */
  }
}

/** Ensure we still have read permission on a stored handle. */
export async function ensureReadPermission(handle: any): Promise<boolean> {
  if (!handle?.queryPermission) return false;
  const opts = { mode: "read" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  try {
    return (await handle.requestPermission(opts)) === "granted";
  } catch {
    return false;
  }
}

/** Read all PDFs directly out of a directory handle. */
export async function readPdfsFromDirectory(dir: any): Promise<File[]> {
  const files: File[] = [];
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === "file" && /\.pdf$/i.test(handle.name)) files.push(await handle.getFile());
  }
  return files;
}

/**
 * Get PDFs from the remembered folder, or prompt once and remember it.
 * Returns null when the browser can't do folder picking or the user cancels.
 */
export async function pickPdfsFromRememberedFolder(
  key: string,
): Promise<{ files: File[]; folderName: string } | null> {
  const picker = (window as any).showDirectoryPicker;
  if (typeof picker !== "function" || window.self !== window.top) return null;

  const saved = await getFolderHandle(key);
  if (saved && (await ensureReadPermission(saved))) {
    try {
      return { files: await readPdfsFromDirectory(saved), folderName: saved.name };
    } catch {
      await clearFolderHandle(key);
    }
  }

  try {
    const dir = await picker.call(window, { id: key, mode: "read" });
    await saveFolderHandle(key, dir);
    return { files: await readPdfsFromDirectory(dir), folderName: dir.name };
  } catch (e: any) {
    if (e?.name === "AbortError") return { files: [], folderName: "" };
    return null;
  }
}
