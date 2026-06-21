# Sample Test Project Definition

## Purpose

This document defines a neutral Relay Studio project structure for proving request execution, response inspection, saved responses, flows, role gates, redaction, and negative-path behavior against any suitable external REST service.

The external service must provide equivalent auth, read, write, role-gate, and error behavior. It is a validation target only. Relay Studio is a general-purpose REST/API client, not a domain-specific app.

## Project Metadata

| Field | Value |
| --- | --- |
| Project Name | Sample API Regression |
| File Name | `sample-api-regression.restproj` |
| Default Environment | QA Environment |
| Base URL Variable | `baseUrl` |
| Live Acceptance Tag | `live-rest` |

## Environments

| Environment | Variables | Notes |
| --- | --- | --- |
| QA Environment | `baseUrl`, `adminUsername`, `standardUsername`, `restrictedUsername`, secret passwords | Primary external validation target |
| Staging Environment | `baseUrl`, optional credentials | Defined for UI parity, not required for first live gate |
| Production Environment | `baseUrl` only by default | Destructive flows must be disabled by default |

## Vault Variables

| Variable | Secret | Source |
| --- | --- | --- |
| `adminPassword` | Yes | Local test config |
| `standardPassword` | Yes | Local test config |
| `restrictedPassword` | Yes | Local test config |
| `accessToken` | Yes | Extracted from login |
| `refreshToken` | Yes | Extracted from login when present |
| `clientSecret` | Yes | Local test config when OAuth is used |

Passwords and tokens must never be committed. Live test credentials must be supplied by local configuration or CI secrets.

## Service Folders And Services

### Utilities

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| Health Check | GET | `/health` | None | Verify base service availability |

### Auth

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| Login | POST | `/auth/login` | None | Acquire bearer token |
| Current User | GET | `/auth/me` | Bearer | Verify authenticated user context |
| Refresh Token | POST | `/auth/refresh` | Bearer or refresh token | Verify token refresh behavior |

### Users

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| List Users | GET | `/users` | Bearer | Verify authenticated read access |
| Get User | GET | `/users/{userId}` | Bearer | Verify path parameter substitution |
| Restricted User Update | PUT | `/users/{userId}` | Bearer | Verify restricted role behavior |

### Catalog

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| List Products | GET | `/products` | Bearer | Load published product-style records |
| Get Product | GET | `/products/{productId}` | Bearer | Load one record by path parameter |
| Search Products | GET | `/products/search?q={query}` | Bearer | Verify query parameter substitution |

### Orders

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| Create Order | POST | `/orders` | Bearer | Create a test record |
| Get Order | GET | `/orders/{orderId}` | Bearer | Reopen created record |
| Update Order | PUT | `/orders/{orderId}` | Bearer | Verify body templating and update behavior |
| Cleanup Order | DELETE | `/orders/{orderId}` | Bearer | Remove record created by test flow |

### Admin

| Service | Method | Path | Auth | Purpose |
| --- | --- | --- | --- | --- |
| Admin Settings | GET | `/admin/settings` | Bearer admin | Verify admin allowed and standard user denied |
| Audit Events | GET | `/admin/audit-events` | Bearer admin | Verify audit data and redaction |
| Restricted Setup Write | POST | `/admin/config` | Bearer | Verify setup write denial |

## Required Flows

### Authenticated Read Flow

1. Run Login as admin.
2. Extract `$.token` or `$.accessToken` into secret variable `accessToken`.
3. Run Current User.
4. Run List Products.
5. Extract first product identifier into `productId`.
6. Run Get Product.
7. Save the response.

### Create And Cleanup Flow

1. Run Login as admin.
2. Extract `$.token` or `$.accessToken` into secret variable `accessToken`.
3. Run Create Order.
4. Extract `$.id` or `$.orderId` into `orderId`.
5. Run Update Order.
6. Run Get Order.
7. Save the reopened response.
8. Run Cleanup Order even when save/reopen fails, when configured.

### Role Gates

1. Login as standard user and assert a normal read request returns 200.
2. Login as standard user and assert Admin Settings returns 403.
3. Login as standard user and assert Restricted Setup Write returns 403.
4. Login as restricted user and assert a permitted read request returns 200.
5. Login as restricted user and assert update/delete behavior returns 403.

## Live Test Pass/Fail Rules

- Passing live tests must not depend on committed credentials.
- A live test run is invalid if any secret appears in console output, response metadata, saved project state, diagnostics, or exported logs.
- Destructive or data-creating flows must use cleanup steps.
- Cleanup failure does not hide the original failure; both must be reported.
- Role-gate tests pass only when the expected status code and UI error category match.
- A network outage, TLS failure, or unavailable target marks live acceptance as blocked, not passed.
