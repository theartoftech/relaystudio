# Sprint 9B Implementation Status

## Status

Implemented on July 1, 2026.

## Success Criteria

- Explorer is limited to active project structure and related navigation.
- Recent project switching is discoverable through command surfaces instead of occupying the Explorer tree.
- Transient project messages move out of navigation and into a status bar.
- Toolbar and command-palette actions remain state-aware for request, flow, response, import, welcome, and settings tabs.
- Inspector content changes by editor type instead of repeating the same static project summary.
- Settings remains menu and command-palette accessible without consuming Explorer real estate.

## Scope Delivered

- Removed Recent Projects, import callout, transient status text, and footer links from Explorer.
- Added `Open Recent Projects` to the shared shell command contract, command palette, and native File menu.
- Added an `Open Recent Projects` command dialog for session projects and persisted recent project files.
- Preserved recent-project rename and delete actions through context menus in the command dialog.
- Added a bottom status bar for project messages, dirty state, and visible shell pane state.
- Kept Settings out of Explorer and accessible through menu/shortcut/command palette paths.
- Updated inspector behavior:
  - Request tabs show variables plus request summary.
  - Flow tabs show flow summary.
  - Response tabs show response summary.
  - Welcome, import, and settings show shell context.
- Updated Playwright and React tests so saved project flows open through the command surface instead of Explorer.

## Failure Modes Covered

- Recent project localStorage state may hydrate after first render; tests now wait for command-dialog rows.
- Missing recent project paths are removed after a failed open.
- Dirty active projects still prompt before switching through the recent-project command dialog.
- Active dirty projects with the same name as a saved recent project are hidden from the dialog to avoid ambiguous switching.
- Saved project flow regressions no longer depend on recent projects being present in Explorer.

## Automated Verification

Completed:

```bash
npm run verify
npm run test:e2e
cargo test
npm run tauri build
```

Verification results:

- Frontend lint, coverage, and production build pass.
- Frontend test suite passes: 150 tests.
- Frontend coverage remains above the 90% gate:
  - Statements: 97.25%
  - Branches: 92.33%
  - Functions: 98.82%
  - Lines: 98.02%
- Playwright shell regressions pass in Chromium and WebKit: 40 tests.
- Rust tests pass: 12 tests.
- Tauri release bundles build successfully:
  - `src-tauri/target/release/bundle/macos/Relay Studio.app`
  - `src-tauri/target/release/bundle/dmg/Relay Studio_0.1.0_aarch64.dmg`

## Known Follow-Ups

- Sprint 10A should replace remaining placeholder desktop copy with final production text.
- Windows title bar drag-region and caption-control implementation remains part of the later platform chrome work.
