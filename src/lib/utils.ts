import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function compareAssetNumbers(a: string, b: string): number {
  const parse = (s: string) => {
    const clean = s.replace(/\s+/g, "").toLowerCase();
    const m = clean.match(/^([a-z]+)(\d+)(?:-(.*))?$/);
    if (!m) return { prefix: clean, num: 0, suffix: clean };
    return { prefix: m[1], num: Number(m[2]), suffix: m[3] || "" };
  };

  const aP = parse(a);
  const bP = parse(b);

  const prefixCmp = aP.prefix.localeCompare(bP.prefix);
  if (prefixCmp !== 0) return prefixCmp;
  if (aP.num !== bP.num) return aP.num - bP.num;
  if (!aP.suffix && !bP.suffix) return 0;
  if (!aP.suffix) return -1;
  if (!bP.suffix) return 1;
  return aP.suffix.localeCompare(bP.suffix);
}
