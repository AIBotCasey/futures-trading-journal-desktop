import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Autocomplete,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { open, save } from '@tauri-apps/plugin-dialog';
import DeleteIcon from '@mui/icons-material/Delete';

import type { AppStatus, Rule, Settings } from './ui/types';
import { appGetStatus as getStatus, backupExport, backupImport, csvImportGeneric, rulesDelete, rulesList, rulesUpsert, settingsGet, settingsUpdate } from './ui/api';
import TradesView from './ui/TradesView';
import JournalView from './ui/JournalView';
import ChangelogView from './ui/ChangelogView';

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  const color = ok ? '#22c55e' : '#ef4444';
  return (
    <Button
      variant="outlined"
      size="small"
      disabled
      sx={{
        borderColor: color,
        color,
        opacity: 1,
        '&.Mui-disabled': {
          borderColor: color,
          color,
          opacity: 1,
        },
      }}
    >
      {label}
    </Button>
  );
}

function getTimeZoneOptions(): string[] {
  // Best case: use the platform's supported IANA time zones.
  // supportedValuesOf is available in modern runtimes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supported = (Intl as any)?.supportedValuesOf?.('timeZone') as string[] | undefined;
  if (supported && Array.isArray(supported) && supported.length > 0) return supported;

  // Fallback: a practical shortlist.
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Australia/Sydney',
  ];
}

