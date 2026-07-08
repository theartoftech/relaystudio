# Sprint 10B-2 Human Test Script: macOS QA And Audit Refresh

## Purpose

Use this script to validate the macOS platform shell before closing Sprint 10B-2. It focuses on the native menu bar, Settings, view toggles, dirty close flows, command parity, and evidence needed for the refreshed macOS audit.

## Preflight

1. Confirm automated gates pass:
   ```bash
   npm run verify
   cargo test --manifest-path src-tauri/Cargo.toml
   npm run test:e2e
   ```
2. Start the standalone desktop app:
   ```bash
   npm run tauri dev
   ```
3. Use the macOS Relay Studio window, not the browser tab.
4. Start from the sample project with `Create Order` active.
5. Confirm the menu bar shows `Relay Studio`, `File`, `Edit`, `View`, `Window`, and `Help`.

## Test 1: App Menu And Settings

1. Open `Relay Studio` in the macOS menu bar.
2. Confirm `Settings` is present.
3. Choose `Settings`.
4. Inspect the opened Settings tab.

Expected result:

- Settings opens from the app menu.
- Settings is not placeholder copy.
- Request Policy controls are visible.
- The Settings tab does not show a response dock.
- The app remains in the same project context.

## Test 2: File Menu Structure

1. Open `File`.
2. Inspect the command list.
3. Confirm `Open Recent` exposes recent projects if any exist.
4. Confirm request/flow execution commands reflect the active tab.

Expected result:

- `New Project`, `Open Project...`, `Open Recent Projects...`, `Open Recent`, `Save Project`, `Save Project As...`, and `Close Tab` are present.
- `Send Request` is enabled on request tabs.
- `Run Flow` is disabled on request tabs and enabled on flow tabs.
- Project commands are not incorrectly grouped under the app menu.

## Test 3: Native View Menu State

1. Open `View` on a request tab.
2. Confirm `Toggle Flow Details` is disabled.
3. Select `Authenticated Read`.
4. Open `View` again.
5. Toggle `Toggle Flow Details`.
6. Reopen `View` and toggle `Toggle Flow Details` again.

Expected result:

- `Toggle Flow Details` is disabled outside flow tabs.
- `Toggle Flow Details` is enabled on flow tabs.
- The details panel hides and restores.
- The flow canvas remains visible and usable.
- Menu state and UI state stay synchronized.

## Test 4: Sidebar, Inspector, And Dock Toggles

1. Open `View`.
2. Toggle `Toggle Sidebar`.
3. Reopen `View` and toggle it back.
4. Repeat for `Toggle Inspector`.
5. On a request tab, repeat for `Toggle Response Dock`.

Expected result:

- Each menu item updates the matching shell surface.
- Check state changes when the menu is reopened.
- The layout does not leave blank gaps.
- The status bar reflects the visible shell state.

## Test 5: Dirty OS Close Flow

1. Edit the active request URL.
2. Click the red macOS close control.
3. Confirm the `Unsaved changes` prompt opens.
4. Click `Cancel`.
5. Click the red close control again.
6. Click `Do Not Save`.

Expected result:

- The first close request is intercepted.
- `Cancel` preserves the dirty request and keeps the window open.
- `Do Not Save` allows the close to continue.
- Clean windows close when the red close control is clicked.

## Test 6: Command Palette Parity

1. Open `Search commands`.
2. Run `Toggle Response Dock`.
3. Open `View` and compare state.
4. Open `Search commands`.
5. Run `Settings`.

Expected result:

- Command palette actions match native menu actions.
- Settings opens the same production Settings tab.
- Command palette focus stays trapped while open and returns after close.

## Test 7: Context Menu Sanity

1. Right-click a request in Explorer.
2. Confirm the app-owned request menu opens.
3. Press `Esc`.
4. Right-click a request tab.
5. Click outside the menu.

Expected result:

- App-owned context menus appear.
- `Esc` and outside click dismiss menus without side effects.
- Browser-native context menus do not appear outside editable text.

## Test 8: Audit Evidence Review

1. Review the refreshed audit:
   ```text
   audits/apple-hig-2026-07-08/relay-studio-macos-hig-audit-refresh.md
   ```
2. Review the evidence index:
   ```text
   audits/apple-hig-2026-07-08/evidence/README.md
   ```
3. Open the evidence screenshots in `audits/apple-hig-2026-07-08/evidence`.

Expected result:

- Evidence covers main shell, command palette, flow details visible/hidden, Settings, and dirty close prompt.
- Native menu evidence is described from current-run accessibility snapshots.
- Deferred audit items have rationale.

## Pass Criteria

Sprint 10B-2 macOS QA passes when:

- Native menu grouping matches a macOS document-style app.
- Settings is reachable and functional.
- File/View/Window commands are present and state-aware.
- Dirty OS close behavior protects unsaved work and clean close works.
- Browser-native context menus are suppressed outside editable text.
- The refreshed audit records closed, current, and deferred macOS findings.
