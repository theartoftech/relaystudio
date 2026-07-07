# Sprint 10A Human Test Script: Platform Chrome, Layout, And Writing

## Purpose

Use this script to manually validate Sprint 10A platform behavior before check-in. This script focuses on native chrome, layout behavior, app-owned command surfaces, dialog behavior, context menus, and production writing.

## Preflight

1. Confirm the app has been verified:
   ```bash
   npm run verify
   cargo test --manifest-path src-tauri/Cargo.toml
   npm run test:e2e
   npm run tauri build -- --bundles app
   ```
2. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
3. Use the standalone Relay Studio desktop window, not the browser tab.
4. Start from the sample project with `Create Order` active.

## Test 1: Settings Copy And Layout

1. Open `Relay Studio > Settings` on macOS or `File > Settings` on Windows.
2. Confirm the Settings tab opens.
3. Confirm the left settings list includes `Request Policy`, `Display`, `Network Proxy`, and `Workspace`.
4. Inspect `Request Policy`.
5. Open `Workspace`.
6. Toggle `Save on close`.
7. Toggle `Always ask when closing unsaved tabs`.
8. Change `Default environment`, then change it back if needed.

Expected result:
- Settings fills the workbench and does not show the response/console dock.
- `Request Policy` contains HTTP version, timeout, max response time, TLS, cookies, and response parsing controls.
- `Workspace` contains default environment, working directory, save-on-close, and unsaved-tab close controls.
- The page is primarily editable settings, not read-only project metadata.
- Changing settings marks the project dirty and updates the status bar with a specific message.

## Test 2: Command Palette Dialog Behavior

1. Click `Search commands` in the top toolbar.
2. Confirm the command palette opens and focus lands in the search field.
3. Type `settings`.
4. Press `Esc`.
5. Open the command palette again with `Cmd+K` on macOS or `Ctrl+K` on Windows.
6. Press `Tab` repeatedly.

Expected result:
- `Esc` closes the command palette.
- Focus returns to the `Search commands` toolbar button.
- Tab focus stays inside the command palette while it is open.
- Filtered command results update from typed text.

## Test 3: Unsaved Work Dialog Behavior

1. Edit the active request URL so the project becomes dirty.
2. Press `Cmd+Shift+W` on macOS or `Ctrl+Shift+W` on Windows.
3. Confirm the unsaved-work dialog opens.
4. Press `Esc`.
5. Repeat the close shortcut.
6. Choose `Cancel`.
7. Repeat the close shortcut.
8. Choose `Do Not Save`.

Expected result:
- `Esc` behaves the same as Cancel.
- Focus returns to the app after the prompt closes.
- `Cancel` leaves the app open and preserves dirty work.
- `Do Not Save` clears dirty state and continues the close flow.
- The prompt names the current project, not a stale project name.

## Test 4: Native View Menu Toggles

1. Open `View` from the native menu bar.
2. Toggle `Toggle Sidebar`.
3. Toggle `Toggle Inspector`.
4. Open a request tab and toggle `Toggle Response Dock`.
5. Open the `Authenticated Read` flow tab.
6. Open `View` and choose `Toggle Flow Details`.
7. Choose `Toggle Flow Details` again.

Expected result:
- Sidebar, inspector, and response dock each show and hide without layout breakage.
- `Toggle Flow Details` is available for flow tabs.
- Hiding flow details removes the right step-details panel and its resize handle.
- Showing flow details restores the panel with the selected step details.
- `Toggle Flow Details` is disabled or unavailable when a non-flow tab is active.

## Test 5: Flow Details Command Palette Parity

1. Open the `Authenticated Read` flow tab.
2. Open `Search commands`.
3. Search for `flow details`.
4. Select `Toggle Flow Details`.
5. Open `Search commands` again and select `Toggle Flow Details`.

Expected result:
- The command appears only while a flow tab is active.
- The command palette action matches the native View menu behavior.
- The flow canvas expands when details are hidden and returns to the split layout when details are shown.

## Test 5A: Open Recent From Command Palette

1. Save or create at least one project so it appears in recent projects.
2. Press `Cmd+K` on macOS or `Ctrl+K` on Windows.
3. Select `Open Recent Projects`.
4. Click a project that is not currently active.

