# FTJournal (Futures Trading Journal Desktop)

Local-first trading journal for **futures day traders**.

- **No accounts / no sign-in**
- **Offline-first** (your data stays on your machine)
- Local database (SQLite) with **optional encryption**
- Mac + Windows desktop app (Tauri)

## Status
Early development (v0.1 in progress).

## Privacy
FTJournal does not require any network connection to operate. Imports and your journal database live on your machine.

See: `docs/PRIVACY.md` and `docs/THREAT_MODEL.md`.

## Development
### Prerequisites
- Node.js (>= 20)
- Rust toolchain (stable)
- Tauri prerequisites: https://tauri.app/start/prerequisites/

### Run the desktop app
```bash
cd apps/desktop
npm install
npm run tauri dev
```

## License
Apache-2.0. See `LICENSE`.
