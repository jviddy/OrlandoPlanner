# ADR 0002: capability links and anonymous retention

Status: accepted for the controlled preview, 18 September 2026.

## Decisions

- Anonymous view and edit tokens are different capabilities. The bare trip ID
  grants no access.
- Share URLs put the secret in the URL fragment. Browser code sends it to the
  API in an Authorization header, avoiding normal server logs and referrers.
- Capabilities are opaque, not encrypted. Anonymous capability storage on the
  creating device is exposed to the same XSS risk as other local browser data.
- Anonymous trips expire 180 days after the latest successful write. Successful
  writes refresh both the trip and its active capabilities.
- Soft-deleted anonymous trips are eligible for hard deletion after 30 days.
- Capability derivation records a key version. Rotation retains previous keys
  only for the idempotency replay window.

## Consequences

Anonymous storage is useful as an optional cross-device/server copy, but is not
an appropriate home for confirmation numbers or other sensitive booking data.
The UI must warn before expiry and must always preserve its local recovery copy.
