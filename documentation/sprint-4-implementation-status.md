# Sprint 4 Implementation Status

## Status

Implemented.

Sprint 4 adds the REST Service Designer foundation: reusable service definitions, editor controls for request construction, validation markers, auth preview separation, environment variable resolution, and a coverage gate above 90% for production logic modules going forward.

## Delivered

- Expanded project service schema for:
  - HTTP method and path.
  - Timeout and retry policy.
  - Headers, query params, and path params.
  - Request body content type and raw body.
  - Auth profile data for none, bearer token, API key, basic auth, OAuth client credentials, and custom header.
- REST service designer module in `src/services/serviceDesigner.ts`.
- Service CRUD helpers for create, duplicate, rename, delete, and reorder.
- Request validation for:
  - Unsupported methods.
  - Invalid paths.
  - Timeout and retry ranges.
  - Duplicate headers and query params.
  - Missing path params.
  - Malformed JSON bodies.
  - Missing auth inputs.
  - Unknown variable references.
- Request construction preview with generated auth separated from user-defined headers.
- Secret redaction in generated auth previews.
- Editable shell panels for Authorization, Headers, Query Params, Path Params, Body, Retry, and Settings.
- Explorer service selection wired to the active editor.
- Body beautify and minify actions.
- Coverage command and enforced threshold:
  - `npm run test:coverage`
  - 90% minimum for statements, branches, functions, and lines.
  - `npm run verify` now runs the coverage gate.

## Coverage

Current coverage gate result:

- Statements: 95.83%
- Branches: 95.05%
- Functions: 93.67%
- Lines: 97.39%

The numeric gate applies to production logic modules under `src/lib`, `src/project`, and `src/services`. The monolithic React shell remains covered by component tests and Playwright smoke tests; future UI-heavy work should extract behavior into testable modules before adding substantial logic.

## Verification

- `npm run verify`: passed.
- `cargo test`: passed.
- `npm run test:e2e`: passed.
- `npm audit --audit-level=moderate`: passed, 0 vulnerabilities.

## Test Coverage Added

- Service creation defaults.
- Duplicate, rename, delete, and reorder helpers.
- Key/value row upsert and remove behavior.
- URL construction from base URL, path params, and query params.
- Bearer, API key, basic, OAuth client credentials, custom header, and no-auth previews.
- Secret redaction in generated auth.
- Unsupported method, invalid path, timeout, retry, duplicate row, missing path param, malformed JSON, and missing auth validation.
- Unknown variable reference warnings.
- JSON beautify and minify behavior.
- Project model creation and touch behavior.
- Browser and Tauri persistence adapter validation.

## Deferred

- OpenAPI/Swagger import remains Sprint 4A.
- Full per-field visual error highlighting can be expanded as individual editors mature.
- UI component coverage can be broadened as the monolithic shell is split into smaller components.
