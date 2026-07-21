# Sprint 18A Review Baseline And Finding Validation

Status: Complete
Review date: July 20, 2026
Reviewed commit: `0b5b17daf274f01f63f34dbd3f07650a4eb69e50`
Repository: Relay Studio `main`

## Decision

Sprint 18A is complete. The review establishes a reproducible code, architecture, and security baseline and assigns every retained issue to a bounded remediation sprint. It is not a release-readiness approval: 10 high, 14 medium, and 2 low findings remain open for Sprints 18B-18E. No critical finding was validated.

The repeated discovery scan was stopped because it was adding duplicate evidence rather than materially different findings. Six completed discovery shards repeatedly converged on the same trust-boundary defects. Their results and the earlier single-pass scan were consolidated into 26 independently addressable instances; each instance was then validated once. No further discovery pass is required for Sprint 18A.

## Measurable Success Criteria

| Criterion | Result |
| --- | --- |
| Freeze an exact review target and environment | Met: commit and toolchain are recorded below. |
| Reconcile duplicate scanner output without dropping distinct controls | Met: 21 original instances plus 5 distinct additions produce 26 closure rows. |
| Trace every retained instance from source through the closest control to impact | Met: all 26 instances have exact source/control/sink evidence in the remediation register. |
| Separate exploitable security paths from correctness, availability, and defense-in-depth work | Met: category and calibrated severity are recorded per finding. |
| Assign an owner, remediation sprint, and retest condition | Met for all 26 findings. |
| Keep review evidence free of credentials and local acceptance data | Met: only synthetic descriptions and repository locations are recorded. |
| Preserve the local-first boundary, CSP, capabilities, and installer artifacts | Met: no application, capability, CSP, installer, or local acceptance file changed in 18A. |

## Baseline And Reproduction Context

| Item | Recorded value |
| --- | --- |
| macOS | 26.2 (Build 25C56) |
| Node.js | 24.15.0 |
| npm | 11.12.1 |
| Rust | rustc 1.96.0 |
| Cargo | 1.96.0 |
| Application stack | React 18, strict TypeScript, Vite, Tauri 2, Rust, Reqwest/rustls |
| Primary review surfaces | `src`, `src-tauri`, `e2e`, `.github/workflows`, packaging/security tools, retained engineering documentation |
| Focused closure suite | 8 Vitest files, 82 tests passed |
| Existing direct reproductions | Cross-origin custom-header forwarding, redirected OpenAPI-reference fetch, multipart persisted-path upload, saved-response URL credential persistence, and raw API-key redaction gaps |

The review intentionally did not use live credentials, the gitignored live-REST configuration, external production services, or the beta installers under `artifacts/beta-installers/`. Packaging and cross-platform smoke tests are not claimed by 18A because no packaged behavior changed; they remain required in Sprint 18E.

## Validation Method

Each candidate was judged against the same five-part rubric:

1. A user-reachable file, URL, response, workflow, or CI interface supplies the source value.
2. The exact source-to-control-to-sink path is present at the reviewed commit.
3. The closest existing control does not prevent the claimed behavior.
4. The impact violates a documented Relay Studio trust boundary or produces a repeatable developer-workflow failure.
5. Counterevidence and explicit operator actions are included in severity rather than omitted.

Direct reproductions were reused where they already proved the exact instance. Other instances were closed with bounded static traces plus existing focused tests; the review did not create unsafe proof-of-concept files or contact non-loopback systems. Confidence is highest for direct reproductions and high for complete static paths. No row remains unvalidated or deferred.

## Security And Trust-Boundary Summary

