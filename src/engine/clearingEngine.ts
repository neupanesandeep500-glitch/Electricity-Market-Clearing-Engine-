/**
 * Vectorised Electricity Market Clearing Algorithm & Data Parser (V5.0)
 * Faithful implementation of the Nepal Electricity Market Clearing Engine.
 * Supports: Google Form / Google Sheets output, CSV input, and Demo data.
 */

import {
  RawBidOfferRecord,
  AcceptedParticipant,
  SlotClearingResult,
  DiagnosticsData,
  SettlementRecord,
  ParticipantSummaryItem,
  ParticipantRole,
  AcceptanceStatus,
} from '../types';

export const MAX_VALID_PRICE = 1000.0;   // NRs/kWh ceiling
export const MAX_VALID_QTY = 100000.0;   // MW ceiling
export const DEFAULT_FALLBACK_SLOTS = 4;
export const SLOT_HOURS = 0.25; // each trading slot is 15 minutes

/**
 * Energy in MWh for a MW quantity held for one slot. Not rounded: rounding happens once, on money.
 */
export const mwToMwh = (mw: number): number => mw * SLOT_HOURS;

/** Exact settlement value in whole paisa (1/100 NRs): MCP [NRs/kWh] x MWh x 1000 kWh/MWh x 100. */
export const settlementCents = (mcp: number, mw: number): number =>
  Math.round(mcp * mwToMwh(mw) * 1000 * 100 + 1e-7);

/**
 * Split a slot's total value (in paisa) across accepted participants so that the parts add up to
 * the total EXACTLY. Each share is floored, then the leftover paisa go to the largest remainders.
 * This is what keeps "buyers pay" equal to "sellers receive" to the last paisa.
 */
export function allocateSettlement(accepted: AcceptedParticipant[], mcp: number, totalCents: number): AcceptedParticipant[] {
  const exact = accepted.map((a) => mcp * mwToMwh(a.qty_accepted) * 1000 * 100);
  const floors = exact.map((x) => Math.floor(x + 1e-7));
  let leftover = totalCents - floors.reduce((a, b) => a + b, 0);
  const amounts = [...floors];
  if (leftover >= 0 && leftover <= accepted.length) {
    const order = exact
      .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-7) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; k < leftover; k++) amounts[order[k].i]++;
  } else {
    // Should never happen; fall back to plain rounding rather than distorting amounts.
    exact.forEach((x, i) => (amounts[i] = Math.round(x)));
  }
  return accepted.map((a, i) => ({ ...a, amount_nrs: amounts[i] / 100 }));
}

/**
 * A participant who submits the form twice must not be counted twice. Keep the most recent
 * submission for each participant, side and slot (later timestamp wins; row order breaks ties).
 */
export function dedupeSubmissions<T extends RawBidOfferRecord>(list: T[]): { kept: T[]; removed: number } {
  const best = new Map<string, T>();
  const ts = (r: T) => {
    const t = r.timestamp ? new Date(r.timestamp).getTime() : NaN;
    return isNaN(t) ? null : t;
  };
  const isLater = (a: T, b: T) => {
    const ta = ts(a);
    const tb = ts(b);
    if (ta !== null && tb !== null && ta !== tb) return ta > tb;
    return a.row_order > b.row_order;
  };
  for (const r of list) {
    const key = `${r.role}|${r.name}|${r.slot}`;
    const cur = best.get(key);
    if (!cur || isLater(r, cur)) best.set(key, r);
  }
  const keptSet = new Set(best.values());
  return { kept: list.filter((r) => keptSet.has(r)), removed: list.length - keptSet.size };
}

