# Threat model (plain language)

## Goals
- Keep your trading journal data on your machine.
- Make it hard to read the database file if it is copied off your machine (when encryption is enabled).

## Protects against
- Someone copying your FTJournal database file and trying to open it with a standard SQLite viewer (Secure mode).
- Accidental exposure via backups (if you export/share the encrypted DB file).

## Does NOT protect against
- Malware running as your user account.
- An attacker with access to an already-unlocked session.
- A fully compromised OS.

## Recommendation
Enable full-disk encryption on your OS as well:
- macOS: FileVault
- Windows: BitLocker
