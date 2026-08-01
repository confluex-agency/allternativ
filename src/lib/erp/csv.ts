// Minimal RFC-4180 CSV helpers. No dependency: we only ever handle our own
// order exports and the tracking sheets the supplier sends back.

/** Quote a value only when it needs it (comma, quote, newline or edge spaces). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s) || s !== s.trim()) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialise rows to CSV text.
 * `bom` prepends a UTF-8 BOM so Excel (and Dianxiaomi's importer, which expects
 * Excel-flavoured files) reads accents and Chinese characters correctly.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  { bom = true }: { bom?: boolean } = {},
): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return (bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}

/**
 * Parse CSV text into row objects keyed by the header line.
 * Handles quoted fields, escaped quotes, CRLF/LF, and a leading BOM.
 * Rows with fewer cells than headers are padded with "".
 */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") {
      // swallow: the \n that follows closes the row
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  // Trailing cell/row when the file doesn't end in a newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}
