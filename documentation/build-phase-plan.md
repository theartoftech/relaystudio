# Relay Studio Build Phase Plan

## Purpose

This plan defines the build-out for Relay Studio, a cross-platform desktop REST client aimed at engineers and product managers who need to test REST services, save projects, inspect responses, and chain calls without relying on a Postman license.

The first implementation deliverable is a reviewable UX package. Product implementation should not start until the mockups and test matrix are reviewed.

## Product Principles

- Local-first desktop app for macOS, Windows, and Linux.
- No remote database and no hosted service dependency.
- Visual target is **Concept 3: Developer IDE Console**, refined by Sprint 7A into an IDE-style desktop API workbench with a single project explorer, tabbed editor, optional contextual inspector, and tabbed bottom utility dock.
- Enterprise workbench discipline applies: dense layouts, clear grouping, explicit empty states, and actionable validation.
- Dallas Cowboys-inspired palette: navy, royal blue, silver, white, cool gray, with red reserved for errors.
- Console-first execution transparency: every REST call and flow step must explain what happened.
- Live REST acceptance should run against a configurable external API target. The target is a validation fixture, not product identity.

## Phase 0: UX Intent And Mockup Review

### Deliverables

- Static full-app mockup set.
- Selected visual target document.
- Screen inventory and navigation model.
- Live REST acceptance matrix.
- Build sprint breakdown.

### Mocked Screens

- Project start and recent projects.
- OpenAPI/Swagger import from a URL.
- Main project workbench.
- REST service collection editor.
- Auth/security settings.
- Headers, query params, path params, and body panels.
- Single request runner.
- Response viewer.
- Saved responses browser.
- Visual flow builder.
- Flow variable mapping panel.
- Execution console.
- Settings/preferences.
- Validation and error states.
- Save-on-close prompt.

### Acceptance Criteria

- Engineers can see how to configure and run REST calls quickly.
- Product managers can understand the workspace and flow chaining without documentation.
- OpenAPI/Swagger import is clearly represented as the preferred way to preload services from a documented API.
- Error and save-state behavior are visible in the mockups.
- The visual design is enterprise-grade and distinct from generic web-dashboard layouts.
- The final UI direction must match Concept 3's desktop IDE feel, not a generic web-dashboard layout.

## Sprint 1: UX Blueprint And Test Strategy

### Status

Implemented. See `sprint-1-ux-blueprint.md`, `product-terminology-glossary.md`, `sample-test-project-definition.md`, `secret-redaction-policy.md`, and the Sprint Portfolio.

### Goals

- Finalize screen hierarchy, terminology, and workflow intent.
- Review static mockups.
- Confirm live REST acceptance scenarios and test data assumptions.

### Build Scope

- Static mockup refinements.
- Lock Concept 3 as the visual target for implementation.
- Product terminology glossary.
- OpenAPI/Swagger import workflow definition for the future app.
- Sample test project definition for acceptance testing once implementation begins.
- Explicit pass/fail criteria for live-service testing.

### Testing Scope

- Review every mockup against target workflows.
- Validate that OpenAPI/Swagger import has a planned UX path for URL entry, discovered service preview, selection, and project preload.
- Validate that all live REST acceptance scenarios are covered by at least one planned service or flow.
- Confirm secret redaction expectations in console, response viewer, saved responses, and exported files.

## Sprint 2: Desktop Foundation

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Establish the cross-platform shell and quality gates.

### Build Scope

- Scaffold Tauri, React, TypeScript, and Rust command layer.
- Add app shell, routing, menu structure, theme tokens, and window close intercept.
- Add test harnesses for TypeScript, React, Rust, and Playwright.

### Testing Scope

- App launches locally on macOS.
- Empty shell renders each primary route.
- CI runs type checks, lint checks, unit tests, and coverage reporting.
- Baseline accessibility smoke test covers keyboard navigation through the shell.

## Sprint 3: Project Files And Encryption

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Provide reliable local persistence.

### Build Scope

- Create, open, save, save as, recent projects.
- Encrypted local `.restproj` file format.
- Dirty-state tracking.
- Save-on-close prompt with Save, Do Not Save, and Cancel.

### Testing Scope

- Project round trip.
- Unsupported project schema.
- Corrupted project file.
- Missing file.
- Permission denied.
- Save-as overwrite prompt.
- Unsaved close prompt behavior.

## Sprint 4: REST Service Designer

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Let users define reusable REST calls.