| Boundary | Confirmed result | Disposition |
| --- | --- | --- |
| Native HTTP redirects | Default redirect handling can change destinations, retain custom credential headers, and bypass importer origin review. | Remediate first in 18B. |
| Swagger/OpenAPI retrieval | Swagger HTML can select a second destination without review; response and graph bytes are not comprehensively bounded. | Destination controls in 18B; limits in 18D. |
| Proxy routing | The documented bypass list reaches Rust but is never applied. | Remediate in 18B. |
| Project to local filesystem | Persisted multipart and saved-response paths retain native file authority after an untrusted project is opened. | Rearm/ownership controls in 18C. |
| Persistence and redaction | URL, raw API-key, query/path, form, and flow-captured values can escape current redaction coverage. | Canonicalize in 18C. |
| Flow execution | Response mappings can change `baseUrl`; failure edges are not outcome-gated. | Network portion in 18B; execution semantics in 18D. |
| Resource consumption | Native response, React rendering, project input, OpenAPI input, and comparison output lack coordinated bounds. | Add shared limits in 18D. |
| CI and artifact inspection | Protected configuration is job-scoped; mutable action tags and scanner exclusions widen the blind spot. | Harden in 18E. |

## Existing Controls That Remain Effective

- Tauri capabilities are scoped to the main window and do not grant broad filesystem, shell, process, updater, or remote-window permissions.
- CSP keeps scripts and default content self-hosted and blocks frames, objects, forms, and base-URI changes.
- Remote content is rendered as React text; no `dangerouslySetInnerHTML`, `eval`, or dynamic-function sink was found.
- Native HTTP validates methods, HTTP(S) schemes, timeout bounds, multipart structure, file type, per-file size, and generated multipart boundaries.
- OpenAPI import requires explicit operation selection and avoids importing recognized credential examples.
- Project writes retain atomic temporary replacement, backups, concurrent-save protection, and format/version checks.
- Release gates retain TypeScript/Rust coverage, dependency, license, secret, Clippy, RustSec, and browser test controls.

These controls reduce likelihood and scope but do not defeat the specific open findings.

## Architecture Conformance

| Architecture claim | Evidence | Assessment | Follow-up |
| --- | --- | --- | --- |
| Local-first with no hosted backend/database | Project files, browser fallback, and native commands are local; no server or database layer exists. | Conforms. | Preserve. |
| Least-privilege Tauri shell | `src-tauri/capabilities/default.json` permits only core window operations and dialog open. | Conforms. | Recheck after every capability change. |
| Restrictive bundled-webview policy | `src-tauri/tauri.conf.json` uses self-only scripts and blocks frames, objects, forms, and base changes. | Conforms. | Preserve. |
| Explicit selective OpenAPI import | Import conversion occurs only after operation selection. | Conforms. | Preserve while adding destination review. |
| Every native command independently validates privileged inputs | HTTP and multipart inputs are checked, but project schemas and persisted file authority are not validated deeply enough. | Deviates. | 18C and 18D. |
| External OpenAPI references remain same-origin | Origin is checked before fetch, but the native client follows redirects without returning/revalidating final identity. | Deviates. | 18B. |
| Shared redaction protects every persistent/output surface | Redaction logic is split across modules and omits several URL/raw/form/mapping representations. | Deviates. | 18C. |
| Proxy bypass matches visible settings | `bypass_list` is deserialized but unused by `apply_proxy_settings`. | Deviates. | 18B. |
| Flow edge condition controls execution | Only success dependencies are checked; failure edges do not gate their targets. | Deviates. | 18D. |
| Untrusted inputs are bounded | Depth/document count and multipart file size exist, but aggregate bytes, response bodies, project files, rendering, and diff output are not coordinated. | Deviates. | 18D. |
| Protected CI configuration is ephemeral and least-scoped | The decoded file is temporary, but the base64 secret is available to the whole job before setup actions. | Partially conforms. | 18E. |
| Generated-artifact and OOXML gates describe actual coverage | Current tools silently skip several claimed formats/parts. | Deviates. | 18E. |

## Code-Quality Review

