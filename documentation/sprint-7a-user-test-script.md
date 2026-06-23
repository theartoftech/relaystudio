# Sprint 7A User Test Script

## Purpose

Use this script to validate the UX consolidation pass before approving check-in.

## Preflight

1. Confirm the working tree has only expected Sprint 7 and Sprint 7A changes:
   ```bash
   git status --short
   ```
2. Run the automated quality gate:
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

## Desktop Launch

1. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
2. Confirm Relay Studio opens as a standalone desktop app window.
3. Confirm the visible shell uses:
   - Compact top toolbar.
   - Project explorer on the left.
   - Main editor in the center.
   - Bottom utility dock.
   - No permanent activity rail.

## Manual UX Tests

### Test 1: Shell Clarity

1. Launch the app.
2. Inspect the first visible screen.
3. Expected result:
   - There is no separate left activity rail.
   - The project explorer is the primary navigation surface.
   - The top toolbar is not crowded with New, Open, Import, History, Notifications, and Settings buttons.
   - Search is not clipped.

### Test 2: Command Palette Owns Global Actions

1. Click `Search commands` or press `Cmd+K`.
2. Select `New Project`.
3. Expected result:
   - A new project is created.
   - A starter request opens.
   - The request URL remains editable.

### Test 2A: Tab Plus Creates Request

1. Click the `+` button in the tab row.
2. Expected result:
   - A new request/service is created.
   - A new request tab opens.
   - The new request is editable.

### Test 3: Contextual Toolbar

1. Open a request tab.
2. Confirm the primary toolbar action reads `Send Request`.
3. Open a flow tab.
4. Confirm the primary toolbar action reads `Run Flow`.
5. Expected result:
   - The toolbar action changes with context.
   - The environment selector remains visible.
   - Save remains available without dominating the toolbar.

### Test 4: Optional Inspector

1. Confirm the inspector is not visible by default.
2. Click the inspector toggle in the top toolbar.
3. Confirm the inspector opens on the right.
4. Click the inspector close button.
5. Expected result:
   - The inspector opens and closes cleanly.
   - The main editor gains space when the inspector is closed.
   - The old inspector mode rail is not present.

### Test 5: Utility Dock Tabs

1. Inspect the bottom dock.
2. Click `Response`, `Console`, and `Problems`.
3. Expected result:
   - Only one utility surface is shown at a time.
   - Response sub-tabs remain available under `Response`.
   - Console filters remain available under `Console`.
   - Problems shows either the current runtime issue or an empty state.

### Test 6: Regression Check

1. Open a service from the explorer.
2. Edit the request URL.
3. Open a flow from the explorer.
4. Add, delete, or reorder a flow step.
5. Expected result:
   - REST service editing still works.
   - Visual flow builder still works.
   - Project dirty state still appears after edits.

### Test 7: Resizable Panes

1. Drag the explorer/workbench divider.
2. Drag the bottom utility dock divider.
3. Open the inspector and drag the inspector divider.
4. Open a flow and drag the canvas/details divider.
5. Expected result:
   - Each divider resizes its adjacent pane.
   - Content remains usable after resizing.
   - The resize handles are reachable by keyboard.

### Test 8: Flow Node Drag

1. Open a flow.
2. Drag a node across the canvas.
3. Drop the node.
4. Expected result:
   - The node stays attached to the pointer while dragging.
   - The node drops where the pointer releases.
   - The new position persists in the current project state.

## Approval Criteria

Approve check-in only if:

1. All automated checks pass.
2. Coverage remains above 90%.
3. The shell feels less cluttered on first launch.
4. Global commands are still reachable through the command palette.
5. Inspector, response, console, and problems remain reachable without crowding the default screen.
6. Major panes can be resized.
7. Flow nodes track the pointer during drag.
8. Right-click on `Flows` shows a context menu and does not immediately create a flow.
9. Right-click on a flow row shows a context menu with `Delete Flow` and does not immediately delete the flow.