### Build Scope

- Service list/detail editor.
- HTTP method, URL, timeout, retry policy.
- Headers, query params, path params, request body.
- Auth modes: none, bearer token, API key, basic auth, OAuth client credentials, custom header.
- Environment variables.
- OpenAPI/Swagger import design placeholder: URL entry, fetch, parse, preview discovered endpoints, select endpoints, and create service definitions.

### Testing Scope

- Request construction for each method and parameter type.
- Auth injection for every supported auth mode.
- Secret redaction in UI state, logs, errors, and saved project files.
- Validation for invalid URL, duplicate headers, malformed JSON, missing auth data, and unsupported methods.

## Sprint 4A: OpenAPI / Swagger Import

### Goals

- Preload REST service definitions from published API documentation.

### Build Scope

- Add import wizard for OpenAPI 3.x and Swagger 2.0 documents.
- Support import from URL and local JSON/YAML file.
- Parse servers/base URLs, paths, methods, parameters, request bodies, auth schemes, tags, descriptions, and example payloads.
- Show a preview of discovered services before adding them to the project.
- Let users choose all endpoints, selected tags, or selected operations.
- Generate service names from operation id, method/path, or tag grouping.

### Testing Scope

- Valid OpenAPI 3 JSON.
- Valid OpenAPI 3 YAML.
- Valid Swagger 2 JSON/YAML.
- Invalid spec.
- Unreachable URL.
- Spec with multiple servers.
- Spec with bearer, basic, API key, and OAuth security schemes.
- Duplicate operation names.
- Import cancellation leaves project unchanged.

## Sprint 5: Single Request Runner

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Execute individual REST calls and display reliable diagnostics.

### Build Scope

- Run selected service.
- Console events for resolve variables, open connection, send request, response received, parse response, success, and error.
- Response status, timing, headers, pretty JSON, raw body, and error panel.

### Live REST Acceptance Scope

- Optional unauthenticated public probe with a target-defined expected status.
- Login.
- Current user.
- List records.
- Get record.
- Search records.
- Create or update record.

### Testing Scope

- Successful authenticated REST request.
- Failed login.
- Missing bearer token.
- 401 and 403 display.
- Timeout display.
- Malformed JSON display.
- Console event order.

## Sprint 6: Saved Responses

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Persist response evidence for later review.

### Build Scope

- Save JSON responses as structured artifact files.
- Save non-JSON responses as redacted raw body files.
- Save response metadata in project.
- Saved response browser.
- Reload saved response into viewer.

### Testing Scope

- Save JSON response.
- Save non-JSON response with clear warning.
- Overwrite prompt.
- Invalid path.
- Read-only destination.
- Large response handling.
- Saved response metadata survives project reopen.

## Sprint 7: Visual Flow Builder

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Model chained REST call workflows visually.

### Build Scope

- Visual canvas.
- REST call nodes.
- Dependency links.
- Success and failure paths.
- Step execution ordering.
- Flow-level console stream.

### Live REST Acceptance Flow

1. Login to the configured external REST target.
2. Extract bearer token.
3. Load current user.
4. Load a collection.
5. Load a selected record by extracted identifier.

### Testing Scope

- Node ordering.
- Blocked execution when required dependency is missing.
- Success path.
- Failure path.
- Console events grouped by flow and step.

## Sprint 7A: UX Consolidation

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Reduce workbench clutter while preserving desktop IDE capability.

### Build Scope

- Remove the permanent activity rail.
- Make the project explorer the single primary navigation surface.
- Replace the dense global top command bar with a compact contextual toolbar.
- Collapse the inspector by default.
- Merge response, console, and problems into one tabbed utility dock.
- Add resizable workspace dividers for explorer, workbench, inspector, bottom dock, and flow details.
- Fix controlled flow-node dragging so selected nodes remain attached to the pointer during drag.

### Testing Scope

- Shell anatomy tests for the simplified layout.
- Inspector open and close behavior.
- Pane resize behavior.
- Flow-node drag behavior.
- Command palette access for global commands.
- Regression checks for request editing, flow editing, and saved response access.

## Sprint 8: Flow Variables And Mapping

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Pass data from one REST response into later REST calls.

### Build Scope

- JSONPath extraction.
- Variables panel.
- Header, query, path, and body injection.
- Mapping validation before execution.

### Live REST Acceptance Flow

