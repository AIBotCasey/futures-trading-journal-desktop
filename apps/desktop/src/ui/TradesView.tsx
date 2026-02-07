import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { Rule, Settings, Trade, TradeInput, TradeWithRules } from './types';
import { rulesList, settingsGet, tradesCreate, tradesDelete, tradesGet, tradesList, tradesUpdate } from './api';
import { parseLocalDateTimeInput, toLocalDateTimeInputValue } from './time';

const SESSIONS = [
  { id: 'asia', label: 'Asia' },
  { id: 'london', label: 'London' },
  { id: 'ny', label: 'NY' },
  { id: 'overlap', label: 'Overlap' },
  { id: 'other', label: 'Other' },
];

function money(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtDate(ms: number, tz?: string) {
  try {
    return new Date(ms).toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    });
  } catch {
    return new Date(ms).toLocaleString();
  }
}

type TradeFormState = {
  id?: string;
  market: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  entryLocal: string;
  exitLocal: string;
  session: string;
  pnlAmount: number;
  fees: number;
  pnlIncludesFees: boolean;
  notes: string;
  rulesChecked: Record<string, boolean>;
};

function buildDefaultForm(rules: Rule[]): TradeFormState {
  const now = new Date();
  const later = new Date(now.getTime() + 5 * 60 * 1000);
  const rulesChecked: Record<string, boolean> = {};
  for (const r of rules) rulesChecked[r.id] = false;

  return {
    market: 'futures',
    symbol: '',
    side: 'long',
    qty: 1,
    entryLocal: toLocalDateTimeInputValue(now),
    exitLocal: toLocalDateTimeInputValue(later),
    session: 'ny',
    pnlAmount: 0,
    fees: 0,
    pnlIncludesFees: true,
    notes: '',
    rulesChecked,
  };
}

