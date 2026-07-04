# Sprint 9A Implementation Status

## Status

Implemented on July 1, 2026.

## Scope Delivered

- Added a shared shell command contract in `src/shell/shellCommands.ts` for:
  - command IDs
  - labels
  - shortcuts
  - visibility rules
  - enablement rules
  - native menu state projection
- Wired browser fallback keyboard shortcuts to the shared contract:
  - `CmdOrCtrl+K` search commands
  - `CmdOrCtrl+S` save project
  - `CmdOrCtrl+Shift+S` save project as
  - `CmdOrCtrl+W` close active tab
  - `CmdOrCtrl+Shift+W` close window
  - `CmdOrCtrl+Enter` send request or run flow based on the active editor
  - `CmdOrCtrl+,` open settings
- Routed native menu events through one shell command event channel instead of separate ad hoc events.
- Added native menu refresh state so menu structure and toggle state stay aligned with the active editor.
- Implemented native menu structure for desktop shell contract work:
  - macOS app menu with `Settings`
  - `File`
  - `Edit`
  - `View`
  - `Window`
  - `Help`
- Added menu-backed view toggles for:
  - sidebar
  - inspector
  - response dock
- Fixed dirty-state close-window routing so Save and Do Not Save both resume the requested window close instead of leaving the shell in a loop.
- Added hidden-explorer layout rules so shell view toggles do not break the main grid when the explorer is closed.

## Command Ownership Contract

Shared workbench rules:

- Request and flow execution stay owned by the request composer and flow editor surfaces.
- Search, save, close, settings, and view toggles are shell-level commands and are safe to expose in menus, shortcuts, and the command palette.
- Welcome, import, and settings do not expose request or flow execution commands.
- Response dock visibility is only exposed for workbench tabs that can meaningfully show execution output.

Windows shell rules for this sprint:

- Keep title bar ownership narrow: caption controls and drag regions remain a platform shell concern, not an editor concern.
- Keep frequent execution actions in the work surface rather than moving them into the title bar.
- Use menus, shortcuts, and context menus for secondary shell commands instead of adding more top-bar buttons.

macOS shell rules for this sprint:

- Document actions live under `File`, not a hidden app-only path.
- Settings remains discoverable from the app menu.
- Workspace visibility toggles are menu-backed instead of explorer-only.

## Automated Verification

Completed:

```bash
npm run verify
npm run test:e2e
cargo test
```

Verification results:

- Frontend lint, coverage, and production build pass.
- Frontend coverage remains above the 90% server-code requirement baseline for this repo:
  - Statements: 97.25%
  - Branches: 92.37%
  - Functions: 98.82%
  - Lines: 98.02%
- Shell contract tests pass for command visibility, primary execution routing, native menu state, keyboard shortcut routing, and dirty close-window behavior.
- Playwright shell regressions pass in Chromium and WebKit, including command palette access, compact shell layout, flow builder behavior, and single run-control assertions.
- Rust tests pass for persistence, HTTP validation, and shell menu helper behavior.

## Known Follow-Ups

- Sprint 9B completed the planned Explorer simplification by moving Recent Projects and transient status off the primary navigation tree.
- Settings still uses placeholder content and should not be treated as production-ready until Sprint 10A replaces that copy and behavior.
- Windows title bar drag-region and caption-control implementation remains a dedicated platform-chrome task for later sprint work.