export const COL_MAP = {
  role: ['i am a', 'role', 'type', 'buyer or seller'],
  name: ['select your id', 'select  your id', 'name', 'organization', 'participant', 'enter your id', 'your id'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  price: ['rate', 'price', 'rs/kwh', 'nrs/kwh', 'bid price', 'offer price'],
  qty: ['power', 'quantity', 'kwh', 'volume', 'mw', 'select power'],
  timestamp: ['timestamp', 'time stamp', 'submitted at', 'submission time'],
};

/**
 * Detect column header containing any of the keywords
 */
export function detectColumn(headers: string[], keywords: string[]): string | null {
  for (const h of headers) {
    const hl = h.toLowerCase();
    if (keywords.some((kw) => hl.includes(kw.toLowerCase()))) {
      return h;
    }
  }
  return null;
}

/**
 * Auto-detect the number of time slots from column headers
 */
export function detectNSlots(headers: string[]): number {
  const slotNums = new Set<number>();
  const patterns = [
    /for\s+t(\d+)\s*:/i,
    /\bt(\d+)\s*:/i,
    /for\s+t(\d+)\b/i,
    /time\s+slot\s+(\d+)/i,
    /\bslot\s*(\d+)/i,
    /\bts(\d+)[_\s]/i,
  ];

  for (const col of headers) {
    for (const pat of patterns) {
      const match = col.match(pat);
      if (match && match[1]) {
        slotNums.add(parseInt(match[1], 10));
      }
    }
  }

  return slotNums.size > 0 ? Math.max(...Array.from(slotNums)) : DEFAULT_FALLBACK_SLOTS;
}

/**
 * Safe numeric conversion
 */
export function safeFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();
  if (str === '' || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null') return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Build per-slot column map from headers
 */
export function buildSlotColumnMap(headers: string[]): Map<number, { price: string[]; qty: string[] }> {
  const slotMap = new Map<number, { price: string[]; qty: string[] }>();
  const slotPatterns = [
    /for\s+t(\d+)\s*:/i,
    /\bt(\d+)\s*:/i,
    /for\s+t(\d+)\b/i,
    /time\s+slot\s+(\d+)/i,
    /\bslot\s*(\d+)/i,
    /\bts(\d+)[_\s]/i,
  ];

  for (const col of headers) {
    const cl = col.toLowerCase();
    let slotNum: number | null = null;
    for (const pat of slotPatterns) {
      const m = cl.match(pat);
      if (m && m[1]) {
        slotNum = parseInt(m[1], 10);
        break;
      }
    }
    if (slotNum === null) continue;

    if (!slotMap.has(slotNum)) {
      slotMap.set(slotNum, { price: [], qty: [] });
    }
    const entry = slotMap.get(slotNum)!;

    if (COL_MAP.price.some((kw) => cl.includes(kw))) {
      entry.price.push(col);
    } else if (COL_MAP.qty.some((kw) => cl.includes(kw))) {
      entry.qty.push(col);
    }
  }

  return slotMap;
}

/**
 * Robust CSV Line Parser that handles quoted values with commas
 */
export function parseCSVToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse Google Form / Sheet CSV into structured bids and offers
 */
export function parseResponses(csvText: string, forcedSlots?: number): {
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  diagnostics: DiagnosticsData;
  n_slots: number;
} {
  const rows = parseCSVToRows(csvText);

  const emptyDiagnostics: DiagnosticsData = {
    rows_seen: 0,
    rows_skipped_no_role: 0,
    values_dropped_nan: 0,
    values_dropped_nonpos: 0,
    values_dropped_outlier: 0,
    records_kept: 0,
    timestamp_col_found: false,
    unique_buyers: 0,
    unique_sellers: 0,
    missing_email_buyers: 0,
    missing_email_sellers: 0,
    incomplete_buyers: 0,
    incomplete_sellers: 0,
    duplicate_buyer_rows: 0,
    duplicate_seller_rows: 0,
    participants_on_both_sides: 0,
  };

  if (rows.length < 2) {
    return { buyers: [], sellers: [], diagnostics: emptyDiagnostics, n_slots: DEFAULT_FALLBACK_SLOTS };
  }

  // 1. Process headers and disambiguate duplicates (append .1, .2 ...)
  const rawHeaders = rows[0];
  const headers: string[] = [];
  const seenHeaderCount = new Map<string, number>();

  for (const h of rawHeaders) {
    const count = seenHeaderCount.get(h) || 0;
    if (count > 0) {
      headers.push(`${h}.${count}`);
    } else {
      headers.push(h);
    }
    seenHeaderCount.set(h, count + 1);
  }

  const n_slots = forcedSlots || detectNSlots(headers);
  const diagnostics: DiagnosticsData = { ...emptyDiagnostics };

  // 2. Locate role, name, email, timestamp columns
  let roleCol = detectColumn(headers, COL_MAP.role);
  const nameCols = headers.filter((c) => COL_MAP.name.some((kw) => c.toLowerCase().includes(kw)));
  const emailCols = headers.filter((c) => COL_MAP.email.some((kw) => c.toLowerCase().includes(kw)));
  const tsCols = headers.filter((c) => COL_MAP.timestamp.some((kw) => c.toLowerCase().includes(kw)));
  const tsCol = tsCols.length > 0 ? tsCols[0] : null;
  diagnostics.timestamp_col_found = tsCol !== null;

  // Header index map
  const headerIdx = new Map<string, number>();
  headers.forEach((h, i) => headerIdx.set(h, i));

  // If roleCol was not matched by keyword, look for column containing 'buyer' or 'seller' values
  if (!roleCol) {
    for (let c = 0; c < headers.length; c++) {
      const sampleVals = rows.slice(1, Math.min(10, rows.length)).map((r) => (r[c] || '').toLowerCase().trim());
      if (sampleVals.some((v) => v.includes('buyer') || v.includes('seller'))) {
        roleCol = headers[c];
        break;
      }
    }
  }

  const slotMap = buildSlotColumnMap(headers);
  const records: RawBidOfferRecord[] = [];

  // 3. Process rows
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    diagnostics.rows_seen++;
    const row = rows[rowIdx];
    const roleVal = roleCol ? (row[headerIdx.get(roleCol)!] || '').trim().toLowerCase() : '';

    let role: ParticipantRole | null = null;
    if (roleVal.includes('buyer')) role = 'buyer';
    else if (roleVal.includes('seller')) role = 'seller';

    if (!role) {
      diagnostics.rows_skipped_no_role++;
      continue;
    }

    // Name: pick first non-empty across name columns
    let name = `Participant ${rowIdx}`;
    for (const nc of nameCols) {
      const val = (row[headerIdx.get(nc)!] || '').trim();
      if (val && val.toLowerCase() !== 'nan' && val.toLowerCase() !== 'null') {
        name = val;
        break;
      }
    }

    // Email: pick first valid email
    let email = '';
    for (const ec of emailCols) {
      const val = (row[headerIdx.get(ec)!] || '').trim();
      if (val && val.includes('@') && val.toLowerCase() !== 'nan') {
        email = val;
        break;
      }
    }

    // Timestamp
    let timestamp: string | null = null;
    if (tsCol) {
      const val = (row[headerIdx.get(tsCol)!] || '').trim();
      if (val) timestamp = val;
    }

    const occurrence = role === 'buyer' ? 1 : 0;

    for (let s = 1; s <= n_slots; s++) {
      let priceVal: number | null = null;
      let qtyVal: number | null = null;

      // Check TS{s}_Price format
      const tsPriceCol = `TS${s}_Price`;
      const tsQtyCol = `TS${s}_Quantity`;
      if (headerIdx.has(tsPriceCol)) {
        priceVal = safeFloat(row[headerIdx.get(tsPriceCol)!]);
        qtyVal = safeFloat(row[headerIdx.get(tsQtyCol)!]);
      } else if (slotMap.has(s)) {
        const slotEntry = slotMap.get(s)!;
        const pickVal = (cols: string[], idx: number) => {
          if (cols.length === 0) return null;
          const col = idx < cols.length ? cols[idx] : cols[0];
          return safeFloat(row[headerIdx.get(col)!]);
        };

        priceVal = pickVal(slotEntry.price, occurrence);
        qtyVal = pickVal(slotEntry.qty, occurrence);

        // Fallback to opposite occurrence if empty
        if (priceVal === null || priceVal <= 0) {
          priceVal = pickVal(slotEntry.price, 1 - occurrence);
        }
        if (qtyVal === null || qtyVal <= 0) {
          qtyVal = pickVal(slotEntry.qty, 1 - occurrence);
        }
      }

      if (priceVal === null || qtyVal === null) {
        diagnostics.values_dropped_nan++;
        continue;
      }
      if (priceVal <= 0 || qtyVal <= 0) {
        diagnostics.values_dropped_nonpos++;
        continue;
      }
      if (priceVal > MAX_VALID_PRICE || qtyVal > MAX_VALID_QTY) {
        diagnostics.values_dropped_outlier++;
        continue;
      }

      diagnostics.records_kept++;
      records.push({
        name,
        email,
        role,
        slot: s,
        price: Number(priceVal.toFixed(3)),
        quantity: Number(qtyVal.toFixed(3)),
        timestamp,
        row_order: rowIdx,
      });
    }
  }

  // Resubmissions: keep only each participant's latest entry per slot (otherwise volume is double counted).
  const deduped = dedupeSubmissions(records);
  const buyers = deduped.kept.filter((r) => r.role === 'buyer');
  const sellers = deduped.kept.filter((r) => r.role === 'seller');
  diagnostics.records_kept = deduped.kept.length;

  // Compute diagnostics statistics
  const buyerNames = new Set(buyers.map((b) => b.name));
  const sellerNames = new Set(sellers.map((s) => s.name));
  diagnostics.unique_buyers = buyerNames.size;
  diagnostics.unique_sellers = sellerNames.size;

  // Missing email check
  const buyerEmailMap = new Map<string, boolean>();
  for (const b of buyers) {
    if (b.email && b.email.includes('@')) buyerEmailMap.set(b.name, true);
  }
  diagnostics.missing_email_buyers = Array.from(buyerNames).filter((n) => !buyerEmailMap.get(n)).length;

  const sellerEmailMap = new Map<string, boolean>();
  for (const s of sellers) {
    if (s.email && s.email.includes('@')) sellerEmailMap.set(s.name, true);
  }
  diagnostics.missing_email_sellers = Array.from(sellerNames).filter((n) => !sellerEmailMap.get(n)).length;

  // Slot coverage check
  const buyerSlotCount = new Map<string, Set<number>>();
  buyers.forEach((b) => {
    if (!buyerSlotCount.has(b.name)) buyerSlotCount.set(b.name, new Set());
    buyerSlotCount.get(b.name)!.add(b.slot);
  });
  diagnostics.incomplete_buyers = Array.from(buyerSlotCount.values()).filter((set) => set.size < n_slots).length;

  const sellerSlotCount = new Map<string, Set<number>>();
  sellers.forEach((s) => {
    if (!sellerSlotCount.has(s.name)) sellerSlotCount.set(s.name, new Set());
    sellerSlotCount.get(s.name)!.add(s.slot);
  });
  diagnostics.incomplete_sellers = Array.from(sellerSlotCount.values()).filter((set) => set.size < n_slots).length;

  // Duplicate (re)submissions that were superseded by a later entry
  diagnostics.duplicate_buyer_rows = records.filter((r) => r.role === 'buyer').length - buyers.length;
  diagnostics.duplicate_seller_rows = records.filter((r) => r.role === 'seller').length - sellers.length;
  diagnostics.participants_on_both_sides = Array.from(buyerNames).filter((n) => sellerNames.has(n)).length;

  return { buyers, sellers, diagnostics, n_slots };
}

/**
 * Binary search lookup on step curve
 */
function priceOnCurve(prices: number[], cumQtys: number[], q: number, side: 'demand' | 'supply'): number {
  if (cumQtys.length === 0) return side === 'demand' ? 0.0 : Infinity;

  // find first index where cumQtys[idx] >= q
  let low = 0;
  let high = cumQtys.length - 1;
  let idx = cumQtys.length;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cumQtys[mid] >= q - 1e-9) {
      idx = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (idx >= cumQtys.length) {
    return side === 'demand' ? 0.0 : Infinity;
  }
  return prices[idx];
}

/**
 * Sort participants with deterministic FCFS tie-break
 */
export function sortParticipants(
  list: RawBidOfferRecord[],
  side: 'buyer' | 'seller'
): RawBidOfferRecord[] {
  return [...list].sort((a, b) => {
    // 1. Price
    // Prices are already rounded to 3 decimals at parse time, so compare them exactly.
    if (side === 'buyer') {
      if (a.price !== b.price) return b.price - a.price; // Descending
    } else {
      if (a.price !== b.price) return a.price - b.price; // Ascending
    }

    // 2. Timestamp tie-break (earlier first)
    if (a.timestamp && b.timestamp) {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
    }

    // 3. Row order fallback (deterministic FCFS)
    return a.row_order - b.row_order;
  });
}

/**
 * Apply partial acceptance allocation up to MCV MW
 */
export function applyPartialAcceptance(
  sortedList: RawBidOfferRecord[],
  mcp: number,
  mcv_mw: number,
  side: 'buyer' | 'seller'
): AcceptedParticipant[] {
  // Eligibility check
  const eligible = sortedList.filter((item) => {
    if (side === 'seller') {
      return item.price <= mcp + 1e-6;
    } else {
      return item.price >= mcp - 1e-6;
    }
  });

  const accepted: AcceptedParticipant[] = [];
  let remaining = mcv_mw;

  for (const item of eligible) {
    if (remaining <= 1e-6) break;

    if (item.quantity <= remaining + 1e-6) {
      // Full acceptance
      accepted.push({
        name: item.name,
        email: item.email,
        price: item.price,
        quantity: item.quantity,
        qty_accepted: Number(item.quantity.toFixed(4)),
        acceptance_status: 'Full',
      });
      remaining -= item.quantity;
    } else {
      // Partial acceptance
      const partialQty = Number(remaining.toFixed(4));
      if (partialQty > 1e-6) {
        accepted.push({
          name: item.name,
          email: item.email,
          price: item.price,
          quantity: item.quantity,
          qty_accepted: partialQty,
          acceptance_status: 'Partial',
        });
      }
      remaining = 0;
      break;
    }
  }

  return accepted;
}

/**
 * Run optimal market clearing for a single time slot
 * Quantity-Axis Scan Algorithm (fixes price-step aggregation errors)
 */
export function findMarketClearing(
  buyers: RawBidOfferRecord[],
  sellers: RawBidOfferRecord[],
  slot: number
): SlotClearingResult {
  const emptyResult: SlotClearingResult = {
    slot,
    status: 'No Trade',
    mcp: 0,
    mcv_mw: 0,
    mcv_mwh: 0,
    market_value: 0,
    clearing_mode: 'No Trade',
    total_demand: 0,
    total_supply: 0,
    accepted_buyers: [],
    accepted_sellers: [],
    all_buyers: [],
    all_sellers: [],
  };

  // Defensive: callers other than parseResponses (demo data, tests) get the same one-bid-per-slot rule.
  buyers = dedupeSubmissions(buyers).kept;
  sellers = dedupeSubmissions(sellers).kept;

  if (buyers.length === 0 || sellers.length === 0) {
    return emptyResult;
  }

  // 1. Sort curves with deterministic FCFS tie-break
  const bSorted = sortParticipants(buyers, 'buyer');
  const sSorted = sortParticipants(sellers, 'seller');

  const totalDemand = Number(bSorted.reduce((sum, item) => sum + item.quantity, 0).toFixed(6));
  const totalSupply = Number(sSorted.reduce((sum, item) => sum + item.quantity, 0).toFixed(6));

  // 2. Build cumulative step curves
  const bPrices = bSorted.map((b) => b.price);
  const sPrices = sSorted.map((s) => s.price);

  const bCumQty: number[] = [];
  let cumB = 0;
  for (const item of bSorted) {
    cumB += item.quantity;
    bCumQty.push(Number(cumB.toFixed(6)));
  }

  const sCumQty: number[] = [];
  let cumS = 0;
  for (const item of sSorted) {
    cumS += item.quantity;
    sCumQty.push(Number(cumS.toFixed(6)));
  }

  // 3. Candidate clearing volumes = every step-edge up to min(totalDemand, totalSupply)
  const maxPossible = Math.min(totalDemand, totalSupply);
  const candidateSet = new Set<number>();
  for (const q of bCumQty) {
    if (q > 1e-6 && q <= maxPossible + 1e-6) candidateSet.add(q);
  }
  for (const q of sCumQty) {
    if (q > 1e-6 && q <= maxPossible + 1e-6) candidateSet.add(q);
  }

  const candidates = Array.from(candidateSet).sort((a, b) => a - b);

  // 4. Quantity-axis scan
  let bestMcp: number | null = null;
  let bestQ = 0.0;

  for (const q of candidates) {
    const dp = priceOnCurve(bPrices, bCumQty, q, 'demand');
    const sp = priceOnCurve(sPrices, sCumQty, q, 'supply');

    if (sp <= dp + 1e-9) {
      bestQ = q;
      bestMcp = sp; // Marginal offer price at Q*
    }
  }

  if (bestMcp === null || bestQ <= 1e-6) {
    return {
      ...emptyResult,
      total_demand: Number(totalDemand.toFixed(3)),
      total_supply: Number(totalSupply.toFixed(3)),
    };
  }

  const mcp = Number(bestMcp.toFixed(3));
  const mcv_mw = Number(bestQ.toFixed(3));
  const mcv_mwh = Number(mwToMwh(mcv_mw).toFixed(5));
  const totalCents = settlementCents(mcp, mcv_mw);
  const market_value = totalCents / 100;

  // Determine clearing mode
  const clearing_mode =
    mcv_mw >= totalSupply - 1e-3
      ? 'Demand-Exceeds-All-Supply (Generator Cap)'
      : 'Normal Intersection';

  // Apply partial acceptance
  const acceptedBuyers = allocateSettlement(applyPartialAcceptance(bSorted, mcp, mcv_mw, 'buyer'), mcp, totalCents);
  const acceptedSellers = allocateSettlement(applyPartialAcceptance(sSorted, mcp, mcv_mw, 'seller'), mcp, totalCents);

  // Merge back into all_buyers / all_sellers for visualization
  const buyerAcceptedMap = new Map<string, { qty: number; status: AcceptanceStatus }>();
  acceptedBuyers.forEach((ab) => buyerAcceptedMap.set(ab.name, { qty: ab.qty_accepted, status: ab.acceptance_status }));

  const allBuyers = bSorted.map((b) => {
    const match = buyerAcceptedMap.get(b.name);
    return {
      name: b.name,
      email: b.email,
      price: b.price,
      quantity: b.quantity,
      qty_accepted: match ? match.qty : 0.0,
      acceptance_status: match ? match.status : ('Rejected' as AcceptanceStatus),
      timestamp: b.timestamp,
      row_order: b.row_order,
    };
  });

  const sellerAcceptedMap = new Map<string, { qty: number; status: AcceptanceStatus }>();
  acceptedSellers.forEach((as) => sellerAcceptedMap.set(as.name, { qty: as.qty_accepted, status: as.acceptance_status }));

  const allSellers = sSorted.map((s) => {
    const match = sellerAcceptedMap.get(s.name);
    return {
      name: s.name,
      email: s.email,
      price: s.price,
      quantity: s.quantity,
      qty_accepted: match ? match.qty : 0.0,
      acceptance_status: match ? match.status : ('Rejected' as AcceptanceStatus),
      timestamp: s.timestamp,
      row_order: s.row_order,
    };
  });

  return {
    slot,
    status: 'Cleared',
    mcp,
    mcv_mw,
    mcv_mwh,
    market_value,
    clearing_mode,
    total_demand: Number(totalDemand.toFixed(3)),
    total_supply: Number(totalSupply.toFixed(3)),
    accepted_buyers: acceptedBuyers,
    accepted_sellers: acceptedSellers,
    all_buyers: allBuyers,
    all_sellers: allSellers,
  };
}

/**
 * Run clearing for all detected time slots
 */
export function runAllSlots(
  buyers: RawBidOfferRecord[],
  sellers: RawBidOfferRecord[],
  n_slots: number
): Record<number, SlotClearingResult> {
  const results: Record<number, SlotClearingResult> = {};
  for (let s = 1; s <= n_slots; s++) {
    const b = buyers.filter((item) => item.slot === s);
    const sList = sellers.filter((item) => item.slot === s);
    results[s] = findMarketClearing(b, sList, s);
  }
  return results;
}

/**
 * Build Settlement Register
 */
export function createSettlementRegister(
  results: Record<number, SlotClearingResult>,
  n_slots: number
): SettlementRecord[] {
  const records: SettlementRecord[] = [];

  for (let s = 1; s <= n_slots; s++) {
    const r = results[s];
    if (!r || r.status !== 'Cleared') continue;

    // Buyers (Drawl)
    for (const b of r.accepted_buyers) {
      const mwh = Number(mwToMwh(b.qty_accepted).toFixed(5));
      const amount = b.amount_nrs ?? settlementCents(r.mcp, b.qty_accepted) / 100;
      records.push({
        slot: `T${s}`,
        role: 'Buyer',
        participant: b.name,
        email: b.email || '',
        mcp: r.mcp,
        qty_accepted_mw: b.qty_accepted,
        energy_mwh: mwh,
        amount_nrs: amount,
        status: b.acceptance_status,
      });
    }

    // Sellers (Dispatch)
    for (const sel of r.accepted_sellers) {
      const mwh = Number(mwToMwh(sel.qty_accepted).toFixed(5));
      const amount = sel.amount_nrs ?? settlementCents(r.mcp, sel.qty_accepted) / 100;
      records.push({
        slot: `T${s}`,
        role: 'Seller',
        participant: sel.name,
        email: sel.email || '',
        mcp: r.mcp,
        qty_accepted_mw: sel.qty_accepted,
        energy_mwh: mwh,
        amount_nrs: amount,
        status: sel.acceptance_status,
      });
    }
  }

  return records;
}

/**
 * Build participant summary: total bid/offer vs actual dispatch/drawl
 */
export function createParticipantSummary(
  buyers: RawBidOfferRecord[],
  sellers: RawBidOfferRecord[],
  results: Record<number, SlotClearingResult>
): ParticipantSummaryItem[] {
  // Keyed by role AND name: an organisation that both buys and sells keeps two separate statements.
  const summaryMap = new Map<string, ParticipantSummaryItem>();
  const keyOf = (role: ParticipantRole, name: string) => `${role}|${name}`;

  const processSide = (list: RawBidOfferRecord[], role: ParticipantRole) => {
    for (const item of list) {
      const key = keyOf(role, item.name);
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          name: item.name,
          role,
          email: item.email || '',
          total_bid_offer_mw: 0,
          actual_dispatch_drawl_mw: 0,
          acceptance_rate_pct: 0,
          total_settlement_nrs: 0,
        });
      }
      summaryMap.get(key)!.total_bid_offer_mw += item.quantity;
      if (item.email && !summaryMap.get(key)!.email) {
        summaryMap.get(key)!.email = item.email;
      }
    }
  };

  processSide(buyers, 'buyer');
  processSide(sellers, 'seller');

  // Accumulate actual accepted dispatch/drawl from clearing results
  for (const r of Object.values(results)) {
    if (!r || r.status !== 'Cleared') continue;

    for (const b of r.accepted_buyers) {
      const entry = summaryMap.get(keyOf('buyer', b.name));
      if (entry) {
        entry.actual_dispatch_drawl_mw += b.qty_accepted;
        entry.total_settlement_nrs += b.amount_nrs ?? settlementCents(r.mcp, b.qty_accepted) / 100;
      }
    }

    for (const s of r.accepted_sellers) {
      const entry = summaryMap.get(keyOf('seller', s.name));
      if (entry) {
        entry.actual_dispatch_drawl_mw += s.qty_accepted;
        entry.total_settlement_nrs += s.amount_nrs ?? settlementCents(r.mcp, s.qty_accepted) / 100;
      }
    }
  }

  const items = Array.from(summaryMap.values());
  for (const item of items) {
    item.total_bid_offer_mw = Number(item.total_bid_offer_mw.toFixed(3));
    item.actual_dispatch_drawl_mw = Number(item.actual_dispatch_drawl_mw.toFixed(3));
    item.acceptance_rate_pct =
      item.total_bid_offer_mw > 0
        ? Number(((item.actual_dispatch_drawl_mw / item.total_bid_offer_mw) * 100).toFixed(1))
        : 0;
    item.total_settlement_nrs = Number(item.total_settlement_nrs.toFixed(2));
  }

  return items.sort((a, b) => b.total_bid_offer_mw - a.total_bid_offer_mw);
}


