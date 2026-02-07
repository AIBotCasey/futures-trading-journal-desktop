# FTJournal (Futures Trading Journal Desktop)

Local-first trading journal for **futures day traders**.

- **No accounts / no sign-in**
- **Offline-first** (your data stays on your machine)
- Local database (SQLite) with **optional encryption**
- macOS + Windows desktop app (Tauri)

## Status
Early development (v0.1 in progress).

## Privacy
FTJournal does not require any network connection to operate. Imports and your journal database live on your machine.

See:
- `docs/PRIVACY.md`
- `docs/THREAT_MODEL.md`

## Install / Run (users)
**Releases are not published yet.** For now, you run FTJournal from source.

### macOS
1) Install prerequisites:
- Node.js (>= 20)
- Rust (stable)
- Tauri prerequisites (Xcode Command Line Tools, etc.): https://tauri.app/start/prerequisites/

2) Run:
```bash
git clone https://github.com/AIBotCasey/futures-trading-journal-desktop.git
cd futures-trading-journal-desktop/apps/desktop
npm install
npm run tauri dev
```

### Windows
1) Install prerequisites:
- Node.js (>= 20)
- Rust (stable)
- Tauri prerequisites (WebView2 + Visual Studio Build Tools): https://tauri.app/start/prerequisites/

2) Run (PowerShell):
```powershell
git clone https://github.com/AIBotCasey/futures-trading-journal-desktop.git
cd futures-trading-journal-desktop\apps\desktop
npm install
npm run tauri dev
```

## Build installers
See `docs/BUILDING.md`.

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

## Contributing
See `CONTRIBUTING.md`.

## License
Apache-2.0. See `LICENSE`.
