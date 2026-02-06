# Building & releasing

## Local dev
```bash
cd apps/desktop
npm run tauri dev
```

## macOS universal (x86_64 + aarch64)
Tauri can build per-arch; for a universal app you generally build both and combine.

Typical flow (requires Xcode tools installed):

```bash
cd apps/desktop
# build Intel
cargo tauri build --target x86_64-apple-darwin

# build Apple Silicon
cargo tauri build --target aarch64-apple-darwin
```

Then create a universal binary/app bundle ("lipo" / "universal2") as part of a release script.

Note: the exact universal bundling steps depend on the bundler output and signing/notarization strategy.
This doc will be updated once release packaging is finalized.

## Windows
```bash
cd apps/desktop
cargo tauri build
```
