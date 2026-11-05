/** Trigger a same-origin file download from a Blob (client-generated export). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: Safari can cancel the save if the URL dies straight away.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Build a CSV Blob (with BOM so Excel opens accents correctly) and save it. */
export function downloadCsv(csv: string, filename: string) {
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), filename);
}
