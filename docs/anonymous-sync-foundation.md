# Anonymous sync foundation

Anonymous server persistence is implemented behind `anonymousSyncEnabled`, which defaults to `false` on both server and client. The shipped UI does not upload local trips. When enabled, Trip settings shows an explicit upload choice, manual sync status, failure recovery wording, and capability revocation.

Separate `orlando-planner-preview` and `orlando-planner-production` D1 databases were provisioned in WEUR on 18 September 2026. Migration `0001_anonymous_trips.sql` was applied and the four application tables were verified in both environments. `wrangler.toml` binds preview/local and production separately as `ORLANDO_DB`.

The spike contains a local and HTTP repository contract, a D1 migration, capability-protected create/fetch/update endpoints, idempotent creation, optimistic revisions, validation, and a write activity record. Edit and view capabilities are separate. Only SHA-256 token hashes are stored in the trip row; idempotent token re-derivation requires the server-only HMAC secret.

Operational verification completed on 18 September 2026:

- Applied the forward migration to a disposable local D1 database, executed the rollback, and verified
  that no `anonymous_%` application tables remained.
- Ran the built Cloudflare Pages Worker against disposable local D1 data. Create, idempotent retry,
  unauthorised read, separate view/edit capabilities, revision conflict, update, revoke, and post-revoke
  read all returned the expected results.

Before enabling it in any environment:

1. Set `NUXT_ANONYMOUS_CAPABILITY_SECRET` to a long, environment-specific secret and enable both private
   and public flags only for a controlled preview.
2. Repeat the lifecycle check against that preview binding.
3. Review retention, support and incident procedures before enabling production.

The binding and prepared-statement approach follows the current [Cloudflare Pages binding guide](https://developers.cloudflare.com/pages/functions/bindings/), [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/), and [D1 migrations guide](https://developers.cloudflare.com/d1/reference/migrations/), checked on 18 September 2026.
