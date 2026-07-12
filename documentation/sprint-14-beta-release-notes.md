# Relay Studio 0.1.0 Beta Release Notes

## Beta Scope

Relay Studio is a local-first desktop workspace for designing REST requests, composing flows, running controlled API tests, saving response artifacts, and exporting redacted diagnostics. This beta packages the same project format and execution behavior for macOS, Windows, and Linux.

## Included

- Native macOS `.dmg`, Windows NSIS `.exe` and `.msi`, and Linux `.deb` and `.AppImage` packages.
- Native project open/save, recent projects, recovery backups, atomic writes, and concurrent-save protection.
- REST request and multi-step flow runners with retry, cancellation, mappings, assertions, and cleanup behavior.
- Saved response artifacts and structured redacted diagnostics export.
- Release-blocking TypeScript and Rust coverage, lint, dependency audit, license, advisory, and secret-scanning gates.

## Known Limitations

- Internal beta installers are unsigned. macOS Gatekeeper, Windows SmartScreen, and Linux package policy may show an unverified-publisher warning. Do not distribute these builds as a production release.
- Live REST acceptance requires local credentials and endpoints and is not embedded in an installer.
- Platform acceptance is recorded separately for each native OS; an artifact is not approved solely because its build completed.
- Automatic updates are disabled for this beta. Install a newer beta manually.
- Project secrets are redacted from persistence and diagnostics. Keep service credentials in approved local-only configuration.

## Stakeholder Review

Review the platform validation record, known limitations, signing deferrals, and Sprint 13 release-gate evidence before approving broader beta distribution. Report the operating system, artifact filename, exact reproduction steps, and redacted logs for any issue.
