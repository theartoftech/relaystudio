# Sprint 18C Closure Report

Date: July 20, 2026
Scope: Local File, Persistence, and Redaction Safety
Finding register: [Sprint 18A remediation register](../sprint-18a/remediation-register.md)

## Outcome

Sprint 18C closes RS18A-001, RS18A-007, RS18A-008, RS18A-014, RS18A-017, RS18A-019, RS18A-024, and RS18A-025. No Tauri capability, CSP, hosted service, database, or project schema-version change was introduced.

## Implemented Controls

- Project export clears every multipart file path. A legacy or imported in-memory path cannot send until the user approves its exact service, field, path, and destination origin for the current application session. Path, field, service, origin, project, or session changes invalidate authority.
- Saved `.json` and `.txt` responses are self-describing Relay artifacts. Readers reject arbitrary/legacy raw text, malformed envelopes, and embedded paths that do not match approved project metadata, with explicit recovery guidance.
- Shared redaction normalizes credential names across case, underscore, and hyphen variants; removes URL userinfo; masks sensitive query values; and sanitizes raw text, JSON, project rows, form fields, response metadata, diagnostics, comparisons, and normalized errors.
- Response values captured from credential-shaped JSON paths or into credential-shaped variable names become secret even when a mapping is mislabeled.
- Schema-v1 validation now checks nested services, environments, flows, response metadata, import sources, settings, proxy state, rows, auth profiles, and body definitions before casting, and reports the exact failing path plus recovery guidance. Missing settings from older schema-v1 files are migrated to current defaults; explicitly malformed values remain errors.

## Compatibility And Recovery

- Valid schema-v1 `.restproj` files remain compatible. Older files that contain only the original settings fields receive current defaults for settings introduced later, and zero retry attempts remain valid.
- Persisted multipart file paths are deliberately removed on the next save. The developer must re-enter or reselect the path and approve its destination in each session.
- Legacy raw `.txt` response files are not wrapped from caller-supplied metadata. Relay Studio instructs the developer to re-send the request and save a new response artifact.
- Existing self-describing `.json` response artifacts continue to reopen when their embedded path matches project metadata.

## Verification Evidence

- 264 TypeScript tests passed; the protected live REST suite remained explicitly skipped when not configured.
- Coverage passed: 95.66% statements, 90.19% branches, 98.34% functions, and 97.14% lines.
- 34 Rust tests passed serially, including controlled native HTTP, exact multipart bytes, arbitrary-text rejection, and response-path mismatch cases.
- 56 Playwright tests passed across Chromium and WebKit, including save/reopen path removal, disabled approval without a path, unapproved-send blocking, exact-origin invalidation, approval restoration, and the browser file-send boundary.
- Interactive browser control confirmed readable disabled/approved states at desktop density, origin-change invalidation, actionable status text, and no browser error/warning logs.
- The unsigned macOS application bundle rebuilt at `src-tauri/target/release/bundle/macos/Relay Studio.app` without capability or CSP changes.

## Failure Modes Exercised

- Empty, disabled, missing, changed, or wrong-service multipart fields.
- Relative, non-HTTP(S), or changed-origin destinations.
- Credential URL userinfo and sensitive query keys.
- `apiKey`, `api_key`, `api-key`, `x-api-key`, and case variants in JSON and raw text.
- Imported artifacts that claim `redacted: true` while retaining canaries.
- Arbitrary `.txt` files, malformed envelopes, unsupported extensions, and mismatched artifact paths.
- Malformed nested arrays, rows, retry state, body state, flows, mappings, response metadata, import sources, settings, and proxy state.

## Follow-On

Sprint 18D remains responsible for execution semantics and resource bounds. Sprint 18E remains responsible for CI/artifact hardening and the final readiness decision.
