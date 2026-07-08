# Sprint 10B-1 Human Test Script: Platform Regression Coverage

## Purpose

Use this script to manually validate Sprint 10B-1 platform regression behavior before check-in. This script focuses on the shell behaviors now covered by automated regression tests: dialog keyboard behavior, view-toggle state, dirty-state flows, and app-owned context menus.

## Preflight

1. Confirm the automated regression gates have passed:
   ```bash
   npm run verify
   cargo test --manifest-path src-tauri/Cargo.toml
   npm run test:e2e
   ```
2. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
3. Use the standalone Relay Studio desktop window, not the browser tab.
4. Start from the bundled sample project with `Create Order` active.
5. Keep the keyboard visible and use only keyboard input where a test step calls for it.

## Test 1: Command Palette Focus Trap

1. Click `Search commands` in the top toolbar.
2. Confirm focus lands in the `Search commands` input inside the command palette.
3. Press `Shift+Tab`.
4. Confirm focus wraps to the last visible command.
5. Press `Tab`.
6. Confirm focus wraps back to the search input.
7. Press `Esc`.

Expected result:
- Focus never leaves the command palette while it is open.
- `Esc` closes the command palette.
- Focus returns to the top toolbar `Search commands` button after close.
- No command runs just because focus moves through the list.

## Test 2: Command Palette Response Dock Toggle

1. Confirm a request tab such as `Create Order` or `Login` is active.
2. Confirm the response/console dock is visible.
3. Open `Search commands`.
4. Choose `Toggle Response Dock`.
5. Open `Search commands` again.
6. Choose `Toggle Response Dock` again.

Expected result:
- The first toggle hides the entire response/console dock and its resize handle.
- The second toggle restores the response/console dock.
- The workbench does not leave blank dock space behind.
- The status bar updates the dock state.

## Test 3: Command Palette View Toggle State By Tab Type

1. Open `Search commands`.
2. Choose `Toggle Sidebar`.
3. Confirm the Explorer is hidden.
4. Open `Search commands`.
5. Choose `Toggle Inspector`.
6. Confirm the Inspector is visible.
7. Select the `Welcome` tab.
8. Open `Search commands`.
9. Look for `Toggle Response Dock`.
10. Select a request tab again.
11. Open `Search commands`.
12. Look for `Toggle Response Dock`.

Expected result:
- `Toggle Sidebar` hides and restores the Explorer without layout breakage.
- `Toggle Inspector` shows and hides the Inspector without layout breakage.
- `Toggle Response Dock` is not offered on `Welcome`.
- `Toggle Response Dock` is offered on request tabs.
- Command availability matches the active tab type.

## Test 4: Native View Menu Regression

Run this test in the Tauri desktop window.

1. Open the native `View` menu.
2. Toggle `Toggle Sidebar`.
3. Confirm the check state changes when the menu is reopened.
4. Toggle `Toggle Inspector`.
5. Confirm the check state changes when the menu is reopened.
6. Open the `Authenticated Read` flow tab.
7. Open the native `View` menu.
8. Toggle `Toggle Flow Details`.
9. Reopen `View`.
10. Toggle `Toggle Flow Details` again.

Expected result:
- Native menu commands update the same shell surfaces as the command palette.
- Native menu check states reflect the current shell state.
- `Toggle Flow Details` hides and restores the flow side panel only while a flow tab is active.
- The flow canvas stays visible when details are hidden or restored.

## Test 5: Dirty Window Close Cancel

1. Edit the active request URL so the project becomes dirty.
2. Press `Cmd+Shift+W` on macOS or `Ctrl+Shift+W` on Windows.
3. Confirm the `Unsaved changes` prompt opens.
4. Press `Esc`.
5. Repeat the close shortcut.
6. Click `Cancel`.

Expected result:
- `Esc` and `Cancel` both close the prompt.
- The app window remains open.
- The edited request URL is preserved.
- Dirty state remains visible after the prompt closes.
- No save dialog opens unless `Save And Continue` is chosen.

## Test 6: Dirty Tab Close Cancel

1. Edit the active request URL so the active tab is dirty.
2. Press `Cmd+W` on macOS or `Ctrl+W` on Windows.
3. Confirm the `Unsaved changes` prompt opens.
4. Click `Cancel`.
5. Inspect the tab strip and request URL.

Expected result:
- The active request tab remains open.
- The edited request URL is preserved.
- Dirty state remains visible.
- No other tab is closed.
- The app does not switch projects or clear the request editor.

## Test 7: Native Close Request Hook

Run this test in the Tauri desktop window.

1. Edit the active request URL so the project becomes dirty.
2. Use the operating system close control for the Relay Studio window.
3. Confirm the `Unsaved changes` prompt opens.
4. Click `Cancel`.
5. Repeat the OS close action.
6. Click `Do Not Save`.

Expected result:
- The first OS close request is intercepted by Relay Studio.
- `Cancel` leaves the app open and preserves dirty work.
- `Do Not Save` allows the close flow to continue.
- The prompt names the current project.

## Test 8: Explorer Context Menu Dismissal

1. Right-click the `Health Check` request in Explorer.
2. Confirm the `Request context menu` appears.
3. Press `Esc`.
4. Right-click the same request again.
5. Click outside the menu in the workbench.

Expected result:
- `Esc` dismisses the context menu without running an action.
- Clicking outside dismisses the context menu without running an action.
- No rename or delete dialog opens unless a menu item is chosen.
- The request remains in Explorer.

## Test 9: Tab Context Menu Dismissal

1. Right-click the `Login` request tab.
2. Confirm the `Request tab context menu` appears.
3. Click blank space in the workbench.
4. Right-click the `Authenticated Read` flow tab.
5. Press `Esc`.

Expected result:
- Each tab context menu dismisses cleanly.
- No rename dialog opens unless `Rename Request` or `Rename Flow` is chosen.
- No tab closes unless a close command is chosen.
- The active tab and workbench content remain stable.

## Test 10: Response Mappings Dialog Keyboard Regression

1. Open the `Authenticated Read` flow tab.
2. Select a step with response mappings, such as `Login`.
3. Click `Manage Response Mappings`.
4. Confirm focus lands inside the dialog.
5. Press `Tab` repeatedly through the controls.
6. Press `Esc`.
7. Reopen the dialog.
8. Click `Done`.

Expected result:
- Focus stays inside the dialog while it is open.
- `Esc` closes the dialog.
- `Done` closes the dialog.
- Flow step details and canvas remain synchronized after close.

## Pass Criteria

Sprint 10B-1 passes human validation when:

- Command palette focus trapping, Escape behavior, and focus return work consistently.
- View toggles behave the same from command palette and native menu.
- Dirty close-window and close-tab prompts preserve work when canceled.
- App-owned context menus dismiss without accidental rename, delete, close, or open actions.
- Response dock toggling hides and restores the dock surface without layout gaps.
- Automated gates remain green after any fixes made from this script.
