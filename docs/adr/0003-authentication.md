# ADR 0003: authentication and email delivery

Status: accepted for the first account slice, 18 September 2026.

## Decisions

- Implement the small passwordless flow in-repo rather than adopting a general
  authentication framework. The application needs magic links, opaque D1
  sessions, revocation, and a later OAuth identity table; it does not need
  password or JWT machinery.
- Magic links are one-use and expire after 15 minutes. The token is placed in a
  URL fragment and exchanged by the browser with a POST request, so it is not
  sent in the initial request URL or referrer.
- Session tokens are random, stored only as SHA-256 hashes, delivered in an
  HttpOnly / Secure / SameSite=Lax cookie, and expire after 30 days.
- Resend is the production transactional-email transport, called over HTTPS.
  A development-only captured-link response is available behind a separate
  private flag for local and controlled-preview testing.
- Google OAuth can be added as another `auth_identities` provider after the
  magic-link/session/claim path is proven. It is not required for Phase 1.

## Consequences

The code owns session and token lifecycle explicitly and must retain focused
security tests. Production account enablement requires a verified sender domain,
Resend API key, app base URL, and the development link flag disabled.