export interface SettlementReconciliation {
  buyers_payable_nrs: number;
  sellers_receivable_nrs: number;
  market_value_nrs: number;
  difference_nrs: number;
  balanced: boolean;
  slots_checked: number;
}

/**
 * Audit check: what buyers pay must equal what sellers receive, and both must equal the
 * market value. Works in whole paisa so there is no floating point noise.
 */
export function reconcileSettlement(
  results: Record<number, SlotClearingResult>,
  n_slots: number
): SettlementReconciliation {
  let buy = 0;
  let sell = 0;
  let value = 0;
  let slots = 0;
  const cents = (x: number) => Math.round(x * 100);
  for (let s = 1; s <= n_slots; s++) {
    const r = results[s];
    if (!r || r.status !== 'Cleared') continue;
    slots++;
    value += cents(r.market_value);
    buy += r.accepted_buyers.reduce((a, b) => a + cents(b.amount_nrs ?? 0), 0);
    sell += r.accepted_sellers.reduce((a, b) => a + cents(b.amount_nrs ?? 0), 0);
  }
  return {
    buyers_payable_nrs: buy / 100,
    sellers_receivable_nrs: sell / 100,
    market_value_nrs: value / 100,
    difference_nrs: (buy - sell) / 100,
    balanced: buy === sell && sell === value,
    slots_checked: slots,
  };
}
