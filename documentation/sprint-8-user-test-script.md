# Sprint 8 Human Test Script

## Purpose

Validate flow variables and response mapping behavior before approval.

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

## Test 1: Mapping Editor

1. Open `Authenticated Read` under `Flows`.
2. Select the `Login` step.
3. Confirm `Response Mappings` is visible in the step details panel.
4. Confirm the default mapping captures `$.accessToken` into `accessToken`.
5. Click `Add Mapping`.
6. Change the new mapping JSONPath to `$.id`.
7. Change the variable name to `userId`.
8. Toggle `Secret` on and off.
9. Remove the new mapping.

Expected result: mapping fields edit immediately, the project is marked dirty, and removed mappings disappear.

## Test 2: Token Capture Into Later Requests

1. Configure `baseUrl` for a reachable REST API.
2. Confirm the login response contains `accessToken` or `token`.
3. Run `Authenticated Read`.
4. Open the console dock.

Expected result: the login step succeeds, `accessToken` is captured as a secret, later authenticated requests use the captured token, and the token value is not shown in console output.

## Test 3: Missing JSONPath

1. Open `Authenticated Read`.
2. Change the login mapping JSONPath to `$.doesNotExist`.
3. Run the flow.

Expected result: the login step fails with a message identifying the source step and JSONPath, and downstream success-dependent steps are skipped.

## Test 4: Lifecycle Flow

1. Open `Create Update Read Cleanup`.
2. Confirm the flow contains login, create, update, read, and cleanup steps.
3. Confirm login captures `accessToken`.
4. Confirm create captures `orderId` from `$.id`.
5. Run the flow against a test API that supports those endpoints.

Expected result: create runs before update/read/delete, `orderId` is injected into later path params, and cleanup delete runs when upstream steps succeed.
