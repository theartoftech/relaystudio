# Secret Redaction Policy

## Purpose

Relay Studio must make request execution transparent without exposing credentials. This policy defines what counts as secret, where secrets may appear, and how redaction must be tested.

## Secret Values

The following are always secret:

- Passwords.
- Bearer tokens.
- Refresh tokens.
- API keys.
- OAuth client secrets.
- Basic auth passwords.
- Authorization header values.
- Cookie values that contain session or auth data.
- Variables marked as secret.
- Vault values.
- Private keys and certificates.

The following are not secret by default but can become secret when marked by the user:

- Usernames.
- Tenant identifiers.
- Base URLs.
- Product IDs.
- Record identifiers.
- Non-auth response IDs.

## Allowed Secret Display

Secret values may only be visible in active credential entry controls where the user intentionally reveals or edits the value.

Required controls:

- Masked by default.
- Explicit reveal action.
- Reveal is temporary.
- Copy action is explicit.
- Revealed secret is never captured in logs or diagnostics.

## Required Redaction Surfaces

| Surface | Requirement |
| --- | --- |
| Console dock | Never print secret values |
| Response viewer | Redact secret response fields when mapped or classified as secret |
| Saved response metadata | Never include project credentials |
| Saved response body | Preserve server response by default, but redact known auth fields when saving from auth flows unless user explicitly exports raw with warning |
| Project file | Encrypt secret values and never store plaintext |
| Diagnostics bundle | Redact secrets by default |
| Error messages | Include context without secret values |
| Request preview | Show generated secret headers as masked |
| Headers tab | Mask secret header values |
| Variables inspector | Mask secret variables and vault values |
| Flow mapping panel | Show secret mapping names, not values |
| Test output | Fail if secret-like values appear |

## Redaction Format

Use stable, readable redaction markers:

| Value Type | Display |
| --- | --- |
| Bearer token | `Bearer ********` |
| Password | `********` |
| API key | `********` |
| Client secret | `********` |
| Secret variable | `{{secret:name}}` or masked value in UI |
| Authorization header | `Authorization: ********` |

Partial token previews are not allowed in console, project files, diagnostics, saved metadata, or exported logs. UI credential controls may show a short suffix only after explicit reveal or copy confirmation.

## Redaction Classification

Inputs must be classified as secret when:

- The field type is a known auth field.
- The header name is `Authorization`, `Proxy-Authorization`, `Cookie`, or `Set-Cookie`.
- The variable is stored in Vault.
- The variable is explicitly marked secret.
- The JSON field name matches common auth names such as `token`, `accessToken`, `refreshToken`, `password`, `clientSecret`, `apiKey`, or `secret`.
- The auth mode generates the value.

## Test Requirements

### Unit Tests

- Redaction utility masks known header names.
- Redaction utility masks secret variable values.
- Redaction utility masks known JSON auth field names.
- Project serializer never emits plaintext secrets.
- Diagnostics serializer never emits plaintext secrets.

### Component Tests

- Auth panel masks generated headers.
- Variables inspector masks vault values.
- Console masks auth events.
- Saved response metadata view masks credentials.
- Error panel masks auth values in failed requests.

### Playwright Tests

- Execute login and verify token never appears in visible console text.
- Save project after login and verify token is not in serialized project output through test hooks.
- Export diagnostics and verify known secret values are absent.
- Save response from auth flow and verify policy behavior for auth fields.

### Live REST Tests

- Capture known runtime token from login.
- Assert token does not appear in console events, saved project state, diagnostics, or exported logs.
- Assert failed auth states do not include submitted password.

## Release Gate

Any confirmed secret leak is release-blocking. A release can proceed only after the leak is fixed, covered by regression tests, and verified in the relevant test category.