1. Login.
2. Create a test record.
3. Extract the created record identifier.
4. Update the record.
5. Reopen the record.
6. Delete cleanup record.

### Testing Scope

- Valid JSONPath mapping.
- Missing JSONPath result.
- Malformed JSONPath expression.
- Missing variable reference.
- Failed upstream node blocks dependent node.
- Cleanup deletion always runs when configured.

## Sprint 8A: Flow UX Hardening

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Make flows straightforward enough that users can understand, author, and debug chained REST workflows without reading documentation.
- Treat flow authoring as Relay Studio's primary differentiator, not a secondary tool.

### Build Scope

- Simplify mapping setup for common token and identifier capture.
- Show captured variables and consuming steps clearly without duplicating unrelated request details.
- Improve flow empty states, step details, dependency labels, run statuses, and cleanup-step treatment.
- Add starter templates for common flows: authenticated read and create/read/cleanup.
- Improve diagnostics for failed mappings, skipped dependencies, and cleanup behavior.

### Testing Scope

- First-time user can create a simple authenticated flow.
- Login response can capture a token and feed an authenticated request with minimal configuration.
- Create response can capture an identifier and feed read/update/delete steps.
- Mapping failures identify source step, JSONPath, and variable name.
- Flow UI avoids duplicate information on the same work screen unless it improves confidence or prevents errors.
- Coverage remains above 90%.

## Sprint 8B: Desktop Density Pass

### Status

Implemented. See the Sprint Portfolio for the delivery summary.

### Goals

- Increase usable request and flow workspace by reducing excess chrome, oversized text, and oversized controls.
- Move Relay Studio closer to native desktop workbench density while keeping the current simplified UX direction.

### Build Scope

- Use native-first UI fonts for macOS, Windows, and Linux.
- Use native monospace fonts for URL, body, response, and console surfaces.
- Add reusable density tokens for font sizes, control heights, tab heights, tree rows, panel padding, and dock sizes.
- Tighten top command bar, explorer, tab strip, request composer, service detail form, flow toolbar, flow nodes, inspector, and bottom response dock.
- Reduce default explorer, inspector, and bottom dock footprint while preserving resize behavior.
- Preserve accessibility, keyboard navigation, tooltips, and readable code/JSON output.

### Testing Scope

- Visual density regression at 1180x820 and 1440x900.
- Explorer, inspector, and Recent Projects do not clip or overlap at compact widths.
- Request composer and flow toolbar controls remain reachable and readable.
- Flow canvas has measurably more usable space.
- Response and JSON panels remain readable.
- Coverage remains above 90%.

## Sprint 9A: Platform Shell Contract

### Goals

- Define the shared shell contract and separate shared workbench content from platform-specific chrome behavior.

### Build Scope

- Shared command IDs, shortcuts, enablement rules, and dirty-state routes.
- Native macOS menu structure for document actions and view toggles.
- Windows title bar and command ownership contract.

### Testing Scope

- Command visibility by editor type.
- Dirty-state routing for save, close, and project switch.
- Menu and title-bar design review against platform guidance.

## Sprint 9B: Platform Navigation And Command Surfaces

### Goals

- Simplify navigation, reduce duplicated context, and put commands on the right surfaces.

### Build Scope

- Explorer cleanup.
- State-aware toolbar actions.
- Inspector/details deduplication.
- macOS sidebar cleanup.
- Windows command-surface alignment.

### Testing Scope

- Explorer no longer mixes navigation, status, and recent-project switching.
- Request and flow tabs show only relevant primary actions.
- Inspector and flow details no longer compete for the same information.

## Sprint 10A: Platform Chrome, Layout, And Writing

### Goals

- Make the shell feel native on macOS and Windows and replace placeholder desktop text.

### Build Scope

- Production-quality settings and error copy.
- Dialog behavior standards.
- App-defined context menus.
- macOS `View` toggles.
- Windows title bar, breakpoint, dark-mode, and high-contrast support.

### Testing Scope

- Dialog focus and Escape behavior.
- Windows breakpoint behavior at small, medium, and large widths.
- High-contrast and active/inactive window states.
- Placeholder copy removed from desktop surfaces.

## Sprint 10B: Platform Verification And Audit Closure

### Goals

- Add repeatable platform verification and close or track platform-guideline findings.

### Build Scope

