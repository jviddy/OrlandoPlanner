# Deploying to Cloudflare Pages

The app builds with the Nitro **`cloudflare-pages`** preset (set in
`nuxt.config.ts`). `npm run build` produces a ready-to-upload `./dist` directory
containing the prerendered HTML, hashed assets and a `_worker.js` fallback.

## Option A — direct upload with Wrangler (fastest)

```bash
npm install
npm run deploy
```

`deploy` runs `nuxt build` then
`wrangler pages deploy dist --project-name=orlando-planner`.

First run only: authenticate and create the project.

```bash
wrangler login
wrangler pages project create orlando-planner --production-branch=main
```

Preview the exact production bundle locally before shipping:

```bash
npm run cf:preview      # build + `wrangler pages dev dist`
```

## Option B — connect the Git repo (CI builds)

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to
Git**, pick the repo, then set:

| Setting | Value |
| --- | --- |
| Framework preset | Nuxt (or "None") |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(repo root)* |

Environment variables:

| Name | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `22` | matches `.nvmrc`; Nuxt 4 needs ≥ 20.19 |
| `NPM_CONFIG_LEGACY_PEER_DEPS` | `true` | mirrors `.npmrc`; avoids the npm 11 peer-resolver crash |

`compatibility_date` and the `nodejs_compat` flag are already in
`wrangler.toml`. If you build through the dashboard instead of Wrangler, set the
same compatibility flag under **Settings → Functions → Compatibility flags**
for both production and preview.

## Notes

- **SSR vs static:** every route is prerendered, so the deploy is effectively a
  static site with a tiny worker fallback. All trip data is client-side
  (`localStorage`), so there is nothing to configure server-side.
- **Custom domain:** add it under the Pages project's **Custom domains** tab;
  no app changes needed.
- **Cache:** `public/_headers` gives hashed `/_nuxt/*` assets a one-year
  immutable cache and sets basic security headers.
- **Rollbacks:** every `wrangler pages deploy` / push is a versioned
  deployment in the Pages dashboard — roll back there with one click.
