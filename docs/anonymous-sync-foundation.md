# Anonymous sync foundation

Anonymous server persistence is implemented behind `anonymousSyncEnabled`, which defaults to `false` on both server and client. The shipped UI does not upload local trips. When enabled, Trip settings shows an explicit upload choice, manual sync status, failure recovery wording, and capability revocation.

Separate `orlando-planner-preview` and `orlando-planner-production` D1 databases were provisioned in WEUR on 18 September 2026. Migration `0001_anonymous_trips.sql` was applied and the four application tables were verified in both environments. `wrangler.toml` binds preview/local and production separately as `ORLANDO_DB`.

The spike has now been evolved into the canonical trip foundation. Migration
`0002_canonical_trips.sql` moves lifecycle/revision data into `trips`, moves
view/edit credentials into `trip_capabilities`, and adds versioned idempotency,
activity, and rate-limit tables while retaining the old endpoint paths as a
compatibility adapter. Only SHA-256 token hashes are stored. Idempotent token
re-derivation records a key version so a short previous-key window can support
secret rotation safely.

The API now uses the same strict persisted-payload contract as the client,
rejects transient/unknown fields, refreshes anonymous expiry for 180 days after
each successful write, returns structured revision conflicts, records create /
update / revoke revisions, and opportunistically purges expired data. The UI
correctly describes its locally stored credentials as opaque rather than
encrypted and shows the inactivity expiry when the server supplies it.

Operational verification completed on 18 September 2026:

- Applied the forward migration to a disposable local D1 database, executed the rollback, and verified
  that no `anonymous_%` application tables remained.
- Ran the built Cloudflare Pages Worker against disposable local D1 data. Create, idempotent retry,
  unauthorised read, separate view/edit capabilities, revision conflict, update, revoke, and post-revoke
  read all returned the expected results.
- Repeated that lifecycle after migration 0002 against the canonical tables and
  verified the `create`, `update`, and `revoke` revision trail plus capability
  revocation in D1.

Before enabling it in any environment:

1. Set `NUXT_ANONYMOUS_CAPABILITY_SECRET` to a long, environment-specific secret and enable both private
   and public flags only for a controlled preview.
2. Apply migration 0002 and repeat the lifecycle check against that preview
   binding. The current local Wrangler login cannot access the configured
   account, so this remote check remains pending.
3. Review retention, support and incident procedures before enabling production.

The binding and prepared-statement approach follows the current [Cloudflare Pages binding guide](https://developers.cloudflare.com/pages/functions/bindings/), [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/), and [D1 migrations guide](https://developers.cloudflare.com/d1/reference/migrations/), checked on 18 September 2026.
