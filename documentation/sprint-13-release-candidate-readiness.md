# Sprint 13 Release Candidate Readiness

Date: 2026-07-12
Candidate commit: working tree based on `b7cee6a`
Decision: Conditionally ready; live REST evidence and CI run are required before release approval

## Release Gates

| Gate | Requirement | Current evidence | Release status |
| --- | --- | --- | --- |
| TypeScript coverage | Statements, branches, functions, and lines each at least 90% | 96.26% statements, 92.28% branches, 98.30% functions, 97.05% lines | Ready |
| Rust coverage | Line coverage at least 90% | 90.71% measured lines; CI enforces `--fail-under-lines 90` | Ready |
| Static analysis | TypeScript type checking, ESLint, and Rust Clippy with warnings denied | All local checks pass | Ready |
| Unit and component tests | TypeScript and Rust tests pass | 210 TypeScript tests and 23 Rust tests pass; one unconfigured live suite is explicitly skipped | Ready |
| UI regression | Chromium and WebKit Playwright tests pass without unhandled errors | 42 tests pass; native CSP/capability smoke test and logs are clean | Ready |
| Dependency vulnerabilities | High-risk npm or Rust advisory finding blocks | npm reports zero vulnerabilities; cargo-deny advisories, bans, licenses, and sources pass | Ready with two scoped transitive exceptions below |
| License policy | npm and Rust dependency licenses match approved policy | 324 npm lock entries and the complete Rust graph pass | Ready |
| Secret scanning | Repository history, working content, and generated bundles contain no detected secret | Local scan passes 206 files and its negative canary test blocks as expected; Gitleaks is configured in CI | Ready pending remote history scan |
| Tauri boundary | CSP, capabilities, commands, filesystem, updater, and window permissions reviewed | See `documentation/tauri-security-checklist.md` | Ready with recorded residual risks |
| Live REST acceptance | Configured admin, standard, and restricted suite passes | CI consumes only the protected `RELAY_LIVE_REST_CONFIG_B64` secret; main/manual runs fail when absent | Blocked until configured run passes |

## Known Risks And Deferrals

Rust coverage excludes native Tauri command adapters, menu/window construction, recent-project home-directory I/O, and the binary entry point. Those paths require desktop integration coverage; pure validation, persistence, transport, proxy, schema, and response logic remain measured by the 90% unit threshold.

| Risk | Severity | Decision | Owner | Target |
| --- | --- | --- | --- | --- |
| Live REST credentials are intentionally local/CI-secret only, so this checkout cannot prove the external role gates without configuration | Release blocking | No approval until a configured CI or controlled local run passes | Release owner | Before release candidate approval |
| Windows packaged verification requires Windows 10/11 hardware | Medium | Continue using `documentation/sprint-10b-3-windows-qa-script.md` | Windows QA owner | Sprint 14 packaging |
| Tauri commands are bundled-code-only but not individually ACL-scoped | Low while remote content is disabled | Reassess before adding remote content, multiple privilege tiers, or new windows | Desktop security owner | Before relevant architecture change |
| CSP permits arbitrary HTTP(S) connections for user-selected REST targets | Product-required | Retain typed native request validation, redaction, and no remote script execution | Desktop security owner | Continuous review |
| `RUSTSEC-2026-0194` and `RUSTSEC-2026-0195` affect `quick-xml 0.39.x`, transitively pinned by Tauri `plist` | Low for Relay Studio's reachable paths | Scoped cargo-deny exceptions: Relay Studio does not parse user-controlled XML or use `NsReader`; upgrade when `plist` accepts `quick-xml >=0.41.0` | Desktop security owner | Recheck every dependency update and before Sprint 14 release |
| Updater is not enabled | Informational | Add signing and authenticated updater review with packaging | Release engineering | Sprint 14 |

## Approval Checklist

- [ ] GitHub Release Gates workflow passes on the exact candidate commit.
- [ ] Configured live REST acceptance job passes; a skipped test is not accepted as evidence.
- [ ] TypeScript and Rust coverage each meet their blocking threshold.
- [ ] Dependency, license, Clippy, ESLint, and secret gates pass.
- [ ] Sprint 12 enterprise-hardening human QA evidence is attached.
- [ ] Windows packaged regression is attached when Windows is in candidate scope.
- [ ] No unapproved high-risk finding or unhandled exception remains.
- [ ] Known risks and deferrals have named owners and targets.
