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

Implemented. See `sprint-1-ux-blueprint.md`, `product-terminology-glossary.md`, `sample-test-project-definition.md`, `secret-redaction-policy.md`, and `sprint-2-acceptance-checklist.md`.

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

Implemented. See `sprint-2-implementation-status.md`.

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

Implemented. See `sprint-3-implementation-status.md`.

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

Implemented. See `sprint-4-implementation-status.md`.

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

Implemented. See `sprint-5-implementation-status.md`.

### Goals

- Execute individual REST calls and display reliable diagnostics.

### Build Scope

- Run selected service.
- Console events for resolve variables, open connection, send request, response received, parse response, success, and error.
- Response status, timing, headers, pretty JSON, raw body, and error panel.

### Live REST Acceptance Scope

- Health check.
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

Implemented. See `sprint-6-implementation-status.md`.

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

Implemented. See `sprint-7-implementation-status.md`.

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

Implemented. See `sprint-7a-implementation-status.md`.

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

Implemented. See `sprint-8-implementation-status.md`.

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

Implemented. See `sprint-8a-implementation-status.md`.

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

Implemented. See `sprint-8b-implementation-status.md`.

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
- Refreshed macOS audit.
- Bounded Windows audit.

### Testing Scope

- Dialog, view-toggle, dirty-state, and context-menu regression coverage.
- Human QA for native menus, title bar, breakpoints, and platform-specific keyboard flows.

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

### Testing Scope

- Install and launch on each platform.
- Encrypted project open/save on each platform.
- Saved response file handling on each platform.
- Single request runner on each platform.
- Flow runner on each platform.
- Save-on-close prompt on each platform.

## Default Implementation Stack

- Tauri desktop shell.
- React and TypeScript frontend.
- Rust Tauri command layer for local file IO and HTTP execution.
- React Flow for workflow canvas.
- Monaco or CodeMirror for request and response editors.
- Zod for schema validation.
- JSONPath library for response extraction.
- Vitest, Testing Library, Playwright, Rust unit tests, dependency audit tools, and secret scanning.