- Platform-shell regression coverage.
- macOS shell QA script.
- Windows shell QA script.
- Windows installer build handoff script for pulling this branch onto a Windows machine and producing testable `.exe` or `.msi` artifacts.
- Refreshed macOS audit.
- Bounded Windows audit.

### Testing Scope

- Dialog, view-toggle, dirty-state, and context-menu regression coverage.
- Windows machine validation starts from `tools/windows-build-installer.ps1`, which runs dependency install, shared verification, Rust tests, and Tauri packaging before manual QA.
- Human QA for native menus, title bar, breakpoints, and platform-specific keyboard flows.

### Implementation Status

- Shared regression coverage and macOS QA/audit refresh are complete.
- Windows build handoff, QA script, bounded audit, and evidence checklist are complete.
- Sprint 10B is closed after packaged Windows testing and follow-up fixes. Additional Windows breakpoint and high-contrast screenshots move to Sprint 11 release-gate evidence hardening.

## Sprint 11: Role And Error Coverage

### Goals

- Prove enterprise security and error behavior against real role gates in a configured external REST target.

### Live REST Acceptance Scope

- Standard user can read permitted APIs.
- Standard user cannot access admin settings.
- Restricted user can read permitted APIs.
- Restricted user cannot modify protected resources.
- Admin user can access admin, audit, read, write, and lifecycle APIs.

### Testing Scope

- 400 invalid payload.
- 401 unauthenticated.
- 403 unauthorized.
- 404 missing resource.
- 5xx-style response body display using a controlled stub.
- Network failure.
- TLS/certificate failure.
- Secrets never appear in console or exported artifacts.

## Sprint 12: Enterprise Hardening

### Goals

- Raise reliability to enterprise expectations.

### Build Scope

- Typed error model.
- Project recovery backup.
- Import/export validation.
- Redaction audit.
- Structured diagnostics bundle.
- Cancellation for long-running requests.

### Testing Scope

- Interrupted execution.
- Cancelled flow.
- Invalid project schema.
- Project backup restore.
- Concurrent save guard.
- Request retry behavior.
- Redaction snapshot tests.

## Sprint 13: Coverage And Security Gate

### Goals

- Enforce quality as a release requirement.

### Quality Gates

- 90% code coverage minimum.
- TypeScript type check.
- React unit/component tests.
- Rust unit tests.
- Playwright UI tests.
- Live REST API acceptance tests.
- Dependency audits.
- Static analysis.
- Secret scanning.
- Tauri security checklist.

### Acceptance Criteria

- CI fails below coverage threshold.
- CI fails on high-risk security finding.
- Configured live REST acceptance suite passes.
- No unhandled exceptions in normal or negative-path tests.

## Sprint 14: Cross-Platform Packaging And Beta

### Goals

- Produce installable beta builds.

### Build Scope

- macOS package.
- Windows package.
- Linux package.
- Platform-specific filesystem and file-dialog validation.
- Packaged Relay Studio helper/help file integrated with the native Help menu.
- Regenerated macOS and Windows installers after helper/help integration.

### Testing Scope

- Install and launch on each platform.
- Encrypted project open/save on each platform.
- Saved response file handling on each platform.
- Single request runner on each platform.
- Flow runner on each platform.
- Save-on-close prompt on each platform.
- Offline helper/help file opens from the native Help menu on macOS and Windows.
- Rebuilt macOS and Windows installers contain the helper/help file and pass packaged regression checks.

## Sprint 15: Documentation, UML, And Knowledge Transfer

### Goals

- Create a curated Word documentation library for development, debugging, product handoff, testing, and release operations.
- Model Relay Studio through all 14 UML diagram types in editable Visio format.
- Preserve authoritative Markdown directives while retiring obsolete sprint-specific documentation.

### Documentation Scope

- Developer onboarding and debugging guide.
- Technical architecture and product handoff.
- Word UML guide plus individual Visio diagrams and a master atlas.
- Consolidated sprint portfolio and current test/QA manual.
- Security, platform, packaging, and release manual.
- Documentation traceability and obsolete-script cleanup.

### Non-Goals

- One-for-one Word conversion of obsolete testing scripts.
- Product feature development other than correctness fixes discovered during documentation validation.

## Sprint 16: Developer Productivity And Import Hardening

### Goals

- Improve the workflows used in day-to-day API development.
- Continue learning and validating AI-driven software development practices.
- Keep unsigned personal-use builds reproducible without paid platform verification.

### Implemented Scope

