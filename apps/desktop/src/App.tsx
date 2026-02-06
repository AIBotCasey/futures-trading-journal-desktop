import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';

export default function App() {
  const [name, setName] = useState('');
  const [greetMsg, setGreetMsg] = useState<string>('');

  const canGreet = useMemo(() => name.trim().length > 0, [name]);

  async function greet() {
    // Placeholder wiring test (remove once we have real commands)
    const msg = await invoke<string>('greet', { name });
    setGreetMsg(msg);
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            FTJournal
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" disabled>
            Offline
          </Button>
        </Toolbar>
      </AppBar>

      <Divider />

      <Container sx={{ py: 4 }} maxWidth="md">
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Futures Trading Journal (Desktop)
          </Typography>
          <Typography color="text.secondary">
            Local-first. No sign-in. Optional encrypted database.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Test Rust command"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              placeholder="Enter a name…"
            />
            <Button variant="contained" onClick={greet} disabled={!canGreet}>
              Greet
            </Button>
          </Stack>

          {greetMsg ? (
            <Typography sx={{ pt: 1 }}>
              {greetMsg}
            </Typography>
          ) : null}

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            Next up: DB setup (Secure vs Standard), Trades CRUD, Journal by day.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
