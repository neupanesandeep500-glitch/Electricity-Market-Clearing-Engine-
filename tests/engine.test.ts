import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMarketClearing, parseResponses, runAllSlots, createSettlementRegister,
  createParticipantSummary, reconcileSettlement, settlementCents,
} from '../src/engine/clearingEngine';
import { collectParticipantSlotData, buildParticipantEmail, escapeHtml } from '../src/services/emailService';
import type { RawBidOfferRecord } from '../src/types';

let seed = 987654321;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const mk = (n: number, role: 'buyer' | 'seller', base: number): RawBidOfferRecord[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `${role[0]}${i}`, email: '', role, slot: 1,
    price: Number((base + rnd() * 10).toFixed(1)),
    quantity: Number((1 + rnd() * 20).toFixed(rnd() < 0.5 ? 0 : 3)),
    timestamp: null, row_order: i,
  }));

function reference(b: RawBidOfferRecord[], s: RawBidOfferRecord[]) {
  const B = [...b].sort((x, y) => y.price - x.price || x.row_order - y.row_order).map((x) => ({ ...x }));
  const S = [...s].sort((x, y) => x.price - y.price || x.row_order - y.row_order).map((x) => ({ ...x }));
  let i = 0, j = 0, vol = 0, mcp = 0;
  while (i < B.length && j < S.length && B[i].price >= S[j].price - 1e-9) {
    const q = Math.min(B[i].quantity, S[j].quantity);
    vol += q; mcp = S[j].price; B[i].quantity -= q; S[j].quantity -= q;
    if (B[i].quantity < 1e-9) i++;
    if (S[j].quantity < 1e-9) j++;
  }
  return { vol: Number(vol.toFixed(3)), mcp };
}

test('clearing matches an independent reference on 3000 random order books', () => {
  for (let t = 0; t < 3000; t++) {
    const b = mk(1 + Math.floor(rnd() * 8), 'buyer', 2 + rnd() * 6);
    const s = mk(1 + Math.floor(rnd() * 8), 'seller', 2 + rnd() * 6);
    const r = findMarketClearing(b, s, 1);
    const ref = reference(b, s);
    assert.ok(Math.abs(r.mcv_mw - ref.vol) < 1e-3, `volume ${r.mcv_mw} vs ${ref.vol}`);
    if (r.status === 'Cleared') assert.ok(Math.abs(r.mcp - ref.mcp) < 1e-3, `mcp ${r.mcp} vs ${ref.mcp}`);
    const sumB = r.accepted_buyers.reduce((a, x) => a + x.qty_accepted, 0);
    const sumS = r.accepted_sellers.reduce((a, x) => a + x.qty_accepted, 0);
    assert.ok(Math.abs(sumB - r.mcv_mw) < 1e-3 && Math.abs(sumS - r.mcv_mw) < 1e-3, 'accepted volumes equal MCV');
    assert.ok(r.accepted_buyers.every((x) => x.price >= r.mcp - 1e-6), 'no buyer below MCP');
    assert.ok(r.accepted_sellers.every((x) => x.price <= r.mcp + 1e-6), 'no seller above MCP');
  }
});

test('settlement balances to the paisa on 3000 random order books', () => {
  for (let t = 0; t < 3000; t++) {
    const b = mk(1 + Math.floor(rnd() * 8), 'buyer', 2 + rnd() * 6);
    const s = mk(1 + Math.floor(rnd() * 8), 'seller', 2 + rnd() * 6);
    const rec = reconcileSettlement({ 1: findMarketClearing(b, s, 1) }, 1);
    assert.ok(rec.slots_checked === 0 || rec.balanced, `unbalanced: ${JSON.stringify(rec)}`);
  }
});

const HDR = 'Timestamp,I am a,Select your ID,Email,Rate for T1: price,Power for T1: quantity';

test('a resubmitting participant is counted once, using their latest entry', () => {
  const csv = [HDR,
    '9/30/2026 10:00:00,Buyer,BuyerA,a@x.com,9,10',
    '9/30/2026 10:05:00,Buyer,BuyerA,a@x.com,9,6',   // correction: 6 MW
    '9/30/2026 10:01:00,Seller,SellerX,s@x.com,5,30',
  ].join('\n');
  const p = parseResponses(csv, 1);
  assert.equal(p.buyers.length, 1);
  assert.equal(p.diagnostics.duplicate_buyer_rows, 1);
  const r = runAllSlots(p.buyers, p.sellers, 1)[1];
  assert.equal(r.total_demand, 6);
  assert.equal(r.mcv_mw, 6);
});

test('buyers pay exactly what sellers receive; email amount equals register amount', () => {
  const csv = [HDR,
    '9/30/2026 10:00:00,Buyer,B1,b1@x.com,9,3.333',
    '9/30/2026 10:00:01,Buyer,B2,b2@x.com,9,3.333',
    '9/30/2026 10:00:02,Buyer,B3,b3@x.com,9,3.335',
    '9/30/2026 10:01:00,Seller,S1,s1@x.com,4.123,1.111',
    '9/30/2026 10:01:01,Seller,S2,s2@x.com,4.123,8.890',
  ].join('\n');
  const p = parseResponses(csv, 1);
  const res = runAllSlots(p.buyers, p.sellers, 1);
  const rec = reconcileSettlement(res, 1);
  assert.ok(rec.balanced, JSON.stringify(rec));
  assert.equal(rec.market_value_nrs, settlementCents(res[1].mcp, res[1].mcv_mw) / 100);
  const reg = createSettlementRegister(res, 1);
  const email = collectParticipantSlotData('B1', 'buyer', p.buyers, p.sellers, res, 1)[0];
  assert.equal(email.amount_nrs, reg.find((r) => r.participant === 'B1')!.amount_nrs);
  const summary = createParticipantSummary(p.buyers, p.sellers, res).find((x) => x.name === 'B1')!;
  assert.equal(summary.total_settlement_nrs, email.amount_nrs);
});

test('an organisation that both buys and sells keeps two separate statements', () => {
  const csv = [HDR, '9/30/2026 10:00:00,Buyer,Acme,a@x.com,9,5', '9/30/2026 10:01:00,Seller,Acme,a@x.com,4,5'].join('\n');
  const p = parseResponses(csv, 1);
  const rows = createParticipantSummary(p.buyers, p.sellers, runAllSlots(p.buyers, p.sellers, 1)).filter((r) => r.name === 'Acme');
  assert.equal(rows.length, 2);
  assert.equal(p.diagnostics.participants_on_both_sides, 1);
});

test('participant names cannot inject HTML into notification emails', () => {
  const csv = [HDR, '9/30/2026 10:00:00,Buyer,B1,b@x.com,9,5', '9/30/2026 10:01:00,Seller,S1,s@x.com,4,5'].join('\n');
  const p = parseResponses(csv, 1);
  const res = runAllSlots(p.buyers, p.sellers, 1);
  const sd = collectParticipantSlotData('B1', 'buyer', p.buyers, p.sellers, res, 1);
  const mail = buildParticipantEmail('<img src=x onerror=alert(1)>', 'buyer', sd, 'Session <b>1</b>', 1, 1);
  assert.ok(!mail.html.includes('<img src=x'));
  assert.ok(!mail.html.includes('Session <b>'));
  assert.equal(escapeHtml(`a&b<"'`), 'a&amp;b&lt;&quot;&#39;');
});