- Bounded same-origin external OpenAPI reference resolution with explicit unsafe-graph failures.
- Safe composed/format schema examples with credential placeholders.
- PATCH, HEAD, OPTIONS, URL-encoded forms, and text-only multipart forms across model, UI, persistence, importer, and transport.
- Two-artifact redacted saved-response comparison for metadata, JSON paths, and raw lines.
- Import review metrics and redacted diagnostic request inventory.
- Direct Add and Save from OpenAPI review so confirmed endpoints can be persisted immediately as a local `.restproj` project.
- Body-panel clipping fix discovered during live developer workflow verification.

### Remaining Deferrals

- Cross-origin reference opt-in or allowlisting.
- Binary and file-path multipart upload.
- TRACE and CONNECT methods.
- Additional beta defects not yet reproduced through personal use.

### Non-Goals

- Paid Apple or Microsoft signing/readiness programs.
- Commercial store distribution or enterprise certification.

## Sprint 17: Native Multipart File Workflows

### Goals

- Make imported multipart APIs usable for everyday developer file-upload workflows.
- Keep file access explicit, local, bounded, and native-only.
- Preserve existing `.restproj` compatibility and explicit OpenAPI operation selection.

### Implemented Scope

- Optional text/file kind and per-file media type on persisted form fields.
- Safe OpenAPI binary-property mapping to empty file fields without imported local paths.
- Mixed text/file multipart construction in the TypeScript request pipeline and Rust native transport.
- Native local-file validation with a 25 MiB per-file limit, generated boundaries, and exact filename/media-type transmission.
- Explicit browser-development guidance for local-file requests.
- Unit, Playwright, persistence, and native wire coverage for the daily import-edit-save-reopen-send workflow.

### Compatibility And Security

- Optional field metadata preserves text-only form rows in existing projects.
- Project files retain local paths, not file contents; enabled files are read only at send time.
- URL-encoded file fields, empty or invalid paths, directories, oversized files, malformed parts, and manual multipart `Content-Type` headers fail actionably.
- Credentials and local example paths remain excluded from imported definitions.
- Tauri capabilities and CSP are unchanged.

### Remaining Deferrals

- Raw `application/octet-stream` and other binary request bodies.
- Cross-origin external-reference opt-in or allowlisting.
- File chooser and drag-and-drop affordances, streaming bodies, and configurable upload limits.
- TRACE and CONNECT methods.

### Non-Goals

- Commercial signing, notarization, store submission, hosted collaboration, or backend persistence.

## Sprint 18A: Review Baseline And Finding Validation

Status: Completed July 20, 2026. The frozen review found no critical issue and validated 26 independently addressable instances: 10 high, 14 medium, and 2 low. The authoritative evidence is the [Sprint 18A review report](reviews/sprint-18a/review-report.md) and [remediation register](reviews/sprint-18a/remediation-register.md).

### Goals

- Freeze a reproducible review target and complete separate code, architecture, and security reviews.
- Validate every retained candidate from source to user impact before assigning severity or remediation scope.
- Publish a redacted finding register and dependency-aware remediation decision for Sprints 18B-18E.

### Exit Criteria

- The reviewed commit, tools, environments, source coverage, exclusions, trust boundaries, and limitations are recorded.
- Every retained candidate is confirmed, rejected, or explicitly marked unvalidated; confirmed findings have evidence, severity, affected boundary, owner, target sprint, and retest condition.
- Architecture deviations and code-quality defects are reconciled with the documented design rather than inferred from scanner output.
- Review evidence contains no credentials, local acceptance configuration, sensitive response bodies, or unsafe proof-of-concept data.

### Completion Evidence

- Duplicate discovery output was consolidated into stable per-instance rows; no additional repository-wide scan is required for this increment.
- Five exact paths have direct synthetic/loopback reproductions and the remaining paths have complete source/control/sink traces plus focused test evidence.
- The dependency-ordered queue assigns network/import work to 18B, local-file/persistence/redaction work to 18C, execution/resource work to 18D, and CI/artifact evidence work to 18E.
- Focused closure verification passed 82 tests across the affected TypeScript service and gate-contract surfaces.

## Sprint 18B: Network And Import Boundary Hardening

Status: Completed July 20, 2026. RS18A-012, RS18A-013, RS18A-015, RS18A-020, RS18A-021, and RS18A-026 are fixed and verified. The native client follows only same-origin redirects, reports final response identity, applies validated proxy bypass rules, and returns actionable redirect failures. Swagger UI secondary definitions require a visible explicit Load action; OpenAPI final origins are revalidated; credential-bearing import URLs are rejected before display or retrieval; and flow mappings cannot write `baseUrl`.