| Area | Evidence-backed observation | Priority |
| --- | --- | --- |
| Type safety | Strict TypeScript and typed Rust command payloads are broadly used; request methods, bodies, project state, and errors have explicit models. | Preserve. |
| Error behavior | User workflows generally fail actionably, but several boundary failures still use generic strings rather than a shared typed code across the Tauri boundary. | Address while touching each finding; avoid a broad rewrite. |
| Frontend ownership | `src/App.tsx` is 5,282 lines and owns orchestration plus substantial presentation logic, increasing regression and review cost. | Record as maintainability debt; extract only around tested 18B-18D changes. |
| Native ownership | `src-tauri/src/lib.rs` is 1,734 lines and combines menus, HTTP, proxy, multipart, project, response, and recent-project behavior. | Extract bounded HTTP/persistence modules only when remediation tests justify it. |
| Schema validation | `src/project/projectSchema.ts` is only 97 lines and validates containers before casting nested untrusted state to `RelayProject`. | 18C/18D blocker. |
| Redaction cohesion | `src/lib/redaction.ts`, saved-response redaction, project export, and diagnostics use related but non-identical classifiers. | Centralize in 18C. |
| Test quality | Service logic has strong focused coverage and negative-path tests; missing tests align directly with the validated boundary defects. | Add failing regression tests per remediation, then preserve the 90% gates. |
| Review-tool truthfulness | Secret and OOXML tools report passes without enumerating all skipped content. | Make skips explicit in 18E. |

Large-file extraction is not a standalone Sprint 18A remediation. It should occur only where a failing regression test and the smallest safe fix establish a clear module boundary; this keeps security changes reviewable.

## Important Failure Modes Considered

- A malicious project hides a local path, but the operator must still open the project and explicitly send or open the affected item.
- A remote service controls redirects, responses, or flow mappings, but initial requests and imports remain explicit developer actions.
- Availability findings affect a single local process with restart/recovery available, so none is rated high.
- CI findings require a compromised or retagged action/dependency; read-only repository permission does not prevent outbound secret disclosure.
- Browser development fallback has CORS and no native multipart file authority; desktop-native paths remain the relevant security boundary.
- Traditional hosted-service SQL injection, CSRF, tenant authorization, password reset, and server-side rate limiting are not applicable because Relay Studio has no backend, accounts, tenants, or database.

## Remediation Sequence

1. **18B — Network and import boundary hardening:** establish explicit redirect/final-destination identity and credential stripping first because flow, importer, proxy, and general requests depend on the native transport contract.
2. **18C — Local file, persistence, and redaction safety:** rearm persisted file authority and make canonical redaction the single persistence/output control.
3. **18D — Execution integrity and resource bounds:** correct edge semantics and impose coordinated limits after the transport and persistence contracts are stable.
4. **18E — Delivery hardening and final readiness:** narrow CI secret scope, make scanner coverage truthful, then run the complete coverage, security, live, interactive, and packaging evidence loop.

The detailed per-instance owner, severity, file evidence, sprint, and retest condition are in [Remediation Register](remediation-register.md).

## Sprint 18A Verification

| Gate | Result |
| --- | --- |
| Focused closure tests | 82/82 passed across OpenAPI import, request construction, saved responses, response persistence, comparison, flows, project schema, and release-gate configuration. |
| Full TypeScript suite and coverage | 242 passed, 1 unconfigured live-REST suite skipped; 95.94% statements, 90.72% branches, 98.17% functions, and 97.13% lines. |
| Type, lint, and production build | Passed; Vite retained its existing chunk-size/dynamic-import advisory. |
| Playwright regression | 56/56 passed across Chromium and WebKit. |
| Rust tests and Clippy | 27/27 passed; Clippy passed with warnings denied. |
| Rust coverage | 92.07% lines, above the 90% gate. |
| Dependency and license gates | npm audit found 0 vulnerabilities; npm licenses and cargo-deny advisories, bans, licenses, and sources passed. Existing duplicate-crate warnings remain informational. |
| Secret and documentation checks | Repository/generated-artifact secret scan passed; all 6 Word, 15 Visio, and traceability artifacts validated. |
| Word visual inspection | All 6 Sprint Portfolio pages rendered and inspected with no clipping, overlap, or unreadable content. |

Sprint 18A changes only review and authoritative documentation, so no new product behavior is presented as interactively verified. Native and browser interactive verification remains mandatory for every behavior-changing remediation in Sprints 18B-18D.

## Readiness Assessment

Relay Studio has a strong local-first foundation, meaningful automated coverage, explicit operation selection, useful persistence recovery, and a narrowly scoped desktop shell. It is ready to enter remediation, not ready to close the Sprint 18 program. Sprints 18B and 18C must close every high finding before Sprint 18E can issue a final readiness decision.
