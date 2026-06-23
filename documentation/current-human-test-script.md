# Relay Studio Current Human Test Script

## Purpose

Use this script to manually validate the current uncommitted Relay Studio build before approving check-in.

## Preflight

1. Confirm the working tree contains only expected Relay Studio changes:
   ```bash
   git status --short
   ```
2. Run the automated verification gate:
   ```bash
   npm run verify
   ```
3. Confirm coverage remains above the project requirement:
   - Statements: at least 90%.
   - Branches: at least 90%.
   - Functions: at least 90%.
   - Lines: at least 90%.
4. Run the desktop shell smoke tests:
   ```bash
   npm run test:e2e
   ```
5. Optional dependency check:
   ```bash
   npm audit --audit-level=moderate
   ```

## Desktop Launch

1. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
2. Confirm Relay Studio opens as a standalone desktop window.
3. Confirm the app is not being evaluated as a browser-only web app. The local Vite URL is only the Tauri dev asset server.

## Test 1: Default Shell Layout

1. Inspect the initial app screen.
2. Expected result:
   - The shell has a compact top toolbar.
   - The left side shows the project explorer, not a separate activity rail.
   - The center shows the request editor.
   - The bottom shows the tabbed utility dock.
   - The inspector is hidden by default.
   - Search text is not clipped.

## Test 2: Command Palette And New Project

1. Click `Search commands` or press `Cmd+K`.
2. Confirm the command palette opens.
3. Select `New Project`.
4. Expected result:
   - A new unsaved project is created.
   - A starter request tab opens.
   - The request URL field is editable.
   - The project dirty state is visible.

## Test 3: Tab Plus Creates Request

1. Click the `+` button in the open editor tab row.
2. Expected result:
   - A new request/service is created.
   - A new request tab opens.
   - The new request is selected in the explorer.
   - The project is marked dirty.

## Test 4: Open Recent Project From Dialog

1. Save a project so it appears under `Recent Projects`.
2. Open `Search commands` or press `Cmd+K`.
3. Select `Open Project`.
4. In the dialog, click a recent project row.
5. Expected result:
   - The recent project path is used directly.
   - The project opens if the file still exists and the password is correct.
   - Missing-file errors are shown in the project status area.

## Test 5: Request URL Editing

1. Click inside the request URL field.
2. Replace the URL with:
   ```text
   https://api.test.local/v1/orders?status=open
   ```
3. Expected result:
   - The URL field accepts typing.
   - The request URL remains visible without clipping.
   - The project status reports that the request URL was updated.

## Test 6: Contextual Toolbar

1. Open a normal request tab.
2. Confirm the top toolbar primary action reads `Send Request`.
3. Open a flow from the explorer.
4. Confirm the top toolbar primary action reads `Run Flow`.
5. Expected result:
   - The primary action changes based on the active tab.
   - The environment selector remains available.
   - Save remains visible but does not dominate the toolbar.

## Test 7: Optional Inspector

1. Confirm no inspector is visible by default.
2. Click the inspector toggle in the top toolbar.
3. Confirm the inspector opens on the right.
4. Type in the variable filter field.
5. Click the inspector close button.
6. Expected result:
   - The inspector opens and closes cleanly.
   - `Filter variables` appears inside the input.
   - No separate inspector icon rail is visible.
   - The editor gains horizontal space after closing the inspector.

## Test 8: Service Designer Editing

1. Select an existing service from the explorer.
2. Edit the service name.
3. Change the method.
4. Edit the path.
5. Open the `Headers`, `Query Params`, `Body`, and `Retry` tabs.
6. Expected result:
   - Field edits are accepted.
   - The request preview updates.
   - Invalid JSON body formatting reports an error.
   - Valid JSON can be beautified and minified.
   - The project is marked dirty.

## Test 9: Utility Dock

1. Click `Response`, `Console`, and `Problems` in the bottom dock.
2. Expected result:
   - Only one utility surface is shown at a time.
   - `Response` includes `Pretty`, `Raw`, `Headers`, and `Error` sub-tabs.
   - `Console` includes event filtering.
   - `Problems` shows either current runtime issues or a clear empty state.

## Test 10: Resizable Workspace

