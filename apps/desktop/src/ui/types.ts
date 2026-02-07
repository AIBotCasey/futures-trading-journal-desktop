export type DbStatus = {
  configured: boolean;
  encrypted: boolean;
  unlocked: boolean;
};

export type AppStatus = {
  db: DbStatus;
};

export type Settings = {
  timezone: string;
};

export type Rule = {
  id: string;
  label: string;
  sort_order: number;
};

export type Trade = {
  id: string;
  market: string;
  symbol: string;
  side: string;
  qty: number;
  entry_time_utc: number;
  exit_time_utc: number;
  timezone: string;
  session: string;
  pnl_amount: number;
  pnl_includes_fees: number; // 0/1 stored
  fees: number;
  pnl_net: number;
  pnl_gross: number;
  notes: string;
  created_at_utc: number;
  updated_at_utc: number;
};

export type TradeInput = {
  market: string;
  symbol: string;
  side: string;
  qty: number;
  entry_time_utc: number;
  exit_time_utc: number;
  timezone: string;
  session: string;
  pnl_amount: number;
  pnl_includes_fees: boolean;
  fees: number;
  notes: string;
  rules_checked?: Record<string, boolean>;
};

export type TradeWithRules = {
  trade: Trade;
  rules: Rule[];
  checked: Record<string, boolean>;
};

export type DaySummary = {
  date_local: string; // YYYY-MM-DD
  trade_count: number;
  pnl_net_total: number;
};

export type TradeHighlight = {
  id: string;
  symbol: string;
  qty: number;
  pnl_net: number;
  notes: string;
  exit_time_utc: number;
};

export type JournalEntry = {
  date_local: string;
  text: string;
};
