/**
 * Types for the Nepal Electricity Market Simulation & Clearing Engine
 */

export type ParticipantRole = 'buyer' | 'seller';

export type AcceptanceStatus = 'Full' | 'Partial' | 'Rejected' | 'No Trade';

export interface RawBidOfferRecord {
  name: string;
  email: string;
  role: ParticipantRole;
  slot: number;
  price: number;
  quantity: number;
  timestamp?: string | null;
  row_order: number;
}

export interface AcceptedParticipant {
  name: string;
  email?: string;
  price: number;
  quantity: number;
  qty_accepted: number;
  acceptance_status: AcceptanceStatus;
}

export interface SlotClearingResult {
  slot: number;
  status: 'Cleared' | 'No Trade';
  mcp: number;                // Market Clearing Price (NRs/kWh)
  mcv_mw: number;             // Market Clearing Volume in MW (15-min)
  mcv_mwh: number;            // MCV in MWh = MW * 0.25
  market_value: number;       // MCP * MCV_MWh * 1000 (NRs)
  clearing_mode: string;       // 'Normal Intersection' | 'Demand-Exceeds-All-Supply (Generator Cap)'
  total_demand: number;       // MW
  total_supply: number;       // MW
  accepted_buyers: AcceptedParticipant[];
  accepted_sellers: AcceptedParticipant[];
  all_buyers: (AcceptedParticipant & { timestamp?: string | null; row_order?: number })[];
  all_sellers: (AcceptedParticipant & { timestamp?: string | null; row_order?: number })[];
}

export interface DiagnosticsData {
  rows_seen: number;
  rows_skipped_no_role: number;
  values_dropped_nan: number;
  values_dropped_nonpos: number;
  values_dropped_outlier: number;
  records_kept: number;
  timestamp_col_found: boolean;
  unique_buyers: number;
  unique_sellers: number;
  missing_email_buyers: number;
  missing_email_sellers: number;
  incomplete_buyers: number;
  incomplete_sellers: number;
  duplicate_buyer_rows: number;
  duplicate_seller_rows: number;
}

export interface SettlementRecord {
  slot: string;
  role: 'Buyer' | 'Seller';
  participant: string;
  email: string;
  mcp: number;
  qty_accepted_mw: number;
  energy_mwh: number;
  amount_nrs: number;
  status: AcceptanceStatus;
}

export interface ParticipantSummaryItem {
  name: string;
  role: ParticipantRole;
  email: string;
  total_bid_offer_mw: number;
  actual_dispatch_drawl_mw: number;
  acceptance_rate_pct: number;
  total_settlement_nrs: number;
}

export interface EmailLogEntry {
  name: string;
  role: ParticipantRole;
  email: string;
  status: 'sent' | 'failed' | 'dry_run' | 'no_email';
  attempts: number;
  awarded_mw: number;
  amount_nrs: number;
  error?: string;
  sent_at?: string;
}

export interface ParticipantSlotEmailData {
  slot: number;
  status: 'Cleared' | 'No Trade';
  mcp: number;
  mcv_mw: number;
  mcv_mwh: number;
  market_value: number;
  clearing_mode: string;
  submitted_qty: number;
  submitted_price: number;
  awarded_qty: number;
  acceptance_status: AcceptanceStatus;
  amount_nrs: number;
}

export interface GoogleSheetConfig {
  sheetId: string;
  sheetName: string;
  googleFormUrl: string;
  autoSync: boolean;
  syncIntervalSec: number;
}

export type UserRole = 'ADMIN' | 'USERS';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  createdAt: string;
  isSystemUser?: boolean;
  disabled?: boolean;
}
