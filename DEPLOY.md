# Deploying to Cloudflare Pages

`npm run build` uses the Nitro **`cloudflare-pages`** preset and produces a
ready-to-serve `./dist` (prerendered HTML + hashed assets + a `_worker.js`
fallback).

## Recommended — connect the Git repo (push to deploy)

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
pick `jviddy/OrlandoPlanner`, then:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Nuxt (or "None") |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(repo root)* |

Environment variables (Production **and** Preview):

| Name | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `22` | matches `.nvmrc` |
| `NPM_CONFIG_LEGACY_PEER_DEPS` | `true` | mirrors `.npmrc`; avoids the npm 11 peer-resolver crash |

Every push to `main` then builds and deploys; pull requests get preview URLs.
`.github/workflows/build.yml` runs the same `npm ci && npm run build` as a
status check on every push/PR.

## Alternative — Wrangler from your machine

```bash
wrangler login
wrangler pages project create orlando-planner --production-branch=main   # first time
npm run deploy        # build + wrangler pages deploy dist --project-name=orlando-planner
```

## Notes

- Every route is prerendered, so the deploy is effectively static with a tiny
  worker fallback. All trip data is client-side (`localStorage`) — nothing to
  configure server-side.
- `wrangler.toml` carries `compatibility_date` and the `nodejs_compat` flag; if
  you build through the dashboard, mirror the flag under
  **Settings → Functions → Compatibility flags** for both environments.
- Rollbacks: each deployment is versioned in the Pages dashboard.
