// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// src/engine/standaloneHtmlGenerator.ts
function generateStandaloneHTML(sheetId = "17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg", sheetName = "Form Responses 1", googleFormUrl = "https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Nepal Electricity Market Clearing Engine (Standalone V5.0)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Minimalist, ultra-clean CSS -->
  <style>
    :root {
      --primary: #1A237E;
      --primary-light: #283593;
      --buyer: #1565C0;
      --seller: #C62828;
      --amber: #E67E22;
      --green: #1B5E20;
      --bg: #F8FAFC;
      --card: #FFFFFF;
      --border: #E2E8F0;
      --text: #0F172A;
      --text-muted: #64748B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding-bottom: 60px;
      -webkit-font-smoothing: antialiased;
    }
    .mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
    .header {
      background: linear-gradient(135deg, #0D1B4B 0%, #1A237E 50%, #1565C0 100%);
      color: #FFFFFF;
      padding: 18px 24px;
      border-bottom: 3px solid var(--amber);
      box-shadow: 0 4px 20px rgba(13,27,75,0.25);
    }
    .header-inner {
      max-width: 1360px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }
    .title-group h1 { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.3px; display: flex; align-items: center; gap: 8px; }
    .title-group p { font-size: 0.78rem; color: rgba(255,255,255,0.75); margin-top: 3px; }
    .header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      touch-action: manipulation;
    }
    .btn-primary { background: #FFFFFF; color: var(--primary); font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    .btn-primary:hover { background: #F1F5F9; }
    .btn-amber { background: var(--amber); color: #FFFFFF; }
    .btn-amber:hover { opacity: 0.9; }
    .btn-outline { background: rgba(255,255,255,0.15); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.3); }
    .btn-outline:hover { background: rgba(255,255,255,0.25); }

    .container { max-width: 1360px; margin: 0 auto; padding: 20px 16px; }

    /* QR Code Banner */
    .qr-banner {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .qr-card-info { flex: 1; min-width: 260px; }
    .qr-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--buyer);
      background: #EBF3FB;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 6px;
    }
    .qr-visual {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #F8FAFC;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
    }
    #qrCanvas { width: 100px; height: 100px; border-radius: 6px; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .kpi-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
    .kpi-val { font-size: 1.45rem; font-weight: 800; margin: 4px 0 2px 0; line-height: 1.2; }
    .kpi-sub { font-size: 0.72rem; color: var(--text-muted); }

    /* Nav Tabs */
    .nav-tabs {
      display: flex;
      gap: 6px;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
      margin-bottom: 20px;
      overflow-x: auto;
    }
    .tab-btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.83rem;
      font-weight: 600;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .tab-btn.active { background: var(--primary); color: #FFFFFF; }

    /* Card Panels */
    .card {
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.02);
    }
    .card-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Table Styles */
    .table-container { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; }
    th {
      background: var(--primary);
      color: #FFFFFF;
      padding: 10px 12px;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
    }
    td { padding: 9px 12px; border-bottom: 1px solid var(--border); }
    tr:nth-child(even) { background: #F8FAFC; }
    tr:hover { background: #F1F5F9; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .badge-full { background: #E8F5E9; color: var(--green); }
    .badge-partial { background: #FFF8E1; color: var(--amber); }
    .badge-rejected { background: #FFEBEE; color: var(--seller); }

    /* Chart Canvas */
    .chart-container { position: relative; width: 100%; height: 380px; }
    canvas { width: 100%; height: 100%; }

    /* Form Controls */
    .form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .form-group label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
    .input {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.85rem;
      outline: none;
    }
    .input:focus { border-color: var(--primary); }

    /* Mobile Adaptations */
    @media (max-width: 768px) {
      .header-inner { flex-direction: column; align-items: flex-start; }
      .qr-banner { flex-direction: column; align-items: stretch; }
      .qr-visual { justify-content: center; }
      .chart-container { height: 280px; }
    }
  </style>
  <!-- Embedded lightweight QR engine -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <div class="title-group">
        <h1>\u26A1 Electricity Market Clearing Engine</h1>
        <p>Standalone V5.0 \xB7 Optimal Nodal Pricing & Economic Dispatch</p>
      </div>
      <div class="header-actions">
        <div id="standaloneClock" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); padding:6px 12px; border-radius:10px; display:flex; align-items:center; gap:8px; font-size:0.78rem;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00E676;"></span>
          <span id="standaloneDayDate" style="color:#FFE082; font-weight:700;">Loading...</span>
          <span id="standaloneTime" style="font-family:monospace; font-weight:800; font-size:0.92rem; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; color:#FFFFFF;">--:--:--</span>
          <span id="standaloneTz" style="font-size:0.68rem; color:#BBDEFB; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">Auto TZ</span>
        </div>
        <button class="btn btn-outline" onclick="openQrModal()">\u{1F4F1} Scan Form QR</button>
        <button class="btn btn-primary" onclick="syncGoogleSheet()">\u{1F504} Refresh</button>
        <button class="btn btn-amber" onclick="openSettingsModal()">\u2699 Settings</button>
      </div>
    </div>
  </header>

  <main class="container">

    <!-- QR Onboarding Banner -->
    <section class="qr-banner">
      <div class="qr-card-info">
        <span class="qr-badge">LIVE GOOGLE FORM ONBOARDING</span>
        <h2 style="font-size:1.1rem; font-weight:800; color:var(--primary); margin-bottom:4px;">
          Participant Data Input Portal
        </h2>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:10px;">
          Participants scan the QR code to open the Google Form and submit bids (Buyers) or offers (Sellers) for 15-minute time slots (T1\u2013T4).
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a id="formDirectLink" href="${googleFormUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background:#EBF3FB; color:var(--buyer); border:1px solid #BBDEFB;">
            \u{1F517} Open Google Form
          </a>
          <button class="btn btn-outline" style="background:#F1F5F9; color:var(--text); border:1px solid var(--border);" onclick="copyFormLink()">
            \u{1F4CB} Copy Link
          </button>
        </div>
      </div>
      <div class="qr-visual">
        <canvas id="qrCanvas"></canvas>
        <div>
          <p style="font-size:0.75rem; font-weight:700; color:var(--primary); margin-bottom:2px;">Scan with Camera</p>
          <p style="font-size:0.7rem; color:var(--text-muted); max-width:140px;">Submissions sync directly into the market clearing algorithm.</p>
        </div>
      </div>
    </section>

    <!-- KPI Summary Grid -->
    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Average MCP</div>
        <div class="kpi-val mono" id="kpiAvgMcp" style="color:var(--amber);">\u2014</div>
        <div class="kpi-sub">NRs/kWh across cleared slots</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total MW Cleared</div>
        <div class="kpi-val mono" id="kpiTotalMw" style="color:var(--buyer);">\u2014</div>
        <div class="kpi-sub">Megawatts (15-min)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Energy Cleared</div>
        <div class="kpi-val mono" id="kpiTotalMwh" style="color:#00838F;">\u2014</div>
        <div class="kpi-sub">MWh (MW \xD7 0.25)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Market Value</div>
        <div class="kpi-val mono" id="kpiMarketValue" style="color:var(--green);">\u2014</div>
        <div class="kpi-sub">Nepalese Rupees (NRs)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Participants</div>
        <div class="kpi-val mono" id="kpiParticipants" style="color:var(--primary);">\u2014</div>
        <div class="kpi-sub" id="kpiParticipantBreakdown">Buyers &amp; Sellers</div>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button class="tab-btn active" onclick="switchTab('overview')">\u{1F4CA} Market Overview</button>
      <button class="tab-btn" onclick="switchTab('curves')">\u{1F4C8} Supply &amp; Demand Curves</button>
      <button class="tab-btn" onclick="switchTab('settlement')">\u{1F4B0} Settlement Register</button>
      <button class="tab-btn" onclick="switchTab('participants')">\u{1F465} Participants &amp; Dispatch</button>
      <button class="tab-btn" onclick="switchTab('diagnostics')">\u{1FA7A} Data Quality</button>
    </nav>

    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-pane">
      <div class="card">
        <div class="card-title">\u26A1 Slot-wise Market Clearing Results</div>
        <div class="table-container">
          <table id="summaryTable">
            <thead>
              <tr>
                <th>Slot</th>
                <th>MCP (NRs/kWh)</th>
                <th>MW Cleared</th>
                <th>MWh Cleared</th>
                <th>Demand (MW)</th>
                <th>Supply (MW)</th>
                <th>Market Value (NRs)</th>
                <th>Clearing Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: CURVES -->
    <div id="tab-curves" class="tab-pane" style="display:none;">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div class="card-title" style="margin:0;">\u{1F4C8} Interactive Supply &amp; Demand Intersection</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.8rem; font-weight:600;">Time Slot:</label>
            <select id="slotSelect" class="input" style="padding:4px 10px;" onchange="renderCurve()"></select>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="curveCanvas"></canvas>
        </div>
        <div style="display:flex; justify-content:center; gap:20px; margin-top:12px; font-size:0.78rem; font-weight:600;">
          <span style="color:var(--seller);">\u25A0 Demand Curve (Bids)</span>
          <span style="color:var(--buyer);">\u25A0 Supply Curve (Offers)</span>
          <span style="color:var(--amber);">\u2605 Clearing Intersection (MCP/MCV)</span>
        </div>
      </div>
    </div>

    <!-- TAB 3: SETTLEMENT -->
    <div id="tab-settlement" class="tab-pane" style="display:none;">
      <div class="card">
        <div class="card-title">\u{1F4B0} Participant Financial Settlement Register</div>
        <div class="table-container">
          <table id="settlementTable">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Role</th>
                <th>Participant</th>
                <th>MCP (NRs/kWh)</th>
                <th>Awarded (MW)</th>
                <th>Energy (MWh)</th>
                <th>Settlement (NRs)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: PARTICIPANTS -->
    <div id="tab-participants" class="tab-pane" style="display:none;">
      <div class="card">
        <div class="card-title">\u{1F465} Participant Total Bid vs Actual Dispatch / Drawl</div>
        <div class="table-container">
          <table id="participantTable">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Role</th>
                <th>Email</th>
                <th>Submitted (MW)</th>
                <th>Cleared (MW)</th>
                <th>Acceptance Rate</th>
                <th>Total Settlement (NRs)</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: DIAGNOSTICS -->
    <div id="tab-diagnostics" class="tab-pane" style="display:none;">
      <div class="card">
        <div class="card-title">\u{1FA7A} Data Extraction &amp; Quality Audit</div>
        <div class="table-container">
          <table id="diagTable">
            <thead>
              <tr><th>Quality Metric</th><th>Audited Value</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

  </main>

  <!-- JavaScript Market Clearing Engine -->
  <script>
    let appConfig = {
      sheetId: "${sheetId}",
      sheetName: "${sheetName}",
      googleFormUrl: "${googleFormUrl}"
    };

    let marketState = {
      buyers: [],
      sellers: [],
      nSlots: 4,
      results: {},
      diagnostics: {}
    };

    // Render QR Code immediately
    function renderQRCode(url) {
      const canvas = document.getElementById('qrCanvas');
      if (window.QRCode && canvas) {
        QRCode.toCanvas(canvas, url, {
          width: 100,
          margin: 1,
          color: { dark: '#1A237E', light: '#FFFFFF' }
        });
      }
    }

    function copyFormLink() {
      navigator.clipboard.writeText(appConfig.googleFormUrl);
      alert('Google Form link copied to clipboard!');
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const activeTab = document.getElementById('tab-' + tabId);
      if (activeTab) activeTab.style.display = 'block';
      event.target.classList.add('active');
      if (tabId === 'curves') renderCurve();
    }

    // Mathematical clearing engine
    function solveSlotClearing(bList, sList, slot) {
      if (bList.length === 0 || sList.length === 0) {
        return { slot, status: 'No Trade', mcp: 0, mcv_mw: 0, mcv_mwh: 0, market_value: 0, clearing_mode: 'No Trade', total_demand: 0, total_supply: 0, accepted_buyers: [], accepted_sellers: [] };
      }

      const bSorted = [...bList].sort((a,b) => b.price - a.price || a.row_order - b.row_order);
      const sSorted = [...sList].sort((a,b) => a.price - b.price || a.row_order - b.row_order);

      const totDem = bSorted.reduce((s,i) => s + i.quantity, 0);
      const totSup = sSorted.reduce((s,i) => s + i.quantity, 0);

      // Cumulatives
      let cumB = 0; const bCum = bSorted.map(i => cumB += i.quantity);
      let cumS = 0; const sCum = sSorted.map(i => cumS += i.quantity);

      const maxPos = Math.min(totDem, totSup);
      const candidates = [...new Set([...bCum, ...sCum])].filter(q => q > 0 && q <= maxPos + 1e-6).sort((a,b) => a - b);

      function getPrice(prices, cums, q, side) {
        for (let i = 0; i < cums.length; i++) {
          if (cums[i] >= q - 1e-9) return prices[i];
        }
        return side === 'demand' ? 0 : Infinity;
      }

      let bestMcp = null;
      let bestQ = 0;

      for (const q of candidates) {
        const dp = getPrice(bSorted.map(i=>i.price), bCum, q, 'demand');
        const sp = getPrice(sSorted.map(i=>i.price), sCum, q, 'supply');
        if (sp <= dp + 1e-9) {
          bestQ = q;
          bestMcp = sp;
        }
      }

      if (bestMcp === null || bestQ <= 1e-6) {
        return { slot, status: 'No Trade', mcp: 0, mcv_mw: 0, mcv_mwh: 0, market_value: 0, clearing_mode: 'No Trade', total_demand: totDem, total_supply: totSup, accepted_buyers: [], accepted_sellers: [] };
      }

      const mcp = Number(bestMcp.toFixed(3));
      const mcv_mw = Number(bestQ.toFixed(3));
      const mcv_mwh = Number((mcv_mw * 0.25).toFixed(4));
      const market_value = Number((mcp * mcv_mwh * 1000).toFixed(2));
      const clearing_mode = mcv_mw >= totSup - 1e-3 ? 'Demand-Exceeds-All-Supply (Generator Cap)' : 'Normal Intersection';

      // Partial allocation
      function allocate(list, maxQ, side) {
        const elig = list.filter(item => side === 'seller' ? item.price <= mcp + 1e-6 : item.price >= mcp - 1e-6);
        let rem = maxQ;
        const res = [];
        for (const item of elig) {
          if (rem <= 1e-6) break;
          if (item.quantity <= rem + 1e-6) {
            res.push({ ...item, qty_accepted: item.quantity, status: 'Full' });
            rem -= item.quantity;
          } else {
            res.push({ ...item, qty_accepted: Number(rem.toFixed(4)), status: 'Partial' });
            rem = 0;
            break;
          }
        }
        return res;
      }

      return {
        slot, status: 'Cleared', mcp, mcv_mw, mcv_mwh, market_value, clearing_mode,
        total_demand: totDem, total_supply: totSup,
        accepted_buyers: allocate(bSorted, mcv_mw, 'buyer'),
        accepted_sellers: allocate(sSorted, mcv_mw, 'seller'),
        bSorted, sSorted, bCum, sCum
      };
    }

    // CSV parsing
    function parseCSV(text) {
      const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return null;
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

      // Auto detect slots
      let nSlots = 4;
      for (const h of headers) {
        const m = h.match(/For T(\\d+):/i);
        if (m && Number(m[1]) > nSlots) nSlots = Number(m[1]);
      }

      const buyers = [];
      const sellers = [];

      for (let r = 1; r < lines.length; r++) {
        const cols = lines[r].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const role = (cols[1] || '').toLowerCase();
        const name = cols[2] || 'Participant ' + r;
        const email = cols[3] || '';

        const isBuyer = role.includes('buyer');
        const isSeller = role.includes('seller');
        if (!isBuyer && !isSeller) continue;

        const offset = isBuyer ? 4 + nSlots * 2 : 4;

        for (let s = 1; s <= nSlots; s++) {
          const pIdx = offset + (s - 1) * 2;
          const qIdx = pIdx + 1;
          const price = parseFloat(cols[pIdx]);
          const qty = parseFloat(cols[qIdx]);

          if (!isNaN(price) && !isNaN(qty) && price > 0 && qty > 0) {
            const record = { name, email, slot: s, price, quantity: qty, row_order: r };
            if (isBuyer) buyers.push(record);
            else sellers.push(record);
          }
        }
      }

      return { buyers, sellers, nSlots };
    }

    // Fetch Google Sheet live
    async function syncGoogleSheet() {
      const url = 'https://docs.google.com/spreadsheets/d/' + appConfig.sheetId + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(appConfig.sheetName);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed with status ' + res.status);
        const csv = await res.text();
        const data = parseCSV(csv);
        if (data && (data.buyers.length > 0 || data.sellers.length > 0)) {
          runSimulation(data.buyers, data.sellers, data.nSlots);
          alert('Successfully synced with Google Sheet (' + data.buyers.length + ' bids, ' + data.sellers.length + ' offers)!');
          return;
        }
      } catch (err) {
        console.warn('Direct fetch failed, trying demo fallback', err);
      }
      loadDemoData();
    }

    // Built-in Demo Data
    function loadDemoData() {
      const sellers = ['Upper Tamakoshi HPP', 'Chilime HPP', 'Marsyangdi HPP', 'Kulekhani Peaking HPP', 'Middle Marsyangdi'];
      const buyers = ['NEA Kathmandu DCS', 'NEA Pokhara DCS', 'Hetauda Industrial Zone', 'Butwal Power Corp', 'Birgunj DCS'];
      const buyersList = [];
      const sellersList = [];

      for (let s = 1; s <= 4; s++) {
        sellers.forEach((name, i) => {
          sellersList.push({ name, email: name.toLowerCase().replace(/\\s+/g, '') + '@nea.org.np', slot: s, price: 4.8 + i * 0.4 + (s % 2) * 0.2, quantity: 80 + i * 25, row_order: i + 1 });
        });
        buyers.forEach((name, i) => {
          buyersList.push({ name, email: name.toLowerCase().replace(/\\s+/g, '') + '@industry.np', slot: s, price: 10.5 - i * 0.5 - (s % 2) * 0.3, quantity: 90 + i * 20, row_order: i + 10 });
        });
      }
      runSimulation(buyersList, sellersList, 4);
    }

    function runSimulation(buyers, sellers, nSlots) {
      marketState.buyers = buyers;
      marketState.sellers = sellers;
      marketState.nSlots = nSlots;
      marketState.results = {};

      for (let s = 1; s <= nSlots; s++) {
        const b = buyers.filter(i => i.slot === s);
        const sel = sellers.filter(i => i.slot === s);
        marketState.results[s] = solveSlotClearing(b, sel, s);
      }

      updateUI();
    }

    function updateUI() {
      // Slot select dropdown
      const sel = document.getElementById('slotSelect');
      sel.innerHTML = '';
      for (let s = 1; s <= marketState.nSlots; s++) {
        sel.innerHTML += '<option value="' + s + '">Time Slot T' + s + '</option>';
      }

      // KPIs
      const cleared = Object.values(marketState.results).filter(r => r.status === 'Cleared');
      const avgMcp = cleared.length ? cleared.reduce((s,r) => s + r.mcp, 0) / cleared.length : 0;
      const totMw = cleared.reduce((s,r) => s + r.mcv_mw, 0);
      const totMwh = cleared.reduce((s,r) => s + r.mcv_mwh, 0);
      const totVal = cleared.reduce((s,r) => s + r.market_value, 0);

      document.getElementById('kpiAvgMcp').innerText = 'NRs ' + avgMcp.toFixed(3);
      document.getElementById('kpiTotalMw').innerText = totMw.toFixed(2) + ' MW';
      document.getElementById('kpiTotalMwh').innerText = totMwh.toFixed(3) + ' MWh';
      document.getElementById('kpiMarketValue').innerText = 'NRs ' + Math.round(totVal).toLocaleString();

      const uBuyers = new Set(marketState.buyers.map(b => b.name)).size;
      const uSellers = new Set(marketState.sellers.map(s => s.name)).size;
      document.getElementById('kpiParticipants').innerText = (uBuyers + uSellers);
      document.getElementById('kpiParticipantBreakdown').innerText = uBuyers + ' Buyers \xB7 ' + uSellers + ' Sellers';

      // Summary Table
      const summaryBody = document.querySelector('#summaryTable tbody');
      summaryBody.innerHTML = '';
      for (let s = 1; s <= marketState.nSlots; s++) {
        const r = marketState.results[s];
        if (r && r.status === 'Cleared') {
          summaryBody.innerHTML += '<tr>' +
            '<td class="mono" style="font-weight:700; color:var(--primary); text-align:center;">T' + s + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.mcp.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.mcv_mw.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.mcv_mwh.toFixed(4) + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.total_demand.toFixed(1) + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.total_supply.toFixed(1) + '</td>' +
            '<td class="mono" style="text-align:right; font-weight:700; color:var(--green);">' + r.market_value.toLocaleString() + '</td>' +
            '<td style="text-align:center; font-size:0.75rem;">' + r.clearing_mode + '</td>' +
            '<td style="text-align:center;"><span class="badge badge-full">\u2705 Cleared</span></td>' +
            '</tr>';
        } else {
          summaryBody.innerHTML += '<tr>' +
            '<td class="mono" style="font-weight:700; text-align:center;">T' + s + '</td>' +
            '<td colspan="7" style="text-align:center; color:var(--text-muted);">No intersection / Insufficient liquidity</td>' +
            '<td style="text-align:center;"><span class="badge badge-rejected">\u274C No Trade</span></td>' +
            '</tr>';
        }
      }

      // Settlement Table
      const settleBody = document.querySelector('#settlementTable tbody');
      settleBody.innerHTML = '';
      for (let s = 1; s <= marketState.nSlots; s++) {
        const r = marketState.results[s];
        if (!r || r.status !== 'Cleared') continue;
        r.accepted_buyers.forEach(b => {
          const mwh = b.qty_accepted * 0.25;
          const amt = r.mcp * mwh * 1000;
          settleBody.innerHTML += '<tr>' +
            '<td class="mono" style="text-align:center;">T' + s + '</td>' +
            '<td><span style="color:var(--buyer); font-weight:700;">Buyer</span></td>' +
            '<td style="font-weight:600;">' + b.name + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.mcp.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + b.qty_accepted.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + mwh.toFixed(4) + '</td>' +
            '<td class="mono" style="text-align:right; font-weight:700; color:var(--green);">NRs ' + amt.toLocaleString('en-US', {minimumFractionDigits:2}) + '</td>' +
            '<td style="text-align:center;"><span class="badge badge-' + b.status.toLowerCase() + '">' + b.status + '</span></td>' +
            '</tr>';
        });
        r.accepted_sellers.forEach(sel => {
          const mwh = sel.qty_accepted * 0.25;
          const amt = r.mcp * mwh * 1000;
          settleBody.innerHTML += '<tr>' +
            '<td class="mono" style="text-align:center;">T' + s + '</td>' +
            '<td><span style="color:var(--seller); font-weight:700;">Seller</span></td>' +
            '<td style="font-weight:600;">' + sel.name + '</td>' +
            '<td class="mono" style="text-align:right;">' + r.mcp.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + sel.qty_accepted.toFixed(3) + '</td>' +
            '<td class="mono" style="text-align:right;">' + mwh.toFixed(4) + '</td>' +
            '<td class="mono" style="text-align:right; font-weight:700; color:var(--green);">NRs ' + amt.toLocaleString('en-US', {minimumFractionDigits:2}) + '</td>' +
            '<td style="text-align:center;"><span class="badge badge-' + sel.status.toLowerCase() + '">' + sel.status + '</span></td>' +
            '</tr>';
        });
      }

      renderCurve();
    }

    // Canvas Curve Visualizer
    function renderCurve() {
      const slot = Number(document.getElementById('slotSelect').value) || 1;
      const r = marketState.results[slot];
      const canvas = document.getElementById('curveCanvas');
      if (!canvas || !r) return;

      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const w = rect.width;
      const h = rect.height;
      const pad = 50;

      ctx.clearRect(0, 0, w, h);

      if (r.status !== 'Cleared') {
        ctx.fillStyle = '#64748B';
        ctx.font = '14px Plus Jakarta Sans';
        ctx.textAlign = 'center';
        ctx.fillText('No Market Clearing intersection found for Time Slot T' + slot, w / 2, h / 2);
        return;
      }

      const maxX = Math.max(r.total_demand, r.total_supply) * 1.15 || 500;
      const maxY = Math.max(...r.bSorted.map(i=>i.price), ...r.sSorted.map(i=>i.price)) * 1.2 || 15;

      const mapX = q => pad + (q / maxX) * (w - pad * 2);
      const mapY = p => (h - pad) - (p / maxY) * (h - pad * 2);

      // Gridlines
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const yVal = (maxY / 5) * i;
        const yPos = mapY(yVal);
        ctx.beginPath(); ctx.moveTo(pad, yPos); ctx.lineTo(w - pad, yPos); ctx.stroke();
        ctx.fillStyle = '#94A3B8'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
        ctx.fillText(yVal.toFixed(1), pad - 8, yPos + 3);

        const xVal = (maxX / 5) * i;
        const xPos = mapX(xVal);
        ctx.beginPath(); ctx.moveTo(xPos, pad); ctx.lineTo(xPos, h - pad); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(xVal), xPos, h - pad + 16);
      }

      // Axis labels
      ctx.fillStyle = '#64748B'; ctx.font = '11px Plus Jakarta Sans';
      ctx.textAlign = 'center';
      ctx.fillText('Power Quantity (MW)', w / 2, h - 12);

      // Demand curve (Red/Crimson)
      ctx.strokeStyle = '#C62828';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let curX = 0;
      r.bSorted.forEach(b => {
        ctx.lineTo(mapX(curX), mapY(b.price));
        curX += b.quantity;
        ctx.lineTo(mapX(curX), mapY(b.price));
      });
      ctx.stroke();

      // Supply curve (Royal Blue)
      ctx.strokeStyle = '#1565C0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      curX = 0;
      r.sSorted.forEach(s => {
        ctx.lineTo(mapX(curX), mapY(s.price));
        curX += s.quantity;
        ctx.lineTo(mapX(curX), mapY(s.price));
      });
      ctx.stroke();

      // Intersection lines & marker
      const mcpX = mapX(r.mcv_mw);
      const mcpY = mapY(r.mcp);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#E67E22';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad, mcpY); ctx.lineTo(mcpX, mcpY); ctx.lineTo(mcpX, h - pad); ctx.stroke();
      ctx.setLineDash([]);

      // Star Marker
      ctx.fillStyle = '#E67E22';
      ctx.beginPath();
      ctx.arc(mcpX, mcpY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1A237E';
      ctx.font = 'bold 11px Plus Jakarta Sans';
      ctx.fillText('MCP: NRs ' + r.mcp.toFixed(3) + ' | MCV: ' + r.mcv_mw.toFixed(1) + ' MW', mcpX, mcpY - 12);
    }

    // Modal helpers
    function openQrModal() {
      alert('Scan the QR Code on top of the page with any phone camera to access the input form!');
    }

    function openSettingsModal() {
      const newId = prompt('Enter Google Sheet ID or URL:', appConfig.sheetId);
      if (newId) {
        appConfig.sheetId = newId.trim();
        syncGoogleSheet();
      }
    }

    function updateStandaloneClock() {
      try {
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(now);
        const date = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }).format(now);
        const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }).format(now);
        
        const offsetMin = -now.getTimezoneOffset();
        const sign = offsetMin >= 0 ? '+' : '-';
        const absM = Math.abs(offsetMin);
        const offH = Math.floor(absM / 60);
        const offM = absM % 60;
        const offStr = 'UTC' + sign + String(offH).padStart(2, '0') + ':' + String(offM).padStart(2, '0');
        const shortTz = tz.includes('/') ? tz.split('/')[1].replace(/_/g, ' ') : tz;

        const dayDateEl = document.getElementById('standaloneDayDate');
        const timeEl = document.getElementById('standaloneTime');
        const tzEl = document.getElementById('standaloneTz');
        if (dayDateEl) dayDateEl.textContent = day + ', ' + date;
        if (timeEl) timeEl.textContent = time;
        if (tzEl) tzEl.textContent = shortTz + ' (' + offStr + ')';
      } catch (e) {
        console.warn('Clock error:', e);
      }
    }

    // Auto-run on load
    window.addEventListener('load', () => {
      renderQRCode(appConfig.googleFormUrl);
      syncGoogleSheet();
      updateStandaloneClock();
      setInterval(updateStandaloneClock, 1000);
    });
  </script>