export default function TradesView({
  timezone,
  openTradeId,
  onOpenedTrade,
}: {
  timezone: string | null;
  openTradeId?: string | null;
  onOpenedTrade?: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TradeFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSession, setFilterSession] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'win' | 'loss'>('all');
  const [filterStart, setFilterStart] = useState(''); // YYYY-MM-DD
  const [filterEnd, setFilterEnd] = useState('');   // YYYY-MM-DD

  const tz = timezone ?? settings?.timezone ?? undefined;

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [s, r, t] = await Promise.all([settingsGet(), rulesList(), tradesList()]);
      setSettings(s);
      setRules(r);
      setTrades(t);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openTradeId) return;
    void (async () => {
      await editTrade(openTradeId);
      onOpenedTrade?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTradeId]);

  const filteredTrades = useMemo(() => {
    const sym = filterSymbol.trim().toLowerCase();

    const startMs = filterStart ? new Date(`${filterStart}T00:00:00`).getTime() : null;
    const endMs = filterEnd ? new Date(`${filterEnd}T23:59:59`).getTime() : null;

    return trades.filter((t) => {
      if (sym && !t.symbol.toLowerCase().includes(sym)) return false;
      if (filterSession !== 'all' && t.session !== filterSession) return false;
      if (filterOutcome === 'win' && !(t.pnl_net > 0)) return false;
      if (filterOutcome === 'loss' && !(t.pnl_net < 0)) return false;
      if (startMs != null && t.exit_time_utc < startMs) return false;
      if (endMs != null && t.exit_time_utc > endMs) return false;
      return true;
    });
  }, [trades, filterSymbol, filterSession, filterOutcome, filterStart, filterEnd]);

  const stats = useMemo(() => {
    const total = filteredTrades.reduce((acc, t) => acc + (t.pnl_net ?? 0), 0);
    const wins = filteredTrades.filter((t) => (t.pnl_net ?? 0) > 0).length;
    const losses = filteredTrades.filter((t) => (t.pnl_net ?? 0) < 0).length;
    return { total, wins, losses, count: filteredTrades.length };
  }, [filteredTrades]);

  function newTrade() {
    if (!settings) return;
    const f = buildDefaultForm(rules);
    setForm(f);
    setOpen(true);
  }

  async function editTrade(id: string) {
    setSaving(true);
    setError('');
    try {
      const twr: TradeWithRules = await tradesGet(id);
      const t = twr.trade;
      const entry = new Date(t.entry_time_utc);
      const exit = new Date(t.exit_time_utc);

      const rulesChecked: Record<string, boolean> = {};
      for (const r of twr.rules) rulesChecked[r.id] = !!twr.checked[r.id];

      setForm({
        id: t.id,
        market: t.market,
        symbol: t.symbol,
        side: (t.side as 'long' | 'short') ?? 'long',
        qty: t.qty,
        entryLocal: toLocalDateTimeInputValue(entry),
        exitLocal: toLocalDateTimeInputValue(exit),
        session: t.session,
        pnlAmount: t.pnl_amount,
        fees: t.fees,
        pnlIncludesFees: t.pnl_includes_fees === 1,
        notes: t.notes,
        rulesChecked,
      });
      setOpen(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form || !settings) return;

    setSaving(true);
    setError('');
    try {
      const entry = parseLocalDateTimeInput(form.entryLocal);
      const exit = parseLocalDateTimeInput(form.exitLocal);

      const input: TradeInput = {
        market: form.market,
        symbol: form.symbol.trim(),
        side: form.side,
        qty: Number(form.qty),
        entry_time_utc: entry.getTime(),
        exit_time_utc: exit.getTime(),
        timezone: settings.timezone,
        session: form.session,
        pnl_amount: Number(form.pnlAmount),
        pnl_includes_fees: form.pnlIncludesFees,
        fees: Number(form.fees),
        notes: form.notes ?? '',
        rules_checked: form.rulesChecked,
      };

      if (form.id) {
        await tradesUpdate(form.id, input);
      } else {
        await tradesCreate(input);
      }

      setOpen(false);
      setForm(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setSaving(true);
    setError('');
    try {
      await tradesDelete(confirmDeleteId);
      setConfirmDeleteId(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1 }}>
          <Button variant="outlined" size="small" disabled sx={{ opacity: 1, justifyContent: 'flex-start' }}>
            Count: {stats.count}
          </Button>
          <Button variant="outlined" size="small" disabled sx={{ opacity: 1, justifyContent: 'flex-start' }}>
            Wins: {stats.wins}
          </Button>
          <Button variant="outlined" size="small" disabled sx={{ opacity: 1, justifyContent: 'flex-start' }}>
            Losses: {stats.losses}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled
            sx={{
              opacity: 1,
              justifyContent: 'flex-start',
              borderColor: stats.total >= 0 ? '#22c55e' : '#ef4444',
              color: stats.total >= 0 ? '#22c55e' : '#ef4444',
            }}
          >
            Total: {money(stats.total)}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Button variant="outlined" onClick={refresh} disabled={loading || saving}>
            Refresh
          </Button>
          <Button variant="contained" onClick={newTrade} disabled={loading || saving || !settings}>
            Add trade
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <Alert severity="info">Loading…</Alert> : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          label="Symbol"
          value={filterSymbol}
          onChange={(e) => setFilterSymbol(e.target.value)}
          size="small"
          sx={{ width: 120 }}
          inputProps={{ maxLength: 10 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Session</InputLabel>
          <Select
            label="Session"
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            {SESSIONS.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Outcome</InputLabel>
          <Select
            label="Outcome"
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value as 'all' | 'win' | 'loss')}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="win">Wins</MenuItem>
            <MenuItem value="loss">Losses</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="From"
          type="date"
          size="small"
          value={filterStart}
          onChange={(e) => setFilterStart(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={filterEnd}
          onChange={(e) => setFilterEnd(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setFilterSymbol('');
            setFilterSession('all');
            setFilterOutcome('all');
            setFilterStart('');
            setFilterEnd('');
          }}
        >
          Clear
        </Button>
      </Stack>

      {!loading && filteredTrades.length === 0 ? <Alert severity="info">No trades match your filters.</Alert> : null}

      <Stack spacing={1}>
        {filteredTrades.map((t) => (
          <Box
            key={t.id}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  {t.symbol} · {t.side.toUpperCase()} · {t.qty}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Entry: {fmtDate(t.entry_time_utc, tz)} · Exit: {fmtDate(t.exit_time_utc, tz)} · Session: {t.session}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {(() => {
                  const color = t.pnl_net >= 0 ? '#22c55e' : '#ef4444';
                  const bg = t.pnl_net >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
                  return (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled
                      sx={{
                        borderColor: color,
                        color,
                        bgcolor: bg,
                        opacity: 1,
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        '&.Mui-disabled': {
                          borderColor: color,
                          color,
                          bgcolor: bg,
                          opacity: 1,
                        },
                      }}
                    >
                      {money(t.pnl_net)}
                    </Button>
                  );
                })()}
                <Button variant="outlined" size="small" onClick={() => editTrade(t.id)} disabled={saving}>
                  Edit
                </Button>
                <Button variant="outlined" size="small" color="error" onClick={() => setConfirmDeleteId(t.id)} disabled={saving}>
                  Delete
                </Button>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Dialog open={open} onClose={() => (!saving ? setOpen(false) : null)} fullWidth maxWidth="md">
        <DialogTitle>{form?.id ? 'Edit trade' : 'Add trade'}</DialogTitle>
        <DialogContent>
          {form ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Symbol"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Side</InputLabel>
                  <Select
                    label="Side"
                    value={form.side}
                    onChange={(e) => setForm({ ...form, side: e.target.value as 'long' | 'short' })}
                  >
                    <MenuItem value="long">Long</MenuItem>
                    <MenuItem value="short">Short</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Qty"
                  type="number"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Entry"
                  type="datetime-local"
                  value={form.entryLocal}
                  onChange={(e) => setForm({ ...form, entryLocal: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Exit"
                  type="datetime-local"
                  value={form.exitLocal}
                  onChange={(e) => setForm({ ...form, exitLocal: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <FormControl fullWidth>
                  <InputLabel>Session</InputLabel>
                  <Select
                    label="Session"
                    value={form.session}
                    onChange={(e) => setForm({ ...form, session: e.target.value })}
                  >
                    {SESSIONS.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="PnL"
                  type="number"
                  value={form.pnlAmount}
                  onChange={(e) => setForm({ ...form, pnlAmount: Number(e.target.value) })}
                  fullWidth
                />
                <TextField
                  label="Fees"
                  type="number"
                  value={form.fees}
                  onChange={(e) => setForm({ ...form, fees: Number(e.target.value) })}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.pnlIncludesFees}
                      onChange={(_, v) => setForm({ ...form, pnlIncludesFees: v })}
                    />
                  }
                  label={form.pnlIncludesFees ? 'PnL includes fees (net)' : 'PnL excludes fees (gross)'}
                />
              </Stack>

              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                fullWidth
                multiline
                minRows={3}
              />

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Rules checklist</Typography>
                <Stack spacing={1}>
                  {rules.map((r) => (
                    <FormControlLabel
                      key={r.id}
                      control={
                        <Switch
                          checked={!!form.rulesChecked[r.id]}
                          onChange={(_, v) =>
                            setForm({
                              ...form,
                              rulesChecked: { ...form.rulesChecked, [r.id]: v },
                            })
                          }
                        />
                      }
                      label={r.label}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving || !form?.symbol.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Delete trade?</DialogTitle>
        <DialogContent>
          <Typography>This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} disabled={saving}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={saving}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
