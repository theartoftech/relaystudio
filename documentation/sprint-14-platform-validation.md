# Sprint 14 Platform Validation

## Purpose

This record tracks the native installer and UI acceptance required for Relay Studio beta builds. A platform passes only after its CI artifact is installed and exercised on that operating system; a successful cross-compile alone is not acceptance evidence.

## Build Matrix

| Platform | Runner | Required installer | Signing | Current validation |
| --- | --- | --- | --- | --- |
| macOS | `macos-latest` | `.dmg` | Signing and notarization deferred for the internal beta | Local package and UI validation required |
| Windows | `windows-latest` | NSIS `.exe` and `.msi` | Authenticode signing deferred for the internal beta | Native artifact install and UI validation required |
| Linux | `ubuntu-22.04` | `.deb` and `.AppImage` | Package signing deferred for the internal beta | Native artifact install and UI validation required |

The `Package Beta` GitHub Actions workflow runs frontend verification and Rust tests on every platform before building. Missing installers fail artifact upload. Artifacts expire after 14 days and must not contain project files, credentials, or local test data.

## Native UI Acceptance Record

Record the OS version, commit, artifact filename, tester, date, and `Pass`, `Fail`, or `Deferred` for each row.

| Test | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Installer opens and Relay Studio launches | Pass (local DMG, 2026-07-12) | Pending | Pending |
| Native Open and Save dialogs are usable | Pending | Pending | Pending |
| Create, save, close, and reopen `.restproj` project | Pending | Pending | Pending |
| Saved response writes, reloads, and protects overwrite | Pending | Pending | Pending |
| Single request runs against a controlled local endpoint | Pending | Pending | Pending |
| Flow runs against controlled local endpoints | Pending | Pending | Pending |
| Dirty close offers Save, Do Not Save, and Cancel | Pending | Pending | Pending |
| Default project directory uses the platform Documents folder | Pending | Pending | Pending |
| Permission failure is visible and actionable | Pending | Pending | Pending |
| Runtime logs contain no unhandled exception or secret | Pending | Pending | Pending |
| Packaged helper/help file opens from the native Help menu without network access | Pass (rebuilt local DMG, 2026-07-12) | Pending regenerated installer | Not yet validated |

## Validation Procedure

1. Download the installer produced from the exact commit under test and verify its filename and size are non-empty.
2. Install or mount it using the platform-native flow, then launch Relay Studio without a development server.
3. Create a project and save it through the native dialog. Confirm the default location is the user's Documents directory and the file ends in `.restproj`.
4. Close and reopen the project. Edit it, request OS-level close, and exercise Cancel, Save, and Do Not Save separately.
5. Run one request and one multi-step flow against a controlled local HTTP endpoint. Confirm response status, body, console entries, and flow summary.
6. Save a response, reopen it, and verify an existing file requires an explicit overwrite decision.
7. Attempt a project or response save in a read-only or otherwise denied directory. Confirm the permission failure names the failed operation and does not claim success.
8. Inspect the application window and runtime logs for blank screens, CSP failures, unhandled exceptions, filesystem path leakage, or secrets.
9. Disconnect from the network, open the native Help menu, and open the packaged helper/help file. Confirm it is the current bundled content and does not depend on a development path or external website.

For Windows, continue using `documentation/sprint-10b-3-windows-qa-script.md` for the broader packaged regression. For macOS, also run `documentation/sprint-10b-2-macos-qa-script.md`.

## Developer-Beta Pass Rule

Sprint 14 passes when every required installer is built on its native GitHub runner after automated quality gates, artifact contents are inspected, and the locally available platform completes interactive packaged-app QA. Paid Apple notarization, Microsoft Authenticode, commercial readiness certification, and public-store distribution are not required. Pending Windows/Linux hands-on rows remain recommended personal-use smoke checks rather than sprint blockers.

## Current Evidence

- On 2026-07-12, `Relay Studio_0.1.0_aarch64.dmg` was built locally, checksum-verified by `hdiutil`, mounted, and launched directly from the disk image.
- The packaged app reopened an existing project, filtered the command palette, and opened the production Settings workspace under `tauri://localhost`.
- No application exception or CSP violation was observed. macOS logged WebKit child-process denials for system pasteboard, network settings, and audio services; the exercised Relay Studio UI was unaffected.
- The remaining macOS workflow rows and all Windows/Linux rows require native installer QA and remain explicitly pending.
- The macOS DMG was rebuilt after helper/help integration. The native Help menu opened the bundled Help workspace directly from the mounted installer with no application exception, CSP violation, network navigation, or development path.
- Windows NSIS and MSI installers were regenerated successfully by the native Windows packaging runner; hands-on Help-menu validation remains a recommended personal-use smoke check.

## Final Artifact Record

GitHub Actions run: `29202639086`

Tag: `v0.1.0-beta.1`

Commit: `16f7a90840568cc65e16d171ed18709c8db33f44`

| Platform artifact ZIP | SHA-256 | Inspected contents |
| --- | --- | --- |
| `relay-studio-windows-beta` | `deb9d47f618a11fe8858b1a41c4b8fc32c8e467b37d4ba1c4f16688b44bfd1dd` | NSIS `.exe`, MSI `.msi` |
| `relay-studio-linux-beta` | `712b0a412b2d5a96835d348a33c8acfef01ed8268b9a658ecad8523e5d3f85a8` | `.deb`, `.AppImage` |
| `relay-studio-macos-beta` | `c1dbbdf7bab12829351b2340e22d5ad9b59d6f87228e401c717a63c1cbee509f` | `.dmg` |

All three packaging jobs completed successfully and uploaded non-empty artifacts with the expected formats.