function ReadySection({
  busy,
  onTimezoneChanged,
  onStatusChanged,
}: {
  busy: boolean;
  onTimezoneChanged: (tz: string) => void;
  onStatusChanged: (s: AppStatus) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const tzOptions = useMemo(() => getTimeZoneOptions(), []);
  const [tzDraft, setTzDraft] = useState('');
  const [newRuleId, setNewRuleId] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  useEffect(() => {
    void (async () => {
      try {
        const [s, r] = await Promise.all([settingsGet(), rulesList()]);
        setSettings(s);
        setTzDraft(s.timezone);
        setRules(r);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  async function refresh() {
    const [s, r] = await Promise.all([settingsGet(), rulesList()]);
    setSettings(s);
    setTzDraft(s.timezone);
    setRules(r);
  }

  async function saveTimezone() {
    setSaving(true);
    setError('');
    try {
      const tz = tzDraft.trim();
      const s = await settingsUpdate(tz);
      setSettings(s);
      onTimezoneChanged(tz);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addRule() {
    const id = newRuleId.trim();
    const label = newRuleLabel.trim();
    if (!id || !label) return;

    setSaving(true);
    setError('');
    try {
      await rulesUpsert({ id, label, sort_order: rules.length });
      setNewRuleId('');
      setNewRuleLabel('');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    setSaving(true);
    setError('');
    try {
      await rulesDelete(id);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const disableActions = busy || saving || backupBusy || importBusy;

  async function exportBackup() {
    setBackupBusy(true);
    setError('');
    setImportResult('');
    try {
      const dest = await save({
        title: 'Export FTJournal database',
        defaultPath: 'ftjournal-backup.db',
      });
      if (!dest) return;
      const s = await backupExport(dest);
      onStatusChanged(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    setBackupBusy(true);
    setError('');
    setImportResult('');
    try {
      const src = await open({
        title: 'Import FTJournal database',
        multiple: false,
        directory: false,
      });
      const path = Array.isArray(src) ? src[0] : src;
      if (!path) return;

      const ok = window.confirm(
        'Import will replace your current local database file.\n\nIf you have not exported a backup first, you could lose data.\n\nContinue?'
      );
      if (!ok) return;

      const s = await backupImport(path);
      onStatusChanged(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}

      <Stack spacing={2} sx={{ mt: 2 }}>
        <Autocomplete
          options={tzOptions}
          value={tzDraft || null}
          onChange={(_, v) => setTzDraft(v ?? '')}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Timezone"
              helperText={settings ? `Current: ${settings.timezone}` : 'Loading…'}
              fullWidth
            />
          )}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button variant="contained" onClick={saveTimezone} disabled={disableActions || tzDraft.trim().length === 0}>
            Save timezone
          </Button>
          <Button variant="outlined" onClick={refresh} disabled={disableActions}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Rules checklist
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        These appear as checkboxes on every trade.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <TextField
          label="Rule id"
          value={newRuleId}
          onChange={(e) => setNewRuleId(e.target.value)}
          placeholder="e.g. followed_plan"
          fullWidth
        />
        <TextField
          label="Label"
          value={newRuleLabel}
          onChange={(e) => setNewRuleLabel(e.target.value)}
          placeholder="e.g. Followed the trade plan"
          fullWidth
        />
        <Button variant="contained" onClick={addRule} disabled={disableActions || !newRuleId.trim() || !newRuleLabel.trim()}>
          Add
        </Button>
      </Stack>

      <List dense sx={{ mt: 1, bgcolor: 'background.paper', borderRadius: 2 }}>
        {rules.map((r) => (
          <ListItem key={r.id} divider>
            <ListItemText primary={r.label} secondary={r.id} />
            <ListItemSecondaryAction>
              <IconButton edge="end" aria-label="delete" onClick={() => removeRule(r.id)} disabled={disableActions}>
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Backup / Restore
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Export or import your local database file.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" onClick={exportBackup} disabled={disableActions}>
          Export backup
        </Button>
        <Button variant="outlined" onClick={importBackup} disabled={disableActions}>
          Import backup
        </Button>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        CSV Import (generic)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Import trades from a CSV with headers like: symbol, side, qty, entry_local, exit_local (or entry_time_utc_ms/exit_time_utc_ms), pnl_amount, fees, session, notes.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={async () => {
            setImportBusy(true);
            setError('');
            setImportResult('');
            try {
              const src = await open({
                title: 'Import trades CSV',
                multiple: false,
                directory: false,
                filters: [{ name: 'CSV', extensions: ['csv'] }],
              });
              const path = Array.isArray(src) ? src[0] : src;
              if (!path) return;

              const res = await csvImportGeneric(path);
              const msg = `Created: ${res.created} | Skipped: ${res.skipped} | Errors: ${res.errors.length}`;
              setImportResult(msg + (res.errors.length ? `\n\n` + res.errors.slice(0, 10).join('\n') : ''));
            } catch (e) {
              setError(String(e));
            } finally {
              setImportBusy(false);
            }
          }}
          disabled={disableActions}
        >
          Import CSV
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            const sample = [
              'symbol,side,qty,entry_local,exit_local,pnl_amount,fees,session,notes',
              'ES,long,1,2026-02-07 09:35,2026-02-07 09:42,125.00,4.40,ny,Example trade',
            ].join('\n');
            navigator.clipboard?.writeText(sample).catch(() => undefined);
            setImportResult('Copied sample CSV header + row to clipboard.');
          }}
          disabled={disableActions}
        >
          Copy sample CSV
        </Button>
      </Stack>

      {importResult ? (
        <Alert severity="info" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
          {importResult}
        </Alert>
      ) : null}
    </Box>
  );
}

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const [clockTz, setClockTz] = useState<string | null>(null);
  const [clockText, setClockText] = useState<string>(() => new Date().toLocaleTimeString());
  const [clockDateText, setClockDateText] = useState<string>(() => new Date().toLocaleDateString());

  // init form
  const [initEncrypted, setInitEncrypted] = useState(true);
  const [initPass, setInitPass] = useState('');
  const [initPass2, setInitPass2] = useState('');

  // unlock form
  const [unlockPass, setUnlockPass] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await getStatus());
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const ready = status && status.db.configured && (!status.db.encrypted || status.db.unlocked);

  useEffect(() => {
    if (!ready) return;
    // Load timezone for the top-right clock.
    void (async () => {
      try {
        const s = await settingsGet();
        setClockTz(s.timezone);
      } catch {
        // ignore
      }
    })();
  }, [ready]);

  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        const now = new Date();
        const txt = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          ...(clockTz ? { timeZone: clockTz } : {}),
        });
        const d = now.toLocaleDateString([], {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(clockTz ? { timeZone: clockTz } : {}),
        });
        setClockText(txt);
        setClockDateText(d);
      } catch {
        setClockText(new Date().toLocaleTimeString());
        setClockDateText(new Date().toLocaleDateString());
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [clockTz]);

  const needsInit = status ? !status.db.configured : false;
  const needsUnlock = status ? status.db.configured && status.db.encrypted && !status.db.unlocked : false;

  const initCanSubmit = useMemo(() => {
    if (busy) return false;
    if (!initEncrypted) return true;
    const p1 = initPass.trim();
    const p2 = initPass2.trim();
    return p1.length >= 8 && p1 === p2;
  }, [busy, initEncrypted, initPass, initPass2]);

  const unlockCanSubmit = useMemo(() => {
    if (busy) return false;
    return unlockPass.trim().length > 0;
  }, [busy, unlockPass]);

  async function refresh() {
    setStatus(await getStatus());
  }

  async function initDb() {
    setBusy(true);
    setError('');
    try {
      const res = await invoke<AppStatus>('db_init', {
        req: {
          encrypted: initEncrypted,
          passphrase: initEncrypted ? initPass : null,
        },
      });
      setStatus(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unlockDb() {
    setBusy(true);
    setError('');
    try {
      const res = await invoke<AppStatus>('db_unlock', {
        req: {
          passphrase: unlockPass,
        },
      });
      setStatus(res);
      setUnlockPass('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const [tab, setTab] = useState<'trades' | 'journal' | 'settings' | 'changelog'>('trades');
  const [pendingEditTradeId, setPendingEditTradeId] = useState<string | null>(null);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            FTJournal
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1.5 }} color="text.secondary">
            {clockDateText} {clockText}
          </Typography>
          {status ? (
            <Stack direction="row" spacing={1} sx={{ mr: 1.5, alignItems: 'center' }}>
              <StatusPill label="Configured" ok={status.db.configured} />
              <StatusPill label="Encrypted" ok={status.db.encrypted} />
              <StatusPill label="Unlocked" ok={status.db.unlocked} />
            </Stack>
          ) : null}
          <Button variant="outlined" size="small" disabled>
            Offline
          </Button>
        </Toolbar>
      </AppBar>

      <Divider />

      <Container sx={{ py: 4 }} maxWidth="md">
        <Stack spacing={2}>
          {!ready ? (
            <>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {needsInit ? 'Setup' : 'Unlock'}
              </Typography>
              <Typography color="text.secondary">
                {needsInit
                  ? 'Local-first. No sign-in. Optional encrypted database.'
                  : 'Enter your passphrase to unlock your local database.'}
              </Typography>
            </>
          ) : (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button variant={tab === 'trades' ? 'contained' : 'text'} onClick={() => setTab('trades')}>
                  Trades
                </Button>
                <Button variant={tab === 'journal' ? 'contained' : 'text'} onClick={() => setTab('journal')}>
                  Journal
                </Button>
                <Button variant={tab === 'settings' ? 'contained' : 'text'} onClick={() => setTab('settings')}>
                  Settings
                </Button>
                <Button variant={tab === 'changelog' ? 'contained' : 'text'} onClick={() => setTab('changelog')}>
                  Changelog
                </Button>
              </Stack>
              <Divider />
            </>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {/* DB status pills moved to the top-right app bar (next to Offline) */}

          {!ready ? (
            <>
              {needsInit ? (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 2 }}>
                    Create local database
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Choose Secure mode (encrypted) if you want the database file protected at rest.
                  </Typography>

                  <FormControlLabel
                    control={<Switch checked={initEncrypted} onChange={(_, v) => setInitEncrypted(v)} />}
                    label={initEncrypted ? 'Secure mode (encrypted) — recommended' : 'Standard mode (unencrypted)'}
                  />

                  {initEncrypted ? (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <TextField
                        label="Passphrase"
                        type="password"
                        value={initPass}
                        onChange={(e) => setInitPass(e.target.value)}
                        helperText="Minimum 8 characters. If you forget it, your data cannot be recovered."
                        fullWidth
                      />
                      <TextField
                        label="Confirm passphrase"
                        type="password"
                        value={initPass2}
                        onChange={(e) => setInitPass2(e.target.value)}
                        fullWidth
                      />
                    </Stack>
                  ) : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={initDb} disabled={!initCanSubmit}>
                      Create database
                    </Button>
                    <Button variant="outlined" onClick={refresh} disabled={busy}>
                      Refresh
                    </Button>
                  </Stack>
                </Box>
              ) : null}

              {needsUnlock ? (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 2 }}>
                    Unlock database
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Passphrase"
                      type="password"
                      value={unlockPass}
                      onChange={(e) => setUnlockPass(e.target.value)}
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Button variant="contained" onClick={unlockDb} disabled={!unlockCanSubmit}>
                        Unlock
                      </Button>
                      <Button variant="outlined" onClick={refresh} disabled={busy}>
                        Refresh
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : (
            <>
              {tab === 'settings' ? (
                <ReadySection
                  busy={busy}
                  onTimezoneChanged={(tz) => setClockTz(tz)}
                  onStatusChanged={(s) => setStatus(s)}
                />
              ) : tab === 'changelog' ? (
                <ChangelogView />
              ) : tab === 'journal' ? (
                <JournalView
                  onEditTrade={(tradeId) => {
                    setPendingEditTradeId(tradeId);
                    setTab('trades');
                  }}
                />
              ) : (
                <TradesView
                  timezone={clockTz}
                  openTradeId={pendingEditTradeId}
                  onOpenedTrade={() => setPendingEditTradeId(null)}
                />
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
