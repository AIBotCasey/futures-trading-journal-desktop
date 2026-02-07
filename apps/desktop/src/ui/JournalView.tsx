import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { DaySummary } from './types';
import { journalMonthSummary } from './api';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function money(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(0)}`;
}

function startDowOfMonth(year: number, month: number) {
  // month: 1-12; compute weekday of the 1st using UTC to avoid local DST surprises.
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export default function JournalView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const summaryMap = useMemo(() => {
    const m: Record<string, DaySummary> = {};
    for (const s of summary) m[s.date_local] = s;
    return m;
  }, [summary]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const s = await journalMonthSummary(year, month);
      setSummary(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const dow0 = startDowOfMonth(year, month);
  const dim = daysInMonth(year, month);

  const cells = useMemo(() => {
    // 6 rows x 7 cols = 42 cells
    const out: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < 42; i++) {
      const day = i - dow0 + 1;
      if (day >= 1 && day <= dim) out.push({ day, key: `d-${day}` });
      else out.push({ day: null, key: `e-${i}` });
    }
    return out;
  }, [dow0, dim]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString([], { month: 'long', year: 'numeric' });

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Journal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Calendar view (profit/loss by day)
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={prevMonth}>
            Prev
          </Button>
          <Button variant="outlined" onClick={nextMonth}>
            Next
          </Button>
          <Button variant="outlined" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Typography sx={{ fontWeight: 800, mb: 1 }}>{monthLabel}</Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <Alert severity="info" sx={{ mb: 2 }}>Loading…</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <Box key={d} sx={{ px: 1, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              {d}
            </Typography>
          </Box>
        ))}

        {cells.map((c) => {
          if (!c.day) {
            return <Box key={c.key} sx={{ minHeight: 78 }} />;
          }
          const key = ymd(year, month, c.day);
          const s = summaryMap[key];
          const count = s?.trade_count ?? 0;
          const pnl = s?.pnl_net_total ?? 0;

          const hasTrades = count > 0;
          const color = !hasTrades ? '#9ca3af' : pnl >= 0 ? '#22c55e' : '#ef4444';
          const bg = !hasTrades
            ? 'rgba(156,163,175,0.08)'
            : pnl >= 0
              ? 'rgba(34,197,94,0.12)'
              : 'rgba(239,68,68,0.12)';

          return (
            <Box
              key={c.key}
              sx={{
                minHeight: 78,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: bg,
                p: 1,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                {c.day}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {hasTrades ? (
                  <>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 900, color }}>
                      {money(pnl)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {count} trade{count === 1 ? '' : 's'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" sx={{ color }}>
                    No trades
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
