# Sprint 18B Network And Import Boundary Closure

Status: Complete
Closure date: July 20, 2026
Scope source: Sprint 18A remediation register

## Decision

Sprint 18B closes all six assigned network and import boundary findings: RS18A-012, RS18A-013, RS18A-015, RS18A-020, RS18A-021, and RS18A-026. The patch does not change the project schema, Tauri capabilities, CSP, hosted-service posture, or installer configuration.

## Security Invariant

No request, credential-class header, imported document, or flow-derived destination may cross from a user-reviewed origin to a different origin implicitly. A developer who intends to use another origin must enter or approve that destination explicitly.

## Fixed Paths

| Finding | Vulnerable path | Implemented control | Retest evidence |
| --- | --- | --- | --- |
| RS18A-012 | Native Reqwest automatically replayed arbitrary headers after a cross-origin redirect. | A custom native redirect policy follows only the same scheme, host, and effective port; cross-origin responses stop before replay and return an origin-only actionable error. Browser development mode uses manual redirect handling and blocks every redirect before replay. | Two-origin Rust receiver proves the target receives no request and the error contains no synthetic key; browser transport tests assert manual mode and explicit rejection. |
| RS18A-013 | Proxy `bypassList` reached Rust but did not affect routing. | Enabled proxies receive a validated Reqwest `NoProxy` list. Domains, IPs, CIDR ranges, and `*` are accepted; schemes, port-specific entries, malformed domains, wildcard labels, and invalid prefixes fail explicitly. | Direct/proxy loopback receivers plus malformed-entry tests. |
| RS18A-015 | A response mapping named `baseUrl` could change later request destinations. | Flow validation rejects `baseUrl` case-insensitively before any node executes and directs the user to edit the environment explicitly. | Flow validation/run regression; ordinary mappings remain covered by the existing suite. |
| RS18A-020 | Inspecting Swagger UI fetched its secondary definition immediately. | Inspection returns a destination-review state only. The definition is fetched only after `Load Discovered Definition`; Cancel clears review without a request. Credential-bearing destinations fail before display. | Service call-count test and Chromium/WebKit Playwright workflow. |
| RS18A-021 | External references were checked before fetch but not after a redirect. | Native HTTP returns final URL identity and every OpenAPI fetch revalidates the final origin before parsing or resolving relative references. | Root and external-reference final-origin regressions, redirect-loop and missing-location native tests. |
| RS18A-026 | General REST execution could follow an unreviewed redirect to localhost, LAN, or another origin. | General requests share the same-origin redirect policy. Successful responses retain final URL identity; UI presentation shows only final origin to avoid exposing URL credentials or query values. | Same-origin success, cross-origin rejection, 10-request limit, malformed redirect, transport normalization, and response-formatting tests. |

## Preserved Legitimate Behavior

- Direct HTTP(S) requests continue to work in desktop and browser development modes.
- Native same-origin relative redirects continue to work and keep request headers because the trust origin is unchanged. Browser development mode blocks redirects because Fetch cannot safely expose every redirect destination before replay.
- Direct Swagger/OpenAPI URLs remain one-step inspections; Swagger UI secondary destinations require one additional explicit action.
- Explicit operation selection, Add Selected, and Add and Save Selected are unchanged.
- OpenAPI query credentials expressed as `{{variable}}` placeholders remain usable; literal credential values and URL userinfo are rejected.
- Ordinary response mappings continue to capture variables; only the reserved destination variable `baseUrl` is blocked.
- Default proxy bypass values such as `localhost,127.0.0.1` now work as displayed.

## Failure Modes Verified

- Cross-origin redirects, including host or port changes.
- Missing redirect `Location` and redirect loops beyond the 10-request policy.
- External-reference fetches whose actual final origin changes.
- Swagger secondary destination cancellation and cross-origin review.
- Credential userinfo and literal sensitive query values in direct or discovered OpenAPI URLs.
- Malformed proxy bypass domains, schemes, ports, wildcard labels, and CIDR prefixes.
- Case and whitespace variants of the protected `baseUrl` flow mapping.

## Verification Record

| Gate | Result |
| --- | --- |
| Focused TypeScript tests | 72 service, importer, formatting, and flow tests passed after the failing-first cycles. |
| Full TypeScript suite and coverage | 250 passed; statements 95.81%, branches 90.83%, functions 98.20%, and lines 96.96%. The separately configured live REST suite passed 4 tests. |
| Rust tests | 33 passed, including controlled loopback redirect, header, proxy, multipart, persistence, and recovery paths. |
| Rust coverage | 92.62% line coverage. |
| Playwright | 56 passed across Chromium and WebKit, including destination review, Cancel, explicit Load, selective import, Add and Save, external references, PATCH, and forms. |
| Static and supply-chain gates | Type checking, ESLint, Clippy, npm audit (0 vulnerabilities), license policy, cargo-deny/RustSec, and the repository secret scan passed. |
| Build and documentation | Production frontend and current unsigned macOS `.app` built; all changed Word pages were rendered and visually inspected; Word, Visio, and traceability validation passed. |
| Interactive evidence | The rebuilt packaged macOS app exposed the Swagger destination review after requesting only the UI page; Cancel sent no second request, and explicit Load then retrieved the definition. A native same-origin redirect completed with HTTP 200 and displayed only `Final origin`; a host-name change was rejected visibly, the target receiver remained untouched, and the packaged process emitted no runtime error. Chromium and WebKit also exercised selection and Add and Save. |

The final diff check passed and no beta installer artifact was changed.

## No-Change Controls

- Tauri capabilities and Content Security Policy remain unchanged.
- No backend, cloud persistence, updater, signing, or marketplace infrastructure was added.
- No real credential, live acceptance configuration, beta installer, or local-only project file was read into documentation or tests.

## Remaining Uncertainty And Follow-Up

Sprint 18B does not close the separate Sprint 18C canonical URL/artifact redaction findings or Sprint 18D response/import resource-bound findings. The response object intentionally retains the full final URL in memory for origin enforcement; persistent and diagnostic treatment remains subject to the Sprint 18C canonical redaction work. Cross-platform packaged verification remains a Sprint 18E readiness activity because installer inputs were not changed here.
