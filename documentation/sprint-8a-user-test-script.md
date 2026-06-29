# Sprint 8A Human Test Script

## Purpose

Validate that flow authoring is understandable, low-friction, and safe enough for first-time use.

## Preflight

1. Run:
   ```bash
   npm run verify
   npm run test:e2e
   ```
2. Start the desktop app:
   ```bash
   npm run tauri dev
   ```

## Test 1: Empty Flow Templates

1. Click `+` beside `Flows` in the explorer.
2. Confirm the new flow opens in the workbench.
3. Confirm the canvas offers flow templates.
4. Click `Authenticated Read`.

Expected result: the flow changes from `0 steps - 0 links` to `3 steps - 2 links`, includes login and read steps, and login captures `accessToken`.

## Test 2: Create Read Cleanup Template

1. Create another new flow.
2. Click `Create Read Cleanup`.
3. Inspect the generated nodes.

Expected result: the flow contains login, create, read, and cleanup steps. Login captures `accessToken`; create captures `orderId`; cleanup is visibly marked.

## Test 3: Captures And Consumes

1. Open `Authenticated Read`.
2. Select `Login`.
3. Inspect `Captures`.
4. Select `Current User`.
5. Inspect `Consumes`.

Expected result: `Login` shows captured `accessToken` from `$.accessToken`; `Current User` shows it consumes `accessToken` through bearer auth.

## Test 4: Quick Capture Actions

1. Open a flow and select a step.
2. In `Response Mappings`, click `Capture Token`.
3. Click `Capture Id`.
4. Edit the generated variable names.
5. Remove one generated mapping.

Expected result: common mappings are created with useful defaults, edits apply immediately, and removal is explicit.

## Test 5: Cleanup Recognition

1. Open `Create Update Read Cleanup`.
2. Find `Cleanup Order` on the canvas.
3. Select it.

Expected result: the cleanup node is visually distinct, the details panel identifies it as cleanup work, and it still shows consumed variables such as `accessToken` and `orderId`.

## Test 6: Mapping Failure Diagnostics

1. Open `Authenticated Read`.
2. Change the login mapping JSONPath from `$.accessToken` to `$.doesNotExist`.
3. Run the flow.
4. Open `Console`.
5. Restore the JSONPath to `$.accessToken`.

Expected result: the failing message identifies `Login`, `$.doesNotExist`, and `accessToken`; downstream success-dependent steps are skipped.

## Approval Criteria

Approve Sprint 8A only if:

1. Flow templates work from a brand-new empty flow.
2. A first-time user can tell which step captures `accessToken` and `orderId`.
3. Later steps clearly show which variables they consume.
4. Cleanup steps are visually distinct before a flow is run.
5. The work surface does not reintroduce duplicate request-preview summaries.
6. Automated verification passes with coverage above 90%.
