# Sprint 19 REST Code Examples Closure

Status: Completed July 26, 2026.

## Demonstrated Workflow

1. Open a REST request or flow tab.
2. Right-click the tab and choose **Generate Code**.
3. Choose HTTP, cURL, C#, Java, jQuery, Node.js, PHP, Python, or Ruby.
4. Review the generated local, read-only example in the popup, change language if useful, and choose **Copy Code**.
5. For a flow, retain dependency order and implement the displayed branch prerequisites and response-mapping guidance in the target application.

## Delivered Behavior

- Request examples derive from the same typed validation and executable-request construction used by Relay Studio execution.
- Flow examples are dependency ordered, use unique step variables, identify success/failure prerequisites, and identify response mappings. Java and jQuery output execute supported JSONPath captures and reuse mapped values in later requests. Java output identifies its Jackson Databind dependency and credential-mask substitution requirement, then rejects non-2xx, empty, malformed JSON, missing, null, or non-scalar mapping responses without echoing response bodies.
- JSON, text, URL-encoded, and multipart text/file bodies are represented across all nine generators.
- GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS remain available through the shared request model.
- The popup supports language changes, selection/manual copy, a Copy Code action, clipboard success/failure feedback, focus containment, Escape, and close controls.
- Generation does not send a request, read a multipart file, persist output, alter the project dirty state, or change request/flow execution state.

## Safety And Resource Bounds

- Secret environment variables, authorization values, sensitive headers/query values, URL userinfo, and sensitive JSON/form keys become safe placeholders or `<REDACTED>`.
- Multipart paths become `<SELECT_FILE_FOR_FIELD>` placeholders; generation never reads file contents or displays the configured local path.
- A post-generation credential-canary check stops output if a known sensitive literal remains.
- A request or complete flow example is limited to 256 KiB, and a flow is limited to 100 requests.
- Invalid requests, invalid/cyclic flows, unsupported language identifiers, and excessive output fail with typed, actionable, redacted errors.

## Verification Evidence

- Failing-first service tests established the absent generator module, redaction behavior, request/flow ordering, and resource failures before implementation.
- Golden snapshots cover all nine languages; the service matrix covers methods, JSON, text, URL-encoded bodies, mixed multipart fields, auth profiles, redaction, invalid requests/flows, unsupported languages, and limits.
- The complete TypeScript run passed 330 tests with one unconfigured live REST test skipped. Coverage was 95.71% statements, 90.05% branches, 98.68% functions, and 96.98% lines.
- The complete Rust suite passed 37 tests; Sprint 19 did not change the native command layer or Tauri capabilities.
- All 58 Playwright workflows passed across Chromium and WebKit, including request and flow context menus, output, dependency order, mapping guidance, and credential absence.
- Interactive browser verification exercised cURL, C#, Python, request/flow selection, copy success, menu placement near the viewport edge, project-state stability, and runtime logs. No unexplained browser error or credential disclosure was observed.
- All 60 pages across the five changed authoritative Word manuals were rendered and visually inspected without clipping, overlap, broken lists, missing glyphs, or header/footer defects.

## Known Limits

- Generated code is a starting example, not a promise that every target dependency/runtime is installed or that every response shape matches an API at runtime.
- Flow output documents dependency order, branch prerequisites, and JSONPath mappings. Java and jQuery output perform response extraction and mapped-value reuse; developers must still implement application-specific conditional control flow before executing a branched flow example. Other generators retain mapping guidance for manual adaptation.
- jQuery multipart output intentionally references a browser file input rather than a local path. Other multipart generators use explicit file-selection placeholders.
- Code examples are not persisted in `.restproj`; regenerate them from the source request or flow after edits.

## Readiness Decision

Sprint 19 meets its product acceptance criteria. The feature is local-first, bounded, typed, redacted, test-covered, browser-verified, and compatible with existing project files because it introduces no schema or persistence change. Packaging was not changed, so installer reconstruction was not required for this increment.
