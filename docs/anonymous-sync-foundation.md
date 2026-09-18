# Anonymous sync foundation

Anonymous server persistence is implemented behind `anonymousSyncEnabled`, which defaults to `false` on both server and client. The shipped UI does not upload local trips.

The spike contains a local and HTTP repository contract, a D1 migration, capability-protected create/fetch/update endpoints, idempotent creation, optimistic revisions, validation, and a write activity record. Edit and view capabilities are separate. Only SHA-256 token hashes are stored in the trip row; idempotent token re-derivation requires the server-only HMAC secret.

Before enabling it in any environment:

1. Create separate preview and production D1 databases and bind the selected database as `ORLANDO_DB`.
2. Apply `migrations/0001_anonymous_trips.sql` and test rollback on disposable data.
3. Set `NUXT_ANONYMOUS_CAPABILITY_SECRET` to a long, environment-specific secret and `NUXT_ANONYMOUS_SYNC_ENABLED=true` only on the server.
4. Add rate limits, payload-size limits at the edge, expiry/revocation operations, and automated unauthorised read/write tests.
5. Add an explicit upload choice in the UI. Keep the local repository copy after every attempted sync and never clear it from a partial response.

The binding and prepared-statement approach follows the current [Cloudflare Pages binding guide](https://developers.cloudflare.com/pages/functions/bindings/), [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/), and [D1 migrations guide](https://developers.cloudflare.com/d1/reference/migrations/), checked on 18 September 2026.
