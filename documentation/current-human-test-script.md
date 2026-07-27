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

1. Save a project so it appears in the recent-project history.
2. Open `Search commands` or press `Cmd+K`.
3. Select `Open Recent Projects`.
4. In the dialog, click a recent project row.
5. Expected result:
   - The recent project path is used directly.
   - The project opens if the file still exists.
   - Missing-file errors are shown in the status bar.
   - Recent Projects does not appear inside Explorer.

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

## Test 8: Request Designer Editing

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
   - Both `.json` and `.txt` files contain a validated Relay response envelope; a renamed arbitrary text file is rejected with recovery guidance.
   - Moving or substituting an artifact so its embedded path differs from project metadata is rejected.

## Test 12A: Multipart Current-Session File Approval

1. Open or import a request with a `multipart/form-data` file field.
2. Enter a synthetic local fixture path and click `Send Request` without approving it.
3. Confirm the send is blocked before native file access and the status identifies the filename and destination origin.
4. Click `Approve file` and confirm the control changes to `Approved for session`.
5. Change the request to a different origin and confirm the control returns to `Approve file` and Send is blocked.
6. Restore the original origin, approve, and send to a controlled loopback receiver; verify the exact fixture bytes arrive.
7. Save and reopen the project.
8. Expected result:
   - The persisted file path is empty after reopen.
   - Approval never survives a path, origin, project, or application-session change.
   - Browser mode still rejects local-file transmission after approval with the desktop-mode guidance.

## Test 12B: Execution Resource Limits And Recovery

1. Run a controlled endpoint that returns a response just below 5 MiB; confirm the response remains viewable.
2. Repeat with a fixed-length and then a streamed/chunked response above 5 MiB.
3. Expected result:
   - The request fails before the full body is formatted or shown through IPC.
   - The error says the response body exceeds the safe limit and suggests requesting a smaller response.
   - No credential or response-body contents appear in the console.
4. Compare saved responses just below the 1 MiB comparison limit, then try a larger body, deeply nested JSON, and a diff with excessive lines.
5. Expected result:
   - Boundary input compares normally.
   - Excessive byte, depth, line, node, or diff output fails early with actionable guidance.
6. Open a project just below the 4 MiB project limit, then try an oversized project and oversized recovery backup.
7. Expected result:
   - The boundary project opens and reloads.
   - The oversized project/backup fails before schema parsing and offers recovery guidance.

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

## Test 15: Flow Variables And Response Mapping

1. Open `Authenticated Read` under `Flows`.
2. Select the `Login` step.
3. Confirm `Response Mappings` is visible.
4. Confirm `$.accessToken` maps into `accessToken` and is marked secret.
5. Click `Add Mapping`.
6. Change the new JSONPath to `$.id`.
7. Change the variable name to `userId`.
8. Toggle `Secret`.
9. Remove the new mapping.
10. Change the login token mapping JSONPath to `$.doesNotExist`.
11. Run the flow.
12. Restore the JSONPath to `$.accessToken`.
13. Open `Create Update Read Cleanup`.
14. Confirm the flow has login, create, update, read, and cleanup steps.
15. Expected result:
   - Mapping edits are accepted and mark the project dirty.
   - Missing JSONPath failures identify the source step and expression.
   - Downstream success-dependent steps are skipped when token capture fails.
   - The lifecycle flow captures `accessToken` and `orderId` for later steps.
   - Secret captured values are not shown in console output.

## Test 16: Flow UX Hardening

1. Click `+` beside `Flows` in the explorer.
2. Confirm the empty flow opens with flow templates.
3. Click `Authenticated Read`.
4. Confirm the generated flow has `3 steps - 2 links`.
5. Confirm the login node or step details show it captures `accessToken`.
6. Create another new flow.
7. Click `Create Read Cleanup`.
8. Confirm the generated flow captures `accessToken` and `orderId`.
9. Confirm the cleanup node is visibly marked as cleanup work.
10. Select a step and confirm `Captures` and `Consumes` show only flow-relevant variable information.
11. Use `Capture Token` and `Capture Id` in `Response Mappings`.
12. Expected result:
   - Empty flows give useful starting points without requiring documentation.
   - Captured variable names are visible on the flow canvas or selected-step details.
   - Consumed variables make downstream dependencies understandable.
   - Cleanup work is visually distinct before running the flow.
   - The flow screen does not show duplicate request-preview summaries.

## Test 17: Flow Run

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
   - A failure edge runs only when its predecessor fails; it does not run after success, and a success edge does not run after failure.
   - With multiple incoming links, every link condition must match before the target runs.
   - Captured values remain available to later steps during the run but are not written into the saved project environment after the run.
   - Missing dependencies block execution before requests are sent.