1. Drag the divider between the explorer and the workbench.
2. Drag the divider above the bottom utility dock.
3. Open the inspector and drag its divider.
4. Open a flow and drag the divider between the canvas and step details.
5. Expected result:
   - Each pane resizes smoothly.
   - Adjacent content remains usable.
   - Divider hit targets are easy to grab.
   - Keyboard focus can reach resize dividers.

## Test 11: Single Request Run

These sample services use placeholder endpoints unless you point the environment at a reachable REST API.

1. Configure the active environment with a reachable `baseUrl`.
2. Open a request tab.
3. Click `Send Request`.
4. Expected result:
   - Console events appear in order.
   - Response status, timing, headers, and body appear when a response is available.
   - Errors appear in the response or problems surface.
   - Secret values are redacted.

## Test 12: Save Response

1. Run a request that returns a response.
2. Open the `Response` utility tab.
3. Click `Save Response`.
4. Save to a test path.
5. Reopen the saved response from the project explorer.
6. Expected result:
   - The response saves successfully.
   - The saved response appears in the explorer.
   - Reopened response metadata and body match the saved run.
   - Saved artifacts do not expose credentials.

## Test 13: Flow Builder Open

1. In the project explorer, select `Authenticated Read` under `Flows`.
2. Expected result:
   - A flow tab is active.
   - The visual canvas appears.
   - Nodes are visible.
   - Success links are visible.
   - The flow step detail panel is visible.

## Test 14: Flow Builder Creation And Editing

1. In the explorer, click the `+` action on `Flows`.
2. Confirm a new empty flow opens.
3. Right-click the `Flows` header.
4. Confirm a context menu opens without immediately creating a flow.
5. Click `Add Flow` in the context menu.
6. Confirm another new empty flow opens.
7. Right-click an existing flow row.
8. Confirm a context menu opens without immediately deleting the flow.
9. Confirm the menu includes `Delete Flow`.
10. Choose a service in `Add request step`.
11. Click `Add Step`.
12. Select a node.
13. Click `Move Left` or `Move Right`.
14. Click `Add Success Path`.
15. Click `Add Failure Path`.
16. Drag a node to a new position.
17. Expected result:
   - A flow can be created without importing or reopening an existing project.
   - Right-click shows a menu instead of directly creating a flow.
   - Right-clicking a flow row offers `Delete Flow`.
   - Nodes can be added.
   - Nodes can be reordered.
   - Move Left and Move Right work with one click per position change.
   - Branch paths can be targeted with the `Path target` selector.
   - Success and failure links render distinctly.
   - Duplicate branch paths show as already existing instead of appearing to do nothing.
   - Dragged nodes stay attached to the pointer while moving.
   - Dropped node positions remain visually stable.
   - The project is marked dirty.

## Test 15: Flow Run

These sample services use placeholder endpoints unless you point the environment at a reachable REST API.

1. Configure the active environment with a reachable `baseUrl`.
2. Open `Authenticated Read`.
3. Click `Run Flow`.
4. Open the `Console` utility tab.
5. Expected result:
   - The console shows `Flow started`.
   - Step messages are grouped by step name.
   - Successful nodes show `success`.
   - Failed nodes show `failed`.
   - Downstream success-dependent nodes show `skipped` after an upstream failure.
   - Missing dependencies block execution before requests are sent.

## Test 16: Project Save And Reopen

1. Save the project to a temporary `.restproj` path.
2. Close and reopen the project.
3. Expected result:
   - Services survive round trip.
   - Flows survive round trip.
   - Flow nodes, links, and positions survive round trip.
   - Saved response metadata survives round trip.
   - Secret-bearing values remain protected.

## Approval Criteria

Approve check-in only if:

1. Automated verification passes.
2. Coverage remains above 90%.
3. The app opens as a standalone desktop app.
4. The default shell is less cluttered than the previous version.
5. New Project, tab `+`, editable URL, service editing, saved responses, flow creation, and flow editing all work.
6. Response, console, problems, and inspector are available without crowding the first screen.
7. Major panes can be resized.
8. Flow nodes stay attached to the pointer while dragging.
9. No credentials or secret values are visible in logs, saved responses, or project artifacts.
