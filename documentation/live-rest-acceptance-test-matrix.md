# Live REST Acceptance Test Matrix

## Target

- Base URL: supplied through local test configuration as `baseUrl`.
- Purpose: prove Relay Studio works against a real REST service with authentication, payloads, chained flows, role gates, error conditions, and redaction.
- Target selection: any external service with equivalent coverage is valid. The target is a validation fixture, not product identity.

## Test Users

| Role | Default Username Variable | Purpose |
| --- | --- | --- |
| Admin | `adminUsername` | Full read/write setup, lifecycle, audit, and admin access |
| Standard | `standardUsername` | Normal runtime access and restricted admin/setup access |
| Restricted | `restrictedUsername` | Limited read access and write denial |

Passwords should be supplied through local test configuration, never committed.

## Single Request Services

| Service | Method | Path Pattern | Auth | Expected Result |
| --- | --- | --- | --- | --- |
| Health | GET | `/health` | None | 200 with health payload |
| Login | POST | `/auth/login` | None | 200 with bearer token or equivalent credential |
| Current User | GET | `/auth/me` | Bearer | 200 with username and roles/permissions |
| List Records | GET | `/records` or domain equivalent | Bearer | 200 with collection payload |
| Get Record | GET | `/records/{recordId}` or domain equivalent | Bearer | 200 with one record |
| Search Records | GET | `/records/search?q={query}` or domain equivalent | Bearer | 200 with filtered results |
| Create Record | POST | `/records` or domain equivalent | Bearer | 200/201 with created identifier |
| Update Record | PUT or POST | `/records/{recordId}` or domain equivalent | Bearer | 200 with updated record |
| Delete Record | DELETE | `/records/{recordId}` or domain equivalent | Bearer | 200/204 cleanup |
| Admin Settings | GET | `/admin/settings` or domain equivalent | Bearer admin | 200 for admin, 403 for standard user |
| Audit Events | GET | `/admin/audit-events` or domain equivalent | Bearer admin | 200 with audit data and no secrets |
| Restricted Write | POST | `/admin/config` or domain equivalent | Bearer non-admin | 403 |

## Chained Flow: Authenticated Read

### Steps

1. POST login request.
2. Extract `$.token` or `$.accessToken`.
3. Set `Authorization: Bearer {{accessToken}}`.
4. GET current user.
5. GET list records.
6. Extract first record identifier.
7. GET record by extracted identifier.

### Assertions

- Token is stored as a secret variable.
- Token is redacted in console and saved project state.
- Collection response is readable in the response viewer.
- Extracted identifier can be reused in a later path parameter.
- Console shows each step and final success.

## Chained Flow: Create And Cleanup

### Steps

1. POST login request.
2. POST create record.
3. Extract created record identifier.
4. PUT or POST update record with extracted identifier.
5. GET record by extracted identifier.
6. DELETE cleanup record.

### Assertions

- Created identifier is extracted and reused.
- Save response uses the extracted identifier in metadata.
- Reopened response matches the same identifier.
- Delete cleanup executes after the flow.
- If save or reopen fails, the console identifies the failed step and cleanup policy.

## Role Gate Tests

| Scenario | User | Request | Expected |
| --- | --- | --- | --- |
| Standard read | Standard | GET normal collection/read endpoint | 200 |
| Standard admin denial | Standard | GET admin endpoint | 403 |
| Standard setup write denial | Standard | POST restricted setup endpoint | 403 |
| Restricted read | Restricted | GET permitted read endpoint | 200 |
| Restricted write denial | Restricted | POST/PUT/DELETE protected write endpoint | 403 |
| Admin access | Admin | GET admin endpoint | 200 |

## Negative Tests

| Scenario | Expected App Behavior |
| --- | --- |
| Invalid login | Show 401-style error with response body and no stack trace |
| Missing bearer token | Show auth setup error before request or 401 response if sent |
| Invalid endpoint path | Show 404 response with request details |
| Invalid JSON body | Block execution before send and highlight JSON editor |
| Invalid JSONPath mapping | Block flow execution with mapping validation error |
| Missing extracted variable | Identify source step and target field |
| Timeout | Show timeout message, elapsed time, and retry guidance |
| TLS failure | Show certificate/TLS failure without hiding the target URL |
| Network unavailable | Show connection failure and keep project state intact |
| Permission denied while saving response | Show filesystem error and preserve unsaved response |
| Corrupted project file | Show open failure with recovery guidance |

## Security Assertions

- Bearer tokens, passwords, API keys, client secrets, and authorization headers are redacted everywhere except active credential entry controls.
- Saved response files never include project credentials.
- Project files encrypt secrets.
- Console events can include request URL, method, status, timing, and non-secret headers.
- Console events must not include secret header values, password fields, token values, or OAuth client secrets.
- Exported diagnostics redact secrets by default.

## Coverage Expectations

- Unit tests cover request construction, auth behavior, variable substitution, JSONPath extraction, project encryption, and typed errors.
- Component tests cover service editor, auth panel, response viewer, console, flow mapping, and save prompt.
- Playwright tests cover full user workflows.
- Live REST acceptance tests run as a gated suite, separate from fast unit tests.
- Release candidate requires 90% coverage and passing the configured live REST suite.
