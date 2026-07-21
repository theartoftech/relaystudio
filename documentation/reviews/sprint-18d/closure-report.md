# Sprint 18D Closure Report

Date: July 21, 2026  
Scope: Execution Integrity And Resource Bounds  
Status: Complete

## Outcome

Sprint 18D closes RS18A-002, RS18A-009, RS18A-016, RS18A-018, RS18A-022, and RS18A-023. Execution state cannot silently widen a credential boundary, branch outcomes are explicit, and excessive response, project, import, or comparison inputs fail before expensive formatting, recursion, or IPC return.

## Implemented controls

- Flow success edges run only after successful predecessors; failure edges run only after failed predecessors; all incoming conditions must match. Cancellation and skipped/blocked predecessors do not accidentally activate a failure branch.
- Flow mappings still work inside a cloned runtime environment, but `handleRunFlow` no longer writes that runtime environment back into the project. Captured credentials therefore remain ephemeral and cannot enter `.restproj` state.
- Native and browser response bodies are capped at 5 MiB before formatting or IPC return. Browser Fetch checks declared length and streamed chunks; native Reqwest checks `Content-Length` and streamed chunks.
- Project save/open/backup restore, including the browser localStorage fallback, enforce a 4 MiB UTF-8/byte limit before parse or schema validation.
- OpenAPI root and external documents enforce 2 MiB per document, 10 MiB aggregate bytes, 20 external documents, 32 reference depth, 1,000-entry breadth, and 20,000 graph nodes. Same-origin, circular, malformed, and unreachable reference behavior remains explicit.
- Saved-response comparison enforces a 1 MiB body limit, 64 JSON levels, 20,000 JSON nodes, 10,000 raw lines, and 10,000 diff entries before recursive comparison or output amplification.
- Large-body redaction uses a fast no-sensitive-content path so boundary-sized safe responses remain responsive without weakening secret detection.

## Verification evidence

- Failing-first TypeScript tests cover branch truth tables, cancellation, runtime capture classification, browser/native response limits, OpenAPI bytes/breadth/nodes/depth, comparison bytes/depth/diff amplification, and browser project fallback limits.
- Targeted TypeScript suites passed: 50 flow/import/comparison tests, 28 service-runner tests plus browser body-limit coverage, and 12 project-persistence tests.
- Representative TypeScript suite passed: 275 tests passed, one protected live suite skipped; TypeScript coverage remained above thresholds at 95.35% statements, 90.04% branches, 98.41% functions, and 96.85% lines.
- The app was started at `http://127.0.0.1:5173/`; interactive inspection confirmed the flow builder, failure-path control, visible failure-path state, and clean startup/runtime surface.
- Rust suite passed with local loopback access: 37 tests passed, including fixed-length and chunked response-limit fixtures and oversized project-file rejection.
- Playwright browser suite passed across Chromium and WebKit: 56 tests passed, including OpenAPI review/save, saved-response comparison, multipart recovery, flow persistence, and shell regression workflows.

## Residual scope

Sprint 18E remains for delivery hardening, scanner/artifact evidence, and final readiness review. Sprint 18D does not add hosted persistence, automatic bulk import, credentials, or commercial signing/readiness work.