## Test 18: Project Save And Reopen

1. Save the project to a temporary `.restproj` path.
2. Close and reopen the project.
3. Expected result:
   - Requests survive round trip.
   - Flows survive round trip.
   - Flow nodes, links, and positions survive round trip.
   - Saved response metadata survives round trip.
   - Secret-bearing values remain protected.

## Test 19: Swagger UI Secondary Destination Review

1. Use a controlled Swagger UI page whose `url` or `configUrl` points to a second OpenAPI document.
2. Click `Inspect Definition`.
3. Confirm the page URL and resolved definition destination are visible and the definition receiver has not been contacted.
4. Click `Cancel`; confirm the review closes and the receiver remains untouched.
5. Inspect again, click `Load Discovered Definition`, select a strict subset, and use `Add Selected`.
6. Expected result:
   - Inspection never retrieves the secondary document automatically.
   - Cross-origin destinations are visibly identified but still require the explicit Load action.
   - Credential userinfo or literal `token`, `apiKey`, password, cookie, or secret query values fail before display or retrieval.
   - Selected requests are added; unselected requests are absent.

## Test 20: Native Redirect Boundary

1. Run Relay Studio natively against a controlled loopback receiver.
2. Send a request with synthetic credential-class headers through a same-origin relative redirect.
3. Confirm the response succeeds and `Final origin` matches the reviewed origin.
4. Repeat with a redirect to a different host or port and inspect the second receiver.
5. Repeat with a missing `Location` header and a redirect loop.
6. Repeat a redirect in browser development mode.
7. Expected result:
   - Same-origin redirects complete and return final response identity.
   - Cross-origin redirects fail before the second receiver is contacted or any header is replayed.
   - Missing destinations and loops produce actionable errors without request paths or credentials.
   - Browser development mode blocks the redirect and directs the developer to enter the final URL explicitly.

## Test 21: Proxy Bypass Contract

1. Configure a controlled proxy and direct loopback receiver.
2. Add the direct host to `Proxy bypass list` and send a request.
3. Confirm the direct receiver is contacted and the proxy is not.
4. Enter a URL, port-specific entry, wildcard label, malformed domain, or invalid CIDR prefix.
5. Expected result:
   - Valid comma-separated domains, IP addresses, CIDR ranges, and `*` are accepted.
   - Malformed entries fail explicitly; they are never ignored silently.

## Test 22: Protected Flow Destination

1. Add or edit a response mapping and enter `baseUrl` with different casing or surrounding whitespace.
2. Validate or run the flow.
3. Expected result:
   - The flow is blocked before any request runs.
   - The error instructs the developer to edit the environment destination explicitly.
   - Ordinary non-destination mappings continue to work.

## Test 23: Request And Flow Code Examples

1. Right-click an open request tab, choose `Generate Code`, and select `cURL`.
2. Confirm the popup shows the request method, resolved URL, headers, and body without sending the request or changing project status.
3. Switch through HTTP, C#, Java, jQuery, Node.js, PHP, Python, and Ruby; use `Copy Code` and confirm visible success.
4. Repeat with JSON, text, URL-encoded, and multipart text/file bodies.
5. Right-click a flow tab, choose `Generate Code`, and select `Java`, then repeat with `jQuery`.
6. Expected result:
   - Request output matches the typed request and includes safe auth/secret placeholders.
   - Multipart local paths are absent and replaced with `SELECT_FILE` placeholders.
   - Flow requests appear in dependency order with success/failure prerequisites and response-mapping comments.
   - The Java flow states that `<REDACTED>` and other credential masks must be supplied securely before execution, uses Jackson Databind to parse mapped JSON responses, stores scalar values in `flowVariables`, and reuses values such as access tokens in later requests.
   - Before parsing, Java rejects non-2xx and empty responses. Malformed JSON is wrapped in a step-specific error that identifies credential/endpoint checks without including the response body; missing, null, and non-scalar mapping results also fail explicitly.
   - The jQuery flow parses mapped JSON responses, stores each mapped value in `flowVariables`, and reuses values such as access tokens in later requests.
   - The flow popup warns that application-specific branch handling must be added.
   - Language changes and clipboard failures remain actionable, focus stays in the modal, and Escape closes it.
   - Project dirty state, execution status, response history, and runtime logs remain unchanged.

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
9. No credentials or secret values are visible in logs, saved responses, project artifacts, or OpenAPI destination review.
10. Cross-origin redirects, malformed proxy bypass entries, and `baseUrl` response mappings fail before widening the network trust boundary.
11. Request and flow code examples are bounded, copyable, credential-safe, file-path-safe, and read-only.