</body>
</html>`;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
function getEnvEmailSender() {
  return (process.env.EMAIL_SENDER || process.env.EMAIL_USER || process.env.SMTP_USER || process.env.SMTP_EMAIL || process.env.GMAIL_USER || process.env.GMAIL_ADDRESS || process.env.SENDER_EMAIL || process.env.USER_EMAIL || process.env.MAIL_USERNAME || "neupanesandeep500@gmail.com").trim();
}
function getEnvEmailPassword() {
  return (process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.APP_PASSWORD || process.env.MAIL_PASSWORD || "kroetysmnrlvzomr").replace(/\s+/g, "");
}
function getEnvReplyTo() {
  return (process.env.EMAIL_REPLY_TO || process.env.REPLY_TO || "080mspse021.sandeep@pcampus.edu.np").trim();
}
function getEnvSmtpHost() {
  return (process.env.SMTP_HOST || "smtp.gmail.com").trim();
}
function getEnvSmtpPort() {
  return process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
}
function getEnvGoogleAppsScriptUrl() {
  return (process.env.GOOGLE_APPS_SCRIPT_URL || process.env.EMAIL_RELAY_URL || process.env.APPS_SCRIPT_URL || process.env.GAS_URL)?.trim();
}
function getEnvBrevoKey() {
  return (process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || process.env.SIB_API_KEY)?.trim();
}
function getEnvResendKey() {
  return (process.env.RESEND_API_KEY || process.env.RESEND_KEY)?.trim();
}
function getEnvSendGridKey() {
  return (process.env.SENDGRID_API_KEY || process.env.SG_API_KEY)?.trim();
}
app.get(["/api/health", "/api/ping"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    service: "Nepal Electricity Market Clearing Engine",
    hasBrevoKey: !!getEnvBrevoKey(),
    hasResendKey: !!getEnvResendKey(),
    hasSendGridKey: !!getEnvSendGridKey(),
    hasGoogleScriptUrl: !!getEnvGoogleAppsScriptUrl(),
    smtpConfigured: !!(getEnvEmailSender() && getEnvEmailPassword())
  });
});
app.get("/api/email-env-status", (_req, res) => {
  const sender = getEnvEmailSender();
  const hasPass = !!getEnvEmailPassword();
  const gasUrl = getEnvGoogleAppsScriptUrl();
  const brevoKey = getEnvBrevoKey();
  const resendKey = getEnvResendKey();
  const sgKey = getEnvSendGridKey();
  const maskedSender = sender ? sender.replace(/^(..)(.*)(@.*)$/, (_m, p1, _p2, p3) => `${p1}***${p3}`) : "";
  let activeProvider = "None";
  if (gasUrl) {
    activeProvider = "Google Apps Script Relay (HTTPS)";
  } else if (brevoKey) {
    activeProvider = "Brevo HTTP API (HTTPS)";
  } else if (resendKey) {
    activeProvider = "Resend HTTP API (HTTPS)";
  } else if (sgKey) {
    activeProvider = "SendGrid HTTP API (HTTPS)";
  } else if (sender && hasPass) {
    activeProvider = `Gmail/SMTP (${getEnvSmtpHost()})`;
  }
  res.json({
    status: "ok",
    activeProvider,
    smtpConfigured: !!(sender && hasPass),
    smtpSender: maskedSender,
    smtpHost: getEnvSmtpHost(),
    smtpPort: getEnvSmtpPort(),
    hasGoogleScriptUrl: !!gasUrl,
    hasBrevoKey: !!brevoKey,
    hasResendKey: !!resendKey,
    hasSendGridKey: !!sgKey
  });
});
var externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (externalUrl) {
  const pingIntervalMs = 10 * 60 * 1e3;
  setInterval(async () => {
    try {
      const pingTarget = `${externalUrl.replace(/\/+$/, "")}/api/health`;
      await fetch(pingTarget);
      console.log(`[KeepAlive] Pinged ${pingTarget} successfully at ${(/* @__PURE__ */ new Date()).toISOString()}`);
    } catch (err) {
      console.warn(`[KeepAlive] Self-ping notice:`, err.message);
    }
  }, pingIntervalMs);
}
app.get("/api/fetch-sheet", async (req, res) => {
  const { sheetId, sheetName } = req.query;
  if (!sheetId || typeof sheetId !== "string") {
    return res.status(400).send("sheetId is required");
  }
  const sName = sheetName || "Form Responses 1";
  const targets = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sName)}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=0`
  ];
  for (const targetUrl of targets) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 10 && !text.includes("<!DOCTYPE html>")) {
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          return res.send(text);
        }
      }
    } catch (err) {
      console.warn(`Failed fetching from ${targetUrl}:`, err);
    }
  }
  return res.status(502).send("Failed to retrieve spreadsheet data from Google Sheets");
});
process.on("uncaughtException", (err) => {
  console.error("[Process SafeGuard] uncaughtException caught:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Process SafeGuard] unhandledRejection caught:", reason?.message || reason);
});
function withTimeout(promise, ms, errMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms))
  ]);
}
var smtpConnectivityCache = null;
async function checkSmtpReachable(host, port, timeoutMs = 2e3) {
  const now = Date.now();
  if (smtpConnectivityCache && smtpConnectivityCache.host === host && smtpConnectivityCache.port === port && now - smtpConnectivityCache.lastChecked < 3e4) {
    return smtpConnectivityCache.reachable;
  }
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host, port, timeout: timeoutMs });
    socket.on("connect", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: true, lastChecked: Date.now(), host, port };
        resolve(true);
      }
    });
    socket.on("timeout", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: false, lastChecked: Date.now(), host, port };
        resolve(false);
      }
    });
    socket.on("error", () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: false, lastChecked: Date.now(), host, port };
        resolve(false);
      }
    });
  });
}
function createDirectMailTransporter(user, pass, port = 465, secure = true, host) {
  const cleanPass = pass.replace(/\s+/g, "");
  const targetHost = host || getEnvSmtpHost();
  const tp = nodemailer.createTransport({
    host: targetHost,
    port,
    secure,
    auth: { user, pass: cleanPass },
    connectionTimeout: 4e3,
    greetingTimeout: 4e3,
    socketTimeout: 5e3,
    tls: {
      rejectUnauthorized: false
    }
  });
  tp.on("error", (err) => {
    console.warn(`[SMTP Warning] Transporter socket notice on port ${port}:`, err?.message || err);
  });
  return tp;
}
async function sendViaGoogleAppsScript(scriptUrl, payload) {
  try {
    const cleanUrl = scriptUrl.trim().replace(/\/dev(\?.*)?$/, "/exec$1");
    const gasPayload = {
      ...payload,
      body: payload.body || payload.text || payload.html || "",
      htmlBody: payload.htmlBody || payload.html || payload.text || ""
    };
    const res = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gasPayload),
      redirect: "follow"
    });
    const text = await res.text();
    if (text.includes("accounts.google.com") || text.includes("Sign in - Google Accounts") || text.includes("docs.google.com/favicon.ico") || text.includes("servicelogin")) {
      return {
        success: false,
        error: "Google Apps Script requires Google Login. Please deploy it with 'Who has access' set to 'Anyone' (not 'Only myself' or domain-only), and use the /exec deployment URL."
      };
    }
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok && (text.includes("success") || text.includes("OK") || text.length === 0)) {
        return { success: true, messageId: `gas-${Date.now()}` };
      }
      return { success: false, error: `Google Apps Script returned non-JSON response: ${text.slice(0, 150)}` };
    }
    if (res.ok && data?.success !== false) {
      return { success: true, messageId: data.messageId || `gas-${Date.now()}` };
    }
    return { success: false, error: data?.error || data?.message || `Google Apps Script error (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: err.message || "Google Apps Script HTTP relay failed" };
  }
}
async function sendViaResendHttp(apiKey, to, subject, html, text, fromEmail = "onboarding@resend.dev") {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `Nepal Electricity Market <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text
      })
    });
    const data = await res.json();
    if (res.ok && data?.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data?.message || `Resend API error (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: err.message || "Resend HTTP API failed" };
  }
}
async function sendViaBrevoHttp(apiKey, senderEmail, to, subject, html, text) {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey.trim(),
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Nepal Electricity Market Clearing Engine", email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text
      })
    });
    const data = await res.json();
    if (res.ok && data?.messageId) {
      return { success: true, messageId: data.messageId };
    }
    return { success: false, error: data?.message || `Brevo API error (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: err.message || "Brevo HTTP API failed" };
  }
}
async function sendViaSendGridHttp(apiKey, senderEmail, to, subject, html, text) {
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: "Nepal Electricity Market Clearing Engine" },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      })
    });
    if (res.status === 202 || res.ok) {
      return { success: true, messageId: `sg-${Date.now()}` };
    }
    const errText = await res.text();
    return { success: false, error: `SendGrid error (HTTP ${res.status}): ${errText.slice(0, 150)}` };
  } catch (err) {
    return { success: false, error: err.message || "SendGrid HTTP API failed" };
  }
}
async function sendMailWithFallback(user, pass, mailOptions, customHost, customPort) {
  const cleanPass = pass.replace(/\s+/g, "");
  const host = customHost || getEnvSmtpHost();
  const primaryPort = customPort || (host === "smtp.gmail.com" ? 465 : 465);
  const isPrimary = await checkSmtpReachable(host, primaryPort, 2e3);
  if (!isPrimary) {
    const is587 = await checkSmtpReachable(host, 587, 2e3);
    if (!is587) {
      throw new Error(
        `Outbound SMTP connection to ${host}:${primaryPort}/587 timed out. Note: On Render free tier services, outbound SMTP ports are blocked by Render. To send emails on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Settings.`
      );
    }
  }
  try {
    const tpPrimary = createDirectMailTransporter(user, cleanPass, primaryPort, primaryPort === 465, host);
    return await withTimeout(
      tpPrimary.sendMail(mailOptions),
      4500,
      `Port ${primaryPort} connection timed out`
    );
  } catch (errPrimary) {
    console.warn(`[SMTP Port ${primaryPort}] notice (${errPrimary.message}), attempting fallback to Port 587...`);
    try {
      const tp587 = createDirectMailTransporter(user, cleanPass, 587, false, host);
      return await withTimeout(
        tp587.sendMail(mailOptions),
        4500,
        "Port 587 connection timed out"
      );
    } catch (err587) {
      console.error("[SMTP] Both Port 465 and Port 587 attempts failed:", err587.message);
      throw new Error(
        `SMTP delivery failed (${errPrimary.message || err587.message}). Note: On Render free tier services, raw outbound SMTP ports (465/587) are blocked by Render. You can add BREVO_API_KEY, RESEND_API_KEY, or GOOGLE_APPS_SCRIPT_URL in your Render environment variables for 100% guaranteed delivery.`
      );
    }
  }
}
async function dispatchSingleEmail(job, smtpCredentials, httpApi) {
  const scriptUrl = httpApi?.googleAppsScriptUrl || getEnvGoogleAppsScriptUrl();
  if (scriptUrl && scriptUrl.trim().length > 10) {
    const res = await sendViaGoogleAppsScript(scriptUrl, {
      to: job.to,
      subject: job.subject,
      html: job.html,
      text: job.text
    });
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: "Google Apps Script (HTTPS)" };
    }
    console.warn("[Dispatch] Google Apps Script relay failed, trying next provider:", res.error);
  }
  const brevoKey = httpApi?.brevoApiKey || getEnvBrevoKey();
  if (brevoKey && brevoKey.trim().length > 10) {
    const senderEmail2 = smtpCredentials?.sender || getEnvEmailSender();
    const res = await sendViaBrevoHttp(brevoKey, senderEmail2, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: "Brevo HTTP API (HTTPS)" };
    }
    console.warn("[Dispatch] Brevo API failed, trying next provider:", res.error);
  }
  const resendKey = httpApi?.resendApiKey || getEnvResendKey();
  if (resendKey && resendKey.trim().length > 10) {
    const res = await sendViaResendHttp(resendKey, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: "Resend HTTP API (HTTPS)" };
    }
    console.warn("[Dispatch] Resend API failed, trying next provider:", res.error);
  }
  const sgKey = getEnvSendGridKey();
  if (sgKey && sgKey.trim().length > 10) {
    const senderEmail2 = smtpCredentials?.sender || getEnvEmailSender();
    const res = await sendViaSendGridHttp(sgKey, senderEmail2, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: "SendGrid HTTP API (HTTPS)" };
    }
    console.warn("[Dispatch] SendGrid API failed, trying next provider:", res.error);
  }
  const senderEmail = smtpCredentials?.sender || getEnvEmailSender();
  const senderPass = smtpCredentials?.password ? smtpCredentials.password.replace(/\s+/g, "") : getEnvEmailPassword();
  try {
    const info = await sendMailWithFallback(
      senderEmail,
      senderPass,
      {
        from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
        replyTo: getEnvReplyTo(),
        to: job.to,
        subject: job.subject,
        text: job.text,
        html: job.html
      },
      smtpCredentials?.host,
      smtpCredentials?.port
    );
    return { success: true, messageId: info.messageId, providerUsed: `SMTP (${getEnvSmtpHost()})` };
  } catch (err) {
    return {
      success: false,
      error: err.message || "SMTP delivery failed.",
      providerUsed: "None (Delivery Failed)"
    };
  }
}
app.post(["/api/verify-smtp", "/api/verify-email-provider"], async (req, res) => {
  const { sender, password, httpApiKey, googleAppsScriptUrl, provider } = req.body || {};
  if (provider === "google_script" || googleAppsScriptUrl) {
    const rawUrl = googleAppsScriptUrl || httpApiKey;
    if (!rawUrl || !rawUrl.startsWith("http")) {
      return res.json({ success: false, error: "Valid Google Apps Script Web App URL required" });
    }
    const cleanUrl = rawUrl.trim().replace(/\/dev(\?.*)?$/, "/exec$1");
    try {
      const getRes = await fetch(cleanUrl, { redirect: "follow" });
      const getText = await getRes.text();
      if (getText.includes("accounts.google.com") || getText.includes("Sign in - Google Accounts") || getText.includes("docs.google.com/favicon.ico") || getText.includes("servicelogin")) {
        return res.json({
          success: false,
          error: "Google Apps Script requires Google Login! In Apps Script, click 'Deploy' -> 'New deployment' -> type: 'Web app' -> set 'Execute as: Me' and 'Who has access: Anyone' (not 'Only myself' or domain-only), and use the /exec deployment URL."
        });
      }
      try {
        const getData = JSON.parse(getText);
        if (getData?.success || getData?.message?.toLowerCase().includes("running") || getData?.message?.toLowerCase().includes("relay")) {
          return res.json({
            success: true,
            message: `Google Apps Script Relay verified successfully! (${getData.message || "Ready to send"})`
          });
        }
      } catch {
      }
      const pingRes = await fetch(cleanUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping", to: "test@example.com", subject: "Ping Check" }),
        redirect: "follow"
      });
      const pingText = await pingRes.text();
      if (pingText.includes("accounts.google.com") || pingText.includes("Sign in - Google Accounts") || pingText.includes("servicelogin")) {
        return res.json({
          success: false,
          error: "Google Apps Script requires Google Login! Please set 'Who has access' to 'Anyone' in your Apps Script Web App deployment."
        });
      }
      try {
        const pingData = JSON.parse(pingText);
        if (pingData?.success || pingData?.message || pingData?.recipient) {
          return res.json({
            success: true,
            message: `Google Apps Script Relay verified successfully! Ready to send via Gmail.`
          });
        }
      } catch {
      }
      if (pingRes.ok) {
        return res.json({
          success: true,
          message: "Google Apps Script Relay responded successfully (HTTP 200)! Ready to send via Gmail."
        });
      }
      return res.json({
        success: false,
        error: `Google Apps Script returned HTTP ${pingRes.status}: ${pingText.slice(0, 150)}`
      });
    } catch (err) {
      return res.json({ success: false, error: `Could not reach Google Apps Script URL: ${err.message}` });
    }
  }
  if (provider === "brevo" || httpApiKey && httpApiKey.startsWith("xkeysib-")) {
    const key = httpApiKey;
    try {
      const testRes = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": key.trim(), "Accept": "application/json" }
      });
      if (testRes.ok) {
        const data2 = await testRes.json();
        return res.json({
          success: true,
          message: `Brevo API connection verified successfully! Account: ${data2.email || "Active"}`
        });
      }
      const data = await testRes.json();
      return res.json({ success: false, error: data?.message || `Brevo authentication failed (HTTP ${testRes.status})` });
    } catch (err) {
      return res.json({ success: false, error: `Brevo API check error: ${err.message}` });
    }
  }
  if (provider === "resend" || httpApiKey && httpApiKey.startsWith("re_")) {
    const key = httpApiKey;
    try {
      const testRes = await fetch("https://api.resend.com/api-keys", {
        headers: { "Authorization": `Bearer ${key.trim()}` }
      });
      if (testRes.ok) {
        return res.json({ success: true, message: "Resend HTTP API connection verified successfully!" });
      }
      const data = await testRes.json();
      return res.json({ success: false, error: data?.message || `Resend authentication failed (HTTP ${testRes.status})` });
    } catch (err) {
      return res.json({ success: false, error: `Resend API check error: ${err.message}` });
    }
  }
  const user = sender || getEnvEmailSender();
  const pass = password ? password.replace(/\s+/g, "") : getEnvEmailPassword();
  try {
    const is465 = await checkSmtpReachable("smtp.gmail.com", 465, 2e3);
    const is587 = is465 ? true : await checkSmtpReachable("smtp.gmail.com", 587, 2e3);
    if (!is465 && !is587) {
      return res.status(200).json({
        success: false,
        error: "Outbound SMTP ports (465/587) timed out. Note: On Render free tier services, raw outbound SMTP ports are blocked by Render. To send emails on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Provider Settings."
      });
    }
    let tp = createDirectMailTransporter(user, pass, is465 ? 465 : 587, is465);
    await withTimeout(tp.verify(), 4e3, "SMTP verify timed out");
    return res.status(200).json({ success: true, message: `SMTP connection verified successfully for ${user}!` });
  } catch (err) {
    console.error("SMTP verify error:", err.message);
    return res.status(200).json({
      success: false,
      error: `Notice: ${err.message || String(err)}. Note: On Render free tier services, raw outbound SMTP ports (465/587) are blocked by Render. You can add BREVO_API_KEY, RESEND_API_KEY, or GOOGLE_APPS_SCRIPT_URL in your Render environment variables for 100% guaranteed delivery.`
    });
  }
});
app.post("/api/send-single-email", async (req, res) => {
  try {
    const { to, subject, html, text, smtpCredentials, httpApi } = req.body || {};
    if (!to || !to.includes("@")) {
      return res.status(200).json({ success: false, error: "Valid recipient email required" });
    }
    const result = await dispatchSingleEmail(
      { to, subject, html, text },
      smtpCredentials,
      httpApi
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in /api/send-single-email:", err);
    return res.status(200).json({
      success: false,
      error: err.message || "Email delivery failed on server"
    });
  }
});
app.post("/api/send-emails", async (req, res) => {
  try {
    const { jobs, dryRun, smtpCredentials, httpApi } = req.body || {};
    if (!jobs || !Array.isArray(jobs)) {
      return res.status(200).json({ success: false, error: "jobs array required", logs: [] });
    }
    const logs = [];
    if (dryRun) {
      for (const job of jobs) {
        logs.push({
          name: job.name,
          role: job.role,
          email: job.email,
          status: job.email && job.email.includes("@") ? "dry_run" : "no_email",
          attempts: 0,
          awarded_mw: job.awarded_mw,
          amount_nrs: job.amount_nrs,
          sent_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return res.status(200).json({ success: true, dryRun: true, logs });
    }
    const scriptUrl = httpApi?.googleAppsScriptUrl || getEnvGoogleAppsScriptUrl();
    if (scriptUrl && scriptUrl.trim().length > 10) {
      try {
        const validJobs = jobs.filter((j) => j.email && j.email.includes("@"));
        if (validJobs.length > 0) {
          const batchRes = await sendViaGoogleAppsScript(scriptUrl, {
            action: "send_batch",
            jobs: validJobs.map((j) => ({
              to: j.email,
              subject: j.subject,
              html: j.html,
              text: j.text,
              name: j.name,
              role: j.role
            }))
          });
          if (batchRes.success) {
            for (const job of jobs) {
              if (!job.email || !job.email.includes("@")) {
                logs.push({
                  name: job.name,
                  role: job.role,
                  email: "",
                  status: "no_email",
                  attempts: 0,
                  awarded_mw: job.awarded_mw,
                  amount_nrs: job.amount_nrs,
                  sent_at: ""
                });
              } else {
                logs.push({
                  name: job.name,
                  role: job.role,
                  email: job.email,
                  status: "sent",
                  attempts: 1,
                  awarded_mw: job.awarded_mw,
                  amount_nrs: job.amount_nrs,
                  sent_at: (/* @__PURE__ */ new Date()).toISOString()
                });
              }
            }
            return res.status(200).json({ success: true, dryRun: false, logs, provider: "Google Apps Script Batch" });
          }
        }
      } catch (gasErr) {
        console.warn("[Dispatch] Google Apps Script bulk batch call failed, falling back to chunked dispatch:", gasErr.message);
      }
    }
    const hasHttpRelay = !!(scriptUrl || getEnvBrevoKey() || getEnvResendKey() || getEnvSendGridKey() || httpApi?.brevoApiKey || httpApi?.resendApiKey);
    if (!hasHttpRelay) {
      const is465Reachable = await checkSmtpReachable(getEnvSmtpHost(), 465, 2e3);
      const is587Reachable = is465Reachable ? true : await checkSmtpReachable(getEnvSmtpHost(), 587, 2e3);
      if (!is465Reachable && !is587Reachable) {
        return res.status(200).json({
          success: false,
          error: "Outbound SMTP connection to smtp.gmail.com:465/587 timed out. Note: On Render free tier services, raw outbound SMTP ports are blocked by Render's firewall. To send 1-click email notifications on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Provider Settings.",
          logs: jobs.map((j) => ({
            name: j.name,
            role: j.role,
            email: j.email || "",
            status: j.email && j.email.includes("@") ? "failed" : "no_email",
            attempts: j.email && j.email.includes("@") ? 1 : 0,
            error: "Render free firewall blocks outbound SMTP ports 465/587. Configure Google Apps Script Relay or Brevo in Email Settings.",
            awarded_mw: j.awarded_mw,
            amount_nrs: j.amount_nrs,
            sent_at: ""
          }))
        });
      }
    }
    const CONCURRENCY = 2;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const chunk = jobs.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (job) => {
          if (!job.email || !job.email.includes("@")) {
            logs.push({
              name: job.name,
              role: job.role,
              email: "",
              status: "no_email",
              attempts: 0,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: ""
            });
            return;
          }
          const dispatchResult = await dispatchSingleEmail(
            {
              to: job.email,
              subject: job.subject,
              html: job.html,
              text: job.text,
              name: job.name,
              role: job.role
            },
            smtpCredentials,
            httpApi
          );
          if (dispatchResult.success) {
            logs.push({
              name: job.name,
              role: job.role,
              email: job.email,
              status: "sent",
              attempts: 1,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: (/* @__PURE__ */ new Date()).toISOString()
            });
          } else {
            logs.push({
              name: job.name,
              role: job.role,
              email: job.email,
              status: "failed",
              attempts: 1,
              error: dispatchResult.error,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: ""
            });
          }
        })
      );
    }
    return res.status(200).json({ success: true, dryRun: false, logs });
  } catch (err) {
    console.error("Error in /api/send-emails:", err);
    return res.status(200).json({
      success: false,
      error: err.message || "Batch email dispatch failed on server",
      logs: []
    });
  }
});
app.get("/api/download-standalone", (req, res) => {
  const sheetId = req.query.sheetId || "17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg";
  const sheetName = req.query.sheetName || "Form Responses 1";
  const formUrl = req.query.formUrl || "https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform";
  const html = generateStandaloneHTML(sheetId, sheetName, formUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="nepal_electricity_market_standalone.html"');
  res.send(html);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`\u26A1 Server running at http://0.0.0.0:${PORT} (Port ${PORT})`);
  });
}
startServer();
