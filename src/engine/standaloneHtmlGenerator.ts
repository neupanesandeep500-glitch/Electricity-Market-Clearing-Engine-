/**
 * Standalone HTML Application Generator
 * Produces a single, self-contained HTML file that runs 100% in any browser.
 * Directly linked with Google Sheets, generates QR for Google Forms,
 * and executes the full V5 Market Clearing Algorithm offline or online.
 */

export function generateStandaloneHTML(
  sheetId = '17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg',
  sheetName = 'Form Responses 1',
  googleFormUrl = 'https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform'
): string {
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
        <h1>⚡ Electricity Market Clearing Engine</h1>
        <p>Standalone V5.0 · Optimal Nodal Pricing & Economic Dispatch</p>
      </div>
      <div class="header-actions">
        <div id="standaloneClock" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); padding:6px 12px; border-radius:10px; display:flex; align-items:center; gap:8px; font-size:0.78rem;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00E676;"></span>
          <span id="standaloneDayDate" style="color:#FFE082; font-weight:700;">Loading...</span>
          <span id="standaloneTime" style="font-family:monospace; font-weight:800; font-size:0.92rem; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; color:#FFFFFF;">--:--:--</span>
          <span id="standaloneTz" style="font-size:0.68rem; color:#BBDEFB; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">Auto TZ</span>
        </div>
        <button class="btn btn-outline" onclick="openQrModal()">📱 Scan Form QR</button>
        <button class="btn btn-primary" onclick="syncGoogleSheet()">🔄 Refresh</button>
        <button class="btn btn-amber" onclick="openSettingsModal()">⚙ Settings</button>
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
          Participants scan the QR code to open the Google Form and submit bids (Buyers) or offers (Sellers) for 15-minute time slots (T1–T4).
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a id="formDirectLink" href="${googleFormUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background:#EBF3FB; color:var(--buyer); border:1px solid #BBDEFB;">
            🔗 Open Google Form
          </a>
          <button class="btn btn-outline" style="background:#F1F5F9; color:var(--text); border:1px solid var(--border);" onclick="copyFormLink()">
            📋 Copy Link
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
        <div class="kpi-val mono" id="kpiAvgMcp" style="color:var(--amber);">—</div>
        <div class="kpi-sub">NRs/kWh across cleared slots</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total MW Cleared</div>
        <div class="kpi-val mono" id="kpiTotalMw" style="color:var(--buyer);">—</div>
        <div class="kpi-sub">Megawatts (15-min)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Energy Cleared</div>
        <div class="kpi-val mono" id="kpiTotalMwh" style="color:#00838F;">—</div>
        <div class="kpi-sub">MWh (MW × 0.25)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Market Value</div>
        <div class="kpi-val mono" id="kpiMarketValue" style="color:var(--green);">—</div>
        <div class="kpi-sub">Nepalese Rupees (NRs)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Participants</div>
        <div class="kpi-val mono" id="kpiParticipants" style="color:var(--primary);">—</div>
        <div class="kpi-sub" id="kpiParticipantBreakdown">Buyers &amp; Sellers</div>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button class="tab-btn active" onclick="switchTab('overview')">📊 Market Overview</button>
      <button class="tab-btn" onclick="switchTab('curves')">📈 Supply &amp; Demand Curves</button>
      <button class="tab-btn" onclick="switchTab('settlement')">💰 Settlement Register</button>
      <button class="tab-btn" onclick="switchTab('participants')">👥 Participants &amp; Dispatch</button>
      <button class="tab-btn" onclick="switchTab('diagnostics')">🩺 Data Quality</button>
    </nav>

    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-pane">
      <div class="card">
        <div class="card-title">⚡ Slot-wise Market Clearing Results</div>
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
          <div class="card-title" style="margin:0;">📈 Interactive Supply &amp; Demand Intersection</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.8rem; font-weight:600;">Time Slot:</label>
            <select id="slotSelect" class="input" style="padding:4px 10px;" onchange="renderCurve()"></select>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="curveCanvas"></canvas>
        </div>
        <div style="display:flex; justify-content:center; gap:20px; margin-top:12px; font-size:0.78rem; font-weight:600;">
          <span style="color:var(--seller);">■ Demand Curve (Bids)</span>
          <span style="color:var(--buyer);">■ Supply Curve (Offers)</span>
          <span style="color:var(--amber);">★ Clearing Intersection (MCP/MCV)</span>
        </div>
      </div>
    </div>

    <!-- TAB 3: SETTLEMENT -->
    <div id="tab-settlement" class="tab-pane" style="display:none;">
      <div class="card">
        <div class="card-title">💰 Participant Financial Settlement Register</div>
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
        <div class="card-title">👥 Participant Total Bid vs Actual Dispatch / Drawl</div>
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
        <div class="card-title">🩺 Data Extraction &amp; Quality Audit</div>
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
      const mcv_mwh = Number((mcv_mw * 0.25).toFixed(5));
      const market_value = Math.round(mcp * mcv_mw * 0.25 * 1000 * 100 + 1e-7) / 100;
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

    // A participant who submitted twice must not be counted twice: keep the latest row per participant and slot.
    function dedupeLatest(list) {
      const m = new Map();
      for (const r of list) {
        const k = r.name + '|' + r.slot;
        const c = m.get(k);
        if (!c || r.row_order > c.row_order) m.set(k, r);
      }
      return Array.from(m.values());
    }

    function runSimulation(buyers, sellers, nSlots) {
      buyers = dedupeLatest(buyers);
      sellers = dedupeLatest(sellers);
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
      document.getElementById('kpiParticipantBreakdown').innerText = uBuyers + ' Buyers · ' + uSellers + ' Sellers';

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
            '<td style="text-align:center;"><span class="badge badge-full">✅ Cleared</span></td>' +
            '</tr>';
        } else {
          summaryBody.innerHTML += '<tr>' +
            '<td class="mono" style="font-weight:700; text-align:center;">T' + s + '</td>' +
            '<td colspan="7" style="text-align:center; color:var(--text-muted);">No intersection / Insufficient liquidity</td>' +
            '<td style="text-align:center;"><span class="badge badge-rejected">❌ No Trade</span></td>' +
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