### Goals

- Prevent credentials and imported content from crossing an unreviewed redirect or secondary-document origin.
- Make native HTTP redirect behavior explicit and return enough response identity for callers to enforce origin policy.
- Validate proxy bypass behavior and Swagger UI secondary-destination review.

### Exit Criteria

- Cross-origin redirects never forward Authorization, cookies, API keys, or configured custom credential headers.
- External OpenAPI references revalidate the final response origin; a redirect outside the allowed origin fails with an actionable typed error.
- Swagger UI `url` and `configUrl` discovery exposes the resolved destination before loading it, and proxy bypass behavior matches its documented contract.
- Unit, Rust loopback, component, and meaningful interactive tests cover same-origin success, cross-origin rejection, redirect loops, malformed locations, and redacted errors.

### Completion Evidence

- Failing-first TypeScript and Rust regressions cover secondary-destination cancellation, credential-bearing URLs, external-reference final-origin changes, protected `baseUrl`, same-origin redirects, cross-origin rejection before header replay, missing locations, redirect limits, final identity, proxy bypass receivers, and malformed bypass entries.
- The representative suites passed with 248 TypeScript tests, 33 Rust tests, and 56 Playwright tests across Chromium and WebKit; the live REST suite remained explicitly skipped when not configured.
- The current unsigned macOS application bundle rebuilt successfully; CSP, Tauri capabilities, project schema, and installer inputs were unchanged.

## Sprint 18C: Local File, Persistence, And Redaction Safety

Status: Completed July 20, 2026. Eight assigned findings are closed. Persisted multipart paths are removed on save and any in-memory legacy path requires an exact path plus destination-origin approval for the current session. Saved responses use self-describing validated envelopes for both `.json` and `.txt`, nested schema-v1 project state is validated before use, missing legacy schema-v1 settings receive typed current defaults, credential-shaped response mappings are forced secret, and canonical redaction now covers URLs, values, project rows, form fields, artifacts, diagnostics, comparisons, and normalized errors.

### Goals

- Require an explicit current-session decision before a persisted multipart path can read and upload a local file.
- Apply canonical redaction to response bodies, URLs, metadata, artifacts, project state, diagnostics, and errors.
- Strengthen project and saved-response file boundaries without breaking compatible projects.

### Exit Criteria

- Reopened or imported multipart file fields are unarmed until the user reselects or explicitly approves the file and destination for the current session.
- URL userinfo and sensitive query values are redacted before saved-response metadata or project persistence.
- Common API-key spellings are redacted case-insensitively, and an artifact is marked redacted only after canonical redaction succeeds.
- Arbitrary saved-response paths and malformed nested project state are rejected or safely migrated with actionable guidance.
- Persistence/reload, redaction canaries, local-file negative paths, and the complete user workflow have automated and interactive coverage.

### Completion Evidence

- Failing-first tests cover approval binding and invalidation, missing/disabled files, credential-shaped mappings, userinfo and API-key query canaries, malformed nested project paths, project save/reload, imported artifacts, arbitrary `.txt` files, and response-path mismatches.
- The representative suites passed with 263 TypeScript tests (one protected live suite skipped), 34 Rust tests, and 56 Playwright tests across Chromium and WebKit.
- TypeScript coverage passed at 95.62% statements, 90.05% branches, 98.34% functions, and 97.13% lines; the current unsigned macOS application bundle rebuilt successfully.
- Browser interactive verification confirmed readable approval states, destination invalidation, blocked unapproved sends, and clean runtime logs. Packaged native verification exercises the same UI plus Rust artifact and multipart boundaries.

## Sprint 18D: Execution Integrity And Resource Bounds

Status: Completed July 21, 2026. RS18A-002, RS18A-009, RS18A-016, RS18A-018, RS18A-022, and RS18A-023 are fixed and verified. Native and browser response bodies, project reads, OpenAPI documents/graphs, and saved-response comparisons fail early at documented byte/node/depth/breadth/output limits; flow success/failure edges follow predecessor outcomes; and flow runtime captures are excluded from persistable project environments.

### Goals

