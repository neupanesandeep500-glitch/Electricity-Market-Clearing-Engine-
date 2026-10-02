/**
 * Google Sheets Live Extractor Service
 * Fetches real-time market data from Google Sheets via Visualization API or Backend Proxy
 */

export interface FetchSheetOptions {
  sheetId: string;
  sheetName?: string;
  useProxy?: boolean;
}

export const DEFAULT_SHEET_ID = '17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg';
export const DEFAULT_SHEET_NAME = 'Form Responses 1';
export const DEFAULT_GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform';

/**
 * Extract Sheet ID from a full Google Sheet URL or raw ID
 */
export function extractSheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_SHEET_ID;

  // Regex to extract from https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Already an ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Fetch raw CSV from Google Sheet
 */
export async function fetchSheetCSV(options: FetchSheetOptions): Promise<{ csv: string; source: 'direct' | 'proxy' }> {
  const sheetId = extractSheetId(options.sheetId);
  const sheetName = options.sheetName || DEFAULT_SHEET_NAME;

  // 1. Try server-side proxy route first (avoids any browser CORS issues)
  try {
    const proxyUrl = `/api/fetch-sheet?sheetId=${encodeURIComponent(sheetId)}&sheetName=${encodeURIComponent(sheetName)}`;
    const res = await fetch(proxyUrl, { headers: { Accept: 'text/csv, text/plain' } });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 20 && !text.includes('<!DOCTYPE html>')) {
        return { csv: text, source: 'proxy' };
      }
    }
  } catch {
    // server proxy failed or not available, proceed to direct fetch
  }

  // 2. Direct client fetch via Google Visualization query
  const directUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=0`,
  ];

  let lastError: Error | null = null;
  for (const url of directUrls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 20 && !text.includes('<!DOCTYPE html>')) {
          return { csv: text, source: 'direct' };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    lastError?.message ||
      'Could not access Google Sheet. Please ensure the sheet has "Anyone with the link can view" enabled, or use the proxy.'
  );
}
