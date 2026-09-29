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

  const buyers = records.filter((r) => r.role === 'buyer');
  const sellers = records.filter((r) => r.role === 'seller');

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

  // Duplicate checks
  const buyerKeySet = new Set<string>();
  let dupBuyers = 0;
  for (const b of buyers) {
    const key = `${b.name}|${b.slot}`;
    if (buyerKeySet.has(key)) dupBuyers++;
    else buyerKeySet.add(key);
  }
  diagnostics.duplicate_buyer_rows = dupBuyers;

  const sellerKeySet = new Set<string>();
  let dupSellers = 0;
  for (const s of sellers) {
    const key = `${s.name}|${s.slot}`;
    if (sellerKeySet.has(key)) dupSellers++;
    else sellerKeySet.add(key);
  }
  diagnostics.duplicate_seller_rows = dupSellers;

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
    if (side === 'buyer') {
      if (Math.abs(b.price - a.price) > 1e-6) return b.price - a.price; // Descending
    } else {
      if (Math.abs(a.price - b.price) > 1e-6) return a.price - b.price; // Ascending
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
  const mcv_mwh = Number((mcv_mw * 0.25).toFixed(4));
  const market_value = Number((mcp * mcv_mwh * 1000).toFixed(2));

  // Determine clearing mode
  const clearing_mode =
    mcv_mw >= totalSupply - 1e-3
      ? 'Demand-Exceeds-All-Supply (Generator Cap)'
      : 'Normal Intersection';

  // Apply partial acceptance
  const acceptedBuyers = applyPartialAcceptance(bSorted, mcp, mcv_mw, 'buyer');
  const acceptedSellers = applyPartialAcceptance(sSorted, mcp, mcv_mw, 'seller');

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
      const mwh = Number((b.qty_accepted * 0.25).toFixed(4));
      const amount = Number((r.mcp * mwh * 1000).toFixed(2));
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
      const mwh = Number((sel.qty_accepted * 0.25).toFixed(4));
      const amount = Number((r.mcp * mwh * 1000).toFixed(2));
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
  const summaryMap = new Map<string, ParticipantSummaryItem>();

  const processSide = (list: RawBidOfferRecord[], role: ParticipantRole) => {
    for (const item of list) {
      if (!summaryMap.has(item.name)) {
        summaryMap.set(item.name, {
          name: item.name,
          role,
          email: item.email || '',
          total_bid_offer_mw: 0,
          actual_dispatch_drawl_mw: 0,
          acceptance_rate_pct: 0,
          total_settlement_nrs: 0,
        });
      }
      summaryMap.get(item.name)!.total_bid_offer_mw += item.quantity;
      if (item.email && !summaryMap.get(item.name)!.email) {
        summaryMap.get(item.name)!.email = item.email;
      }
    }
  };

  processSide(buyers, 'buyer');
  processSide(sellers, 'seller');

  // Accumulate actual accepted dispatch/drawl from clearing results
  for (const r of Object.values(results)) {
    if (!r || r.status !== 'Cleared') continue;

    for (const b of r.accepted_buyers) {
      const entry = summaryMap.get(b.name);
      if (entry) {
        entry.actual_dispatch_drawl_mw += b.qty_accepted;
        entry.total_settlement_nrs += r.mcp * (b.qty_accepted * 0.25) * 1000;
      }
    }

    for (const s of r.accepted_sellers) {
      const entry = summaryMap.get(s.name);
      if (entry) {
        entry.actual_dispatch_drawl_mw += s.qty_accepted;
        entry.total_settlement_nrs += r.mcp * (s.qty_accepted * 0.25) * 1000;
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