Expected result:
- The selected project opens immediately.
- The project name and explorer contents change to the selected project.
- The active tab lands on useful project content, not a misleading stale Welcome view.
- If unsaved work blocks the switch, the unsaved-work prompt appears and completing it opens the selected project.

## Test 6: Context Menu Ownership

1. Right-click blank space in the workbench.
2. Right-click blank space in the top toolbar.
3. Right-click a request row in Explorer.
4. Right-click a flow row in Explorer.
5. Right-click a request tab.
6. Right-click inside the request URL text field.

Expected result:
- Blank app chrome does not show the browser/native web context menu.
- Request, flow, and tab rows show Relay Studio app-defined context menus.
- Text-editable fields still allow the native text editing context menu.
- No right-click action immediately creates, renames, deletes, or opens an item without choosing a menu command.

## Test 7: Active And Inactive Window Chrome

1. Keep Relay Studio visible.
2. Click another app window so Relay Studio loses focus.
3. Click back into Relay Studio.

Expected result:
- The top chrome visually softens when the Relay Studio window is inactive.
- The top chrome returns to the active state when the window regains focus.
- No controls shift position during active/inactive changes.

## Test 8: Responsive Layout Breakpoints

1. Resize the Relay Studio window near the minimum supported desktop width.
2. If the OS allows, test a narrower width around tablet scale.
3. Open and close the inspector.
4. Open a flow tab and toggle flow details.
5. Resize the explorer and response dock.

Expected result:
- Top toolbar controls remain reachable and do not overlap.
- Search commands remains usable.
- Workbench content does not clip critical controls.
- Inspector hides or yields space on constrained widths instead of crushing the editor.
- Flow controls and nodes remain visible after resizing.

## Test 9: Dark Appearance

1. Open Settings.
2. Select `Display`.
3. Choose `Dark`.
4. Inspect the toolbar, explorer, workbench, dialogs, settings, and flow builder.
5. Choose `Light`.

Expected result:
- Text remains readable.
- Panels use dark surfaces instead of light-only defaults.
- Primary actions remain visually distinct.
- Dialogs and context menus remain legible.
- No obvious light-mode-only borders or unreadable muted text remain.
- Switching between Light and Dark applies immediately.

## Test 9A: Proxy Settings

1. Open Settings.
2. Select `Network Proxy`.
3. Toggle `Use proxy`.
4. Toggle HTTP and HTTPS proxy routing.
5. Enter a proxy server URL and port.
6. Enable `Proxy basic auth`.
7. Enter username and password.
8. Edit the proxy bypass list.

Expected result:
- Each field accepts edits and persists while navigating between settings sections.
- Proxy basic auth reveals credential fields only when enabled.
- Changed proxy values mark the project dirty and update the status bar.

## Test 10: Windows High Contrast

Run this test on Windows.

1. Enable a Windows high-contrast theme.
2. Start Relay Studio.
3. Open Settings, command palette, recent projects, a request tab, and a flow tab.
4. Open app-defined context menus.
5. Toggle View menu items.

Expected result:
- Text, borders, selected tabs, buttons, dialogs, and context menus honor high-contrast colors.
- Primary actions use system highlight colors.
- Controls remain identifiable without relying on subtle background color alone.
- Keyboard focus remains visible.

## Test 11: Writing Pass

1. Read the visible copy in Settings, dialogs, empty states, and command palette results.
2. Trigger at least one save dialog, one delete dialog, one unsaved-work prompt, and one flow-mapping dialog.

Expected result:
- Copy is action-oriented and specific.
- Dialog titles match the action being performed.
- Destructive copy clearly identifies risk before deletion.
- No placeholder wording remains in production surfaces.
- No setting label implies configurability where only read-only metadata is shown.

## Pass Criteria

Sprint 10A passes human validation when:

- All View menu and command palette layout actions work as intended.
- Dialogs close with `Esc`, trap focus while open, and return focus after close.
- Native/browser context menus are suppressed outside editable text while Relay Studio context menus still work.
- Settings copy and layout are production-ready.
- Responsive, dark-mode, and high-contrast behavior are usable on the platforms available for testing.
- Automated gates remain green after any fixes made from this script.