- Prevent response mappings or captured values from silently changing later credential destinations or persisting runtime secrets.
- Correct flow branch semantics and place explicit bounds on imported documents and response comparisons.
- Preserve useful developer workflows while failing early and actionably on excessive or malformed input.

### Exit Criteria

- Flow mappings cannot change a credentialed request origin without an explicit reviewed policy, and secret captures do not enter persistable project state.
- Success and failure edges execute only under their documented predecessor outcomes.
- OpenAPI graphs and response comparisons enforce documented byte, document, depth, breadth, and diff-output limits.
- Boundary-limit, cycle, malformed-input, secret-persistence, branch, cancellation, and interactive regression tests pass without reducing coverage.

## Sprint 18E: Delivery Hardening And Final Readiness Review

Status: Completed July 24, 2026. See the [Sprint 18E closure report](reviews/sprint-18e/closure-report.md) and updated [remediation register](reviews/sprint-18a/remediation-register.md). Protected live-test configuration is scoped to materialization/preflight steps, first-party checkout/artifact actions are pinned, secret scanning reports supported/unsupported artifact counts and detects modern lockfile canaries, and the documentation validator checks all OOXML text and relationship parts.

### Goals

- Minimize CI secret exposure and make secret-scanning coverage and exclusions explicit.
- Strengthen installer, dependency-lockfile, and OOXML inspection where current gates have blind spots.
- Re-run the complete quality, security, interactive, live, and packaged-platform evidence loop and publish the final decision.

### Exit Criteria

- Protected live-test configuration exists only in the exact step that requires it, and security-sensitive actions use immutable revisions where practical.
- Modern token formats, unpacked installer contents, and relevant OOXML parts and relationships are scanned; skipped or unsupported content is reported as a limitation, not a pass.
- No unresolved critical or high finding remains; lower-severity deferrals record impact, rationale, owner, milestone, and retest trigger.
- TypeScript service and Rust native coverage remain at least 90 percent, and all applicable type, lint, test, build, dependency, license, secret, Clippy, cargo-deny, live REST, interactive, and package gates pass.
- The threat model, architecture documentation, redacted review report, remediation register, and final readiness decision match the verified implementation.

## Sprint 19: REST Code Examples

Status: Completed July 26, 2026. See the [Sprint 19 closure report](reviews/sprint-19/closure-report.md). Request and flow tabs now expose Generate Code language submenus and a local, read-only popup for HTTP, cURL, C#, Java, jQuery, Node.js, PHP, Python, and Ruby.

### Goals

- Add a Generate Code action to request and flow tab context menus with generators for raw HTTP, cURL, C#, Java, jQuery, Node.js, PHP, Python, and Ruby.
- Derive output from the typed request model shared with execution, including method, URL/query/path encoding, headers, JSON/text/form bodies, and multipart metadata.
- Replace credentials and sensitive values with safe placeholders and represent local files without reading or persisting their contents.
- Preserve flow dependency order and emit visible branch-prerequisite and response-mapping guidance; Java and jQuery examples capture JSONPath mappings into flow variables and reuse them in later requests without claiming to generate application-specific branch orchestration. Java examples identify their Jackson Databind dependency and credential-mask substitution requirement, then reject non-2xx, empty, malformed JSON, missing, null, or non-scalar mapping responses with step-specific errors that do not echo response bodies.

### Exit Criteria

- Golden fixtures and service tests cover all nine generators and representative JSON, text, URL-encoded, and multipart requests.
- Generated examples are deterministic, bounded, read-only, and never send a request or mutate project state.
- Invalid or unsupported request combinations produce typed, actionable, redacted errors rather than silent fallbacks.
- Playwright coverage verifies generator selection, output refresh, copy behavior, validation recovery, and secret/file-path safety.
- Architecture, security, QA, and sprint portfolio documentation describe the implemented behavior and its limits.

### Program Non-Goals

- New product features unrelated to a validated finding.
- Paid penetration testing, compliance certification, commercial signing, notarization, marketplace submission, hosted persistence, or collaboration.
- Large architectural rewrites without separate approval and migration planning.

## Default Implementation Stack

- Tauri desktop shell.
- React and TypeScript frontend.
- Rust Tauri command layer for local file IO and HTTP execution.
- React Flow for workflow canvas.
- Monaco or CodeMirror for request and response editors.
- Zod for schema validation.
- JSONPath library for response extraction.
- Vitest, Testing Library, Playwright, Rust unit tests, dependency audit tools, and secret scanning.
