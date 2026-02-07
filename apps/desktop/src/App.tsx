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
import DeleteIcon from '@mui/icons-material/Delete';

type DbStatus = {
  configured: boolean;
  encrypted: boolean;
  unlocked: boolean;
};

type AppStatus = {
  db: DbStatus;
};

type Settings = {
  timezone: string;
};

type Rule = {
  id: string;
  label: string;
  sort_order: number;
};

async function getStatus(): Promise<AppStatus> {
  return invoke<AppStatus>('app_get_status');
}

async function settingsGet(): Promise<Settings> {
  return invoke<Settings>('settings_get');
}

async function settingsUpdate(timezone: string): Promise<Settings> {
  return invoke<Settings>('settings_update', { req: { timezone } });
}

async function rulesList(): Promise<Rule[]> {
  return invoke<Rule[]>('rules_list');
}

async function rulesUpsert(rule: Rule): Promise<void> {
  return invoke<void>('rules_upsert', { req: rule });
}

async function rulesDelete(id: string): Promise<void> {
  return invoke<void>('rules_delete', { id });
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

function ReadySection({ busy, onTimezoneChanged }: { busy: boolean; onTimezoneChanged: (tz: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const tzOptions = useMemo(() => getTimeZoneOptions(), []);
  const [tzDraft, setTzDraft] = useState('');
  const [newRuleId, setNewRuleId] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const disableActions = busy || saving;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mt: 2 }}>
        Settings
      </Typography>

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
        Next: Trades & Journal
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Settings/rules are wired to the local database. Next we’ll build Trades CRUD and the Journal screens.
      </Typography>
    </Box>
  );
}

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const [clockTz, setClockTz] = useState<string | null>(null);
  const [clockText, setClockText] = useState<string>(() => new Date().toLocaleTimeString());

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
        setClockText(txt);
      } catch {
        setClockText(new Date().toLocaleTimeString());
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

  const [tab, setTab] = useState<'trades' | 'journal' | 'settings'>('trades');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            FTJournal
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1.5 }} color="text.secondary">
            {clockText}
          </Typography>
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
                Setup
              </Typography>
              <Typography color="text.secondary">
                Local-first. No sign-in. Optional encrypted database.
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
              </Stack>
              <Divider />
            </>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {status ? (
            <Alert severity="info">
              DB status — configured: {String(status.db.configured)}, encrypted: {String(status.db.encrypted)}, unlocked:{' '}
              {String(status.db.unlocked)}
            </Alert>
          ) : (
            <Alert severity="info">Loading status…</Alert>
          )}

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
                <ReadySection busy={busy} onTimezoneChanged={(tz) => setClockTz(tz)} />
              ) : tab === 'journal' ? (
                <Alert severity="info">Journal UI coming next.</Alert>
              ) : (
                <Alert severity="info">Trades UI coming next.</Alert>
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
