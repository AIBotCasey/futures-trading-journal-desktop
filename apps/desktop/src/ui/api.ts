import { invoke } from '@tauri-apps/api/core';
import type { AppStatus, Settings, Rule, Trade, TradeInput, TradeWithRules, DaySummary } from './types';

export async function appGetStatus(): Promise<AppStatus> {
  return invoke<AppStatus>('app_get_status');
}

export async function settingsGet(): Promise<Settings> {
  return invoke<Settings>('settings_get');
}

export async function settingsUpdate(timezone: string): Promise<Settings> {
  return invoke<Settings>('settings_update', { req: { timezone } });
}

export async function rulesList(): Promise<Rule[]> {
  return invoke<Rule[]>('rules_list');
}

export async function rulesUpsert(rule: Rule): Promise<void> {
  return invoke<void>('rules_upsert', { req: rule });
}

export async function rulesDelete(id: string): Promise<void> {
  return invoke<void>('rules_delete', { id });
}

export async function tradesList(limit = 200, offset = 0): Promise<Trade[]> {
  return invoke<Trade[]>('trades_list', { req: { limit, offset } });
}

export async function tradesGet(id: string): Promise<TradeWithRules> {
  return invoke<TradeWithRules>('trades_get', { id });
}

export async function tradesCreate(input: TradeInput): Promise<Trade> {
  return invoke<Trade>('trades_create', { input });
}

export async function tradesUpdate(id: string, input: TradeInput): Promise<Trade> {
  return invoke<Trade>('trades_update', { req: { id, input } });
}

export async function tradesDelete(id: string): Promise<void> {
  return invoke<void>('trades_delete', { id });
}

export async function journalMonthSummary(year: number, month: number): Promise<DaySummary[]> {
  return invoke<DaySummary[]>('journal_month_summary', { req: { year, month } });
}
