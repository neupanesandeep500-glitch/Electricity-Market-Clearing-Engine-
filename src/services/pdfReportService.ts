import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SlotClearingResult, SettlementRecord, ParticipantSummaryItem } from '../types';

export interface GeneratePDFReportOptions {
  results: Record<number, SlotClearingResult>;
  settlements: SettlementRecord[];
  participantSummaries: ParticipantSummaryItem[];
  nSlots: number;
  sessionLabel?: string;
  totalBuyers?: number;
  totalSellers?: number;
}

/**
 * Generate a comprehensive, professional PDF Market Settlement Report on 1 click
 */
export function generateMarketReportPDF({
  results,
  settlements,
  participantSummaries,
  nSlots,
  sessionLabel = 'NEM Session',
  totalBuyers = 0,
  totalSellers = 0,
}: GeneratePDFReportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const slotsList = Array.from({ length: nSlots }, (_, i) => i + 1);
  const clearedSlots = slotsList.filter((s) => results[s]?.status === 'Cleared');

  // Compute key market metrics
  const totalClearedMw = clearedSlots.reduce((acc, s) => acc + (results[s]?.mcv_mw || 0), 0);
  const totalClearedMwh = clearedSlots.reduce((acc, s) => acc + (results[s]?.mcv_mwh || 0), 0);
  const totalTurnoverNrs = clearedSlots.reduce((acc, s) => acc + (results[s]?.market_value || 0), 0);
  const weightedAvgMcp =
    totalClearedMw > 0
      ? clearedSlots.reduce((acc, s) => acc + (results[s]?.mcp || 0) * (results[s]?.mcv_mw || 0), 0) /
        totalClearedMw
      : 0;

  const totalDemandMw = slotsList.reduce((acc, s) => acc + (results[s]?.total_demand || 0), 0);
  const totalSupplyMw = slotsList.reduce((acc, s) => acc + (results[s]?.total_supply || 0), 0);

  // ==========================================
  // 1. TOP HEADER BANNER
  // ==========================================
  doc.setFillColor(13, 27, 75); // #0D1B4B
  doc.rect(0, 0, 210, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('NEPAL ELECTRICITY MARKET (NEM) CLEARING REPORT', 14, 12);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // #CBD5E1
  doc.text('Optimal Nodal Pricing, Merit-Order Dispatch & Financial Settlement Summary', 14, 18);

  // Date and Session Info (Right aligned)
  doc.setFontSize(8);
  doc.setTextColor(251, 191, 36); // #FBBF24 Amber
  doc.setFont('helvetica', 'bold');
  doc.text(`${sessionLabel.toUpperCase()}`, 196, 12, { align: 'right' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 18, { align: 'right' });

  // ==========================================
  // 2. EXECUTIVE MARKET SUMMARY CARDS
  // ==========================================
  let currentY = 34;

  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.roundedRect(14, currentY, 182, 26, 3, 3, 'FD');

  // KPI 1: Total Turnover
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL FINANCIAL TURNOVER', 18, currentY + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // Emerald #047857
  doc.text(`NRs ${Math.round(totalTurnoverNrs).toLocaleString('en-US')}`, 18, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Aggregated 15-min settlement', 18, currentY + 20);

  // KPI 2: Total Energy Volume
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL CLEARED ENERGY', 66, currentY + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216); // Blue #1D4ED8
  doc.text(`${totalClearedMwh.toFixed(3)} MWh`, 66, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Peak Load: ${totalClearedMw.toFixed(1)} MW`, 66, currentY + 20);

  // KPI 3: Weighted Avg MCP
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('VOLUME-WEIGHTED MCP', 114, currentY + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber #B45309
  doc.text(`NRs ${weightedAvgMcp.toFixed(3)} / kWh`, 114, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Weighted equilibrium rate', 114, currentY + 20);

  // KPI 4: Participants
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('MARKET PARTICIPATION', 160, currentY + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate #0F172A
  doc.text(`${participantSummaries.length} Entities`, 160, currentY + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${totalBuyers} Buyers | ${totalSellers} Sellers`, 160, currentY + 20);

  currentY += 32;

  // ==========================================
  // 3. TABLE 1: TRADING INTERVAL RESULTS
  // ==========================================
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 27, 75);
  doc.text('1. Slot-Wise Market Clearing & Nodal Settlement', 14, currentY);

  const slotHeaders = [
    'Slot',
    'MCP (NRs/kWh)',
    'Cleared MW',
    'Cleared MWh',
    'Demand (MW)',
    'Supply (MW)',
    'Market Turnover (NRs)',
    'Clearing Mode',
    'Status',
  ];

  const slotRows = slotsList.map((s) => {
    const r = results[s];
    if (!r || r.status !== 'Cleared') {
      return [`T${s}`, '—', '—', '—', '—', '—', 'NRs 0', '—', 'Pending'];
    }
    return [
      `T${s}`,
      `NRs ${r.mcp.toFixed(3)}`,
      `${r.mcv_mw.toFixed(2)} MW`,
      `${r.mcv_mwh.toFixed(3)} MWh`,
      `${r.total_demand.toFixed(1)} MW`,
      `${r.total_supply.toFixed(1)} MW`,
      `NRs ${Math.round(r.market_value).toLocaleString('en-US')}`,
      r.clearing_mode.includes('Generator') ? 'Generator Cap' : 'Intersection',
      r.status,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [slotHeaders],
    body: slotRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [26, 35, 126], // #1A237E
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'right', textColor: [180, 83, 9], fontStyle: 'bold' },
      2: { halign: 'right', textColor: [29, 78, 216], fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', textColor: [4, 120, 87], fontStyle: 'bold' },
      7: { halign: 'center', fontSize: 7 },
      8: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // ==========================================
  // 4. TABLE 2: PARTICIPANT SETTLEMENT REGISTER
  // ==========================================
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 10;

  // Check if we need a page break before Section 2
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 27, 75);
  doc.text('2. Participant Commercial Obligations & Settlement Register', 14, currentY);

  const participantHeaders = [
    'Participant Name',
    'Role',
    'Total Cleared (MW)',
    'Cleared Energy (MWh)',
    'Settlement Value (NRs)',
    'Commercial Position & Obligation',
  ];

  const participantRows = participantSummaries.map((p) => {
    const isBuyer = String(p.role).toLowerCase() === 'buyer';
    const mw = p.actual_dispatch_drawl_mw || 0;
    const mwh = mw * 0.25;
    const amount = p.total_settlement_nrs || 0;
    const obligationText = isBuyer
      ? `Payable to Market: NRs ${Math.round(amount).toLocaleString('en-US')}`
      : `Receivable from Market: NRs ${Math.round(amount).toLocaleString('en-US')}`;

    return [
      p.name,
      isBuyer ? 'BUYER (Demand)' : 'SELLER (Supply)',
      `${mw.toFixed(2)} MW`,
      `${mwh.toFixed(3)} MWh`,
      `NRs ${Math.round(amount).toLocaleString('en-US')}`,
      obligationText,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [participantHeaders],
    body: participantRows.length > 0 ? participantRows : [['No participants cleared in this session', '', '', '', '', '']],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [13, 27, 75], // #0D1B4B
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', fontSize: 7.5 },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', textColor: [4, 120, 87], fontStyle: 'bold' },
      5: { halign: 'left', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // ==========================================
  // 5. OFFICIAL FOOTER ON ALL PAGES
  // ==========================================
  // @ts-ignore
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 285, 196, 285);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.text(
      'Nepal Electricity Market Clearing Engine • Commercial Energy Dispatch & Settlement Record • Verified & Locked',
      14,
      290
    );
    doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: 'right' });
  }

  // Save the PDF file to user device
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Nepal_Electricity_Market_Clearing_Report_${dateStr}.pdf`);
}
