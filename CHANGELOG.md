# Changelog

<!-- last: e4f997c84a7a5654218e304487dcca70455448ea -->

## 2026-02-07

- chore: update changelog (b0156b0)
- ci: build installers and draft GitHub Releases on tags (e4f997c)

## 2026-02-07

- feat: features list + changelog + csv import (cfd0d74)

## 2026-02-07

- Initial FTJournal scaffold (Tauri + React + MUI) (1478c7d)
- Add local DB init/unlock flow (optional SQLCipher encryption) (21bc206)
- Fix DB creation: ensure app data directory exists (ef00d2f)
- Add Settings (timezone) + Rules editor; seed default rules (6219a15)
- Move Settings out of Setup: add basic in-app menu (Trades/Journal/Settings) (ffadc0a)
- Timezone dropdown + top-right clock (seconds) (31deaac)
- Replace DB status alert with green/red status pills (42f7de4)
- Move DB status pills into app bar; remove true/false text (7c5b328)
- Add Trades CRUD (list/create/edit/delete) + trade form with rules (cd845b4)
- UI polish: remove setup/settings titles after init; simplify Trades subtitle (b275bf3)
- Remove Trades subtitle (0408a7c)
- Fix trades_create invoke args (2ffd698)
- Trades list: highlight PnL inline (green/red badge) (266b1e4)
- PnL badge: reduce size to match header line (3c2c10d)
- Trades list: move PnL badge back to action row (b42d64f)
- Trades list: restore win/loss coloring on PnL badge (41ed440)
- Add Journal calendar month view with daily PnL + trade count (3ab7070)
- Journal: click day to view trade highlights (symbol/qty/pnl/notes) (1e23966)
- Unlock screen: show 'Unlock' title instead of 'Setup' (66767ea)
- UI: remove Trades/Journal page titles (tabs act as titles) (05ebb61)
- UI layout: align Trades stats with action buttons; move month label into Journal header row (97f6ced)
- README: add macOS/Windows run-from-source instructions (a0700fd)
- Step 1+2: journal day -> edit trade; add backup export/import (c3d1b5c)
- Step 3+4: trades filters; daily journal entry editor (afffb2d)
- UI: narrow symbol filter; fixed-size calendar cells with centered PnL (7e5884a)
- Journal calendar: center PnL + 'Trades: #' under it (5b774d8)
- Fix Journal month label (format in UTC to avoid previous-month offset) (60c0d16)

## Unreleased

- Initial development.
