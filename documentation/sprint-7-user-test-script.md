# Sprint 7 User Test Script

## Purpose

Use this script to validate the Sprint 7 visual flow builder changes before approving check-in.

## Preflight

1. Confirm the working tree has only expected Sprint 7 changes:
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
4. Run the dependency audit:
   ```bash
   npm audit --audit-level=moderate
   ```
5. Run the desktop shell smoke tests:
   ```bash
   npm run test:e2e
   ```

## Desktop Launch

1. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
2. Confirm the app opens as a standalone Relay Studio desktop window.
3. Confirm the explorer includes `Flows`.

## Manual Flow Builder Tests

### Test 1: Create A New Flow

1. In the project explorer, click the `+` action on `Flows`.
2. Expected result:
   - A new flow is created.
   - A flow tab opens.
   - The editor shows an empty visual canvas ready for request steps.
   - The project is marked dirty.
3. Right-click the `Flows` header.
4. Expected result:
   - A context menu opens.
   - No flow is created until `Add Flow` is selected.
5. Click `Add Flow`.
6. Expected result:
   - Another new flow is created.
7. Right-click an existing flow row.
8. Expected result:
   - A context menu opens.
   - No flow is deleted until `Delete Flow` is selected.
   - The menu includes `Delete Flow`.

### Test 2: Open The Authenticated Read Flow

1. In the project explorer, expand `Flows`.
2. Click `Authenticated Read`.
3. Expected result:
   - A flow tab is active.
   - The editor shows a visual canvas.
   - Nodes appear for Login, Current User, List Products, and Get Product.
   - Green success links connect the steps.
   - The right step panel shows details for the selected step.

### Test 3: Add A Request Step

1. In the flow toolbar, choose a service from `Add request step`.
2. Click `Add Step`.
3. Expected result:
   - A new node appears on the canvas.
   - The project is marked dirty.
   - The explorer flow count remains stable because the flow was edited, not duplicated.

### Test 4: Delete A Step

1. Click a node in the canvas.
2. Click `Delete Step`.
3. Expected result:
   - The node is removed.
   - Any links connected to the node are removed.
   - The project is marked dirty.

### Test 5: Reorder A Step

1. Select a node that is not first.
2. Click `Move Left`.
3. Select a node that is not last.
4. Click `Move Right`.
5. Expected result:
   - Node order changes.
   - Node positions update horizontally.
   - The project is marked dirty.

### Test 6: Add Branch Links

1. Select a node with another node after it.
2. Choose the intended destination in `Path target`.
3. Click `Add Success Path`.
4. Click `Add Failure Path`.
5. Expected result:
   - Success links render in green.
   - Failure links render in red.
   - Duplicate clicks do not create duplicate links.
   - Duplicate branch paths show as already existing instead of appearing to do nothing.

### Test 7: Drag Node Layout

1. Drag a flow node to a new location.
2. Save the project.
3. Reopen the project.
4. Expected result:
   - The node remains in the saved position.
   - The flow still opens from the explorer.

### Test 8: Run Flow

These sample services use placeholder endpoints unless you point the environment at a reachable REST API.

1. Configure the active environment with a reachable `baseUrl`.
2. Open `Authenticated Read`.
3. Click `Run Flow`.
4. Expected result:
   - The console shows `Flow started`.
   - Each step logs grouped messages such as `[Login] running...` and `[Login] success.`
   - Successful nodes show `success`.
   - If a step fails, downstream success-dependent steps show `skipped`.
   - If a service is missing or a link is invalid, the flow is blocked before sending requests.

## Regression Checks

1. Single request sending still works from request tabs.
2. Saved response behavior from Sprint 6 still works.
3. New Project still creates a usable starter request.
4. Project save/open preserves services, flows, nodes, links, node positions, and saved responses.

## Approval Criteria

Approve check-in only if:

1. All automated checks pass.
2. Coverage remains above 90%.
3. The visual flow builder opens from the explorer.
4. Add, delete, connect, reorder, and drag-position persistence work.
5. Success and failure paths are visible.
6. Flow console output is grouped by flow step.
7. Invalid dependencies block execution before requests are sent.
