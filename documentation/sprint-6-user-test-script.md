# Sprint 6 User Test Script

## Purpose

Use this script to validate the Sprint 6 saved response changes before approving check-in.

## Preflight

1. Confirm the working tree has only the expected local changes:
   ```bash
   git status --short
   ```
2. Install dependencies if needed:
   ```bash
   npm install
   ```
3. Run the automated quality gate:
   ```bash
   npm run verify
   ```
4. Confirm coverage remains above the project requirement:
   - Statements: at least 90%.
   - Branches: at least 90%.
   - Functions: at least 90%.
   - Lines: at least 90%.
5. Run native tests:
   ```bash
   cd src-tauri
   cargo fmt --check
   cargo test
   cd ..
   ```
6. Run the desktop shell smoke tests:
   ```bash
   npm run test:e2e
   ```
7. Run the dependency audit:
   ```bash
   npm audit --audit-level=moderate
   ```

## Desktop Launch

1. Start the desktop app:
   ```bash
   npm run tauri dev
   ```
2. Confirm the app opens as a standalone Relay Studio desktop window.
3. Confirm the main workbench displays:
   - Activity rail.
   - Project explorer.
   - Request editor.
   - Response dock.
   - Inspector.

## Manual Saved Response Tests

These tests require a project/environment whose `baseUrl` points to a reachable REST API. The bundled sample uses placeholder endpoints, so use a real local or QA API project for the send/save/reopen workflow.

### Test 0: Create A Usable Project And Request

1. Click `New`.
2. Expected result:
   - A new unsaved project opens.
   - A `New Request` tab is active.
   - The request URL field is editable.
3. Paste or type a reachable endpoint into the request URL field, for example:
   ```text
   https://your-api-host.example.com/api/health
   ```
4. Expected result:
   - The typed URL remains visible in the URL field.
   - Project status says `Request URL updated.`
   - The project is marked dirty.

### Test 1: Save JSON Response

1. Open or configure a project with a reachable JSON endpoint.
2. Select a service that returns JSON.
3. Click `Send Request`.
4. Confirm the response dock shows:
   - HTTP status.
   - Duration.
   - Body content.
   - `Save Response` button.
5. Click `Save Response`.
6. Keep the generated `.json` path or enter a test path such as:
   ```text
   /private/tmp/relay-studio-json-response.json
   ```
7. Click `Save Response`.
8. Expected result:
   - Explorer `Saved Responses` count increases.
   - Project status says the response was saved.
   - The project becomes dirty because metadata was added.
   - The saved `.json` file contains a `relay-studio-response` artifact envelope.
   - Secret-bearing fields such as `token`, `accessToken`, `password`, and `secret` are redacted.

### Test 2: Reopen JSON Response

1. In the explorer, expand `Saved Responses`.
2. Click the response saved in Test 1.
3. Expected result:
   - A response tab opens.
   - The response dock displays the saved status and body.
   - The console logs that a saved response was loaded.
   - No request is sent during reload.

### Test 3: Save Raw Non-JSON Response

1. Select or configure a service that returns `text/plain` or another non-JSON content type.
2. Click `Send Request`.
3. Click `Save Response`.
4. Confirm the dialog warns that non-JSON responses save as redacted raw text.
5. Save to a `.txt` path such as:
   ```text
   /private/tmp/relay-studio-raw-response.txt
   ```
6. Expected result:
   - The file contains only the redacted raw response body.
   - Project metadata still records method, URL, status, timing, content type, and path.
   - Bearer/token/password-style values are redacted.

### Test 4: Overwrite Confirmation

1. Save any response to a known path.
2. Save another response to the same path.
3. Expected result:
   - The first click shows an overwrite warning.
   - The button changes to `Overwrite Response`.
   - The file is replaced only after the confirmation click.

### Test 5: Invalid Path Handling

1. Open `Save Response`.
2. Enter a path without `.json` or `.txt`, for example:
   ```text
   /private/tmp/relay-studio-response.html
   ```
3. Click `Save Response`.
4. Expected result:
   - The app rejects the save.
   - The error says saved response files must use `.json` or `.txt`.
   - No saved response metadata is added to the project.

### Test 6: Metadata Survives Project Save/Reopen

1. Save a response.
2. Save the project to a `.restproj` file.
3. Close and reopen the project file.
4. Expected result:
   - The saved response still appears in the explorer.
   - Clicking it reloads the response from its saved file path.

## Regression Checks

1. Confirm normal request execution still works.
2. Confirm failed requests still show errors in the response dock and console.
3. Confirm project save/open still works.
4. Confirm no secret values are visible in:
   - Console messages.
   - Saved response JSON artifacts.
   - Raw saved response files.
   - Project metadata.

## Approval Criteria

Approve check-in only if:

1. All automated checks pass.
2. Coverage remains above 90%.
3. JSON responses save and reopen.
4. Raw responses save with the warning and reopen.
5. Overwrite confirmation works.
6. Invalid paths are rejected.
7. Project metadata persists after save/reopen.
8. Saved files do not expose credentials.
