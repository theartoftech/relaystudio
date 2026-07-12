# Sprint 14 Implementation Status

## Delivered

- Cross-platform beta packaging workflow on native GitHub-hosted macOS, Windows, and Linux runners.
- Required `.dmg`, NSIS `.exe`, `.msi`, `.deb`, and `.AppImage` outputs with failing missing-artifact checks and 14-day retention.
- Frontend verification and Rust tests run before packaging on every operating system.
- Complete Tauri beta bundle metadata with updater artifacts disabled.
- Explicit internal-beta signing, notarization, and Authenticode deferrals.
- Platform-native UI acceptance matrix covering file dialogs, project persistence, response files, request and flow execution, dirty close, filesystem paths, permission failures, logs, and redaction.
- Stakeholder beta release notes with platform formats and known limitations.
- Automated configuration tests for packaging metadata, workflow coverage, artifact retention, and documentation.

## Verification

- 213 TypeScript tests passed; one local-only live REST suite explicitly skipped without credentials.
- TypeScript coverage remained 96.26% statements, 92.28% branches, 98.30% functions, and 97.05% lines.
- 23 Rust tests passed.
- 42 Playwright tests passed across Chromium and WebKit.
- Lint, strict TypeScript build, Vite production build, secret scanning, and diff checks passed.
- The macOS ARM64 DMG was built, checksum-verified, mounted, launched, and controlled interactively. Project reopening, command filtering, and Settings navigation worked in the packaged app.

## Native Beta Approval Status

- macOS installer build and launch: passed locally on 2026-07-12.
- Full macOS acceptance matrix: pending native QA completion.
- Windows installer build/install and acceptance: pending a Windows workflow artifact and native Windows QA.
- Linux installer build/install and acceptance: pending a Linux workflow artifact and native Linux QA.
- Production signing and update delivery: intentionally deferred; unsigned artifacts are internal-beta only.
- Helper/help file creation and native Help-menu integration: delivered and verified in the packaged macOS app.
- macOS installer regeneration: complete; the rebuilt DMG includes and opens the offline Help workspace.
- Windows installer regeneration: pending the native Windows packaging runner; NSIS and MSI Help-menu verification remains required.

Sprint 14 packaging and offline Help implementation are complete on macOS, but Sprint 14 beta approval is not complete until Windows installers are regenerated with this source and the pending native acceptance rows pass on their respective operating systems.
