# Deploying to Cloudflare Pages

Deployments are **Git-integrated**. Pushing to `main` triggers a Cloudflare Pages
build and deploy; pull requests receive preview deployments automatically.

`npm run build` uses the Nitro **`cloudflare-pages`** preset and produces a
ready-to-serve `./dist` (prerendered HTML + hashed assets + a `_worker.js`
fallback). The Git-connected Pages build runs the same command.

## Connect the Git repo

The existing `orlando-planner` Pages project is a **Direct Upload** project and
cannot be converted to Git-integrated in place. Follow
[`docs/cloudflare-pages-git-worker-migration.md`](docs/cloudflare-pages-git-worker-migration.md)
to create a new Git-integrated Pages project and cut over safely.

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

## Local build / preview

```bash
npm ci
npm run build      # produces ./dist
npm run preview    # local Nitro preview server
npm run cf:preview # build + wrangler pages dev dist
```

## Notes

- Public pages are prerendered, but `/api/**` must run in the Nitro worker. The
  Cloudflare Pages project must be in **advanced mode** (Git-integrated with the
  Nuxt/`cloudflare-pages` preset). Direct Upload projects do not activate the
  Nitro worker bundle, so auth/API routes will return Nitro 404s.
- Verify the deployed Pages project has Functions enabled:
  `wrangler pages deployment tail <deployment-id> --project-name=<project-name>`
  should attach to a Functions deployment. If it reports “does not have a Pages
  Function”, the project is serving only static assets; switch to Git-integrated
  advanced mode before testing auth.
- `wrangler.toml` carries `compatibility_date` and the `nodejs_compat`
  compatibility flag; mirror the flag under **Settings → Functions →
  Compatibility flags** for both environments when configuring through the
  dashboard.
- Rollbacks: each deployment is versioned in the Pages dashboard.

## Legacy direct upload (emergency only)

`npm run deploy:legacy` builds and uploads directly to the old
`orlando-planner` Direct Upload project. This is intended only as a temporary
fallback during the Git migration; do not use it for routine deployments.
