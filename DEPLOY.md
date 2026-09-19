# Deploying to Cloudflare Pages

This project uses **Git-integrated Cloudflare Pages** deployment. Pushing to
`main` triggers a build and deploy; pull requests get preview deployments
automatically.

`npm run build` uses the Nitro **`cloudflare-pages`** preset and produces a
ready-to-serve `./dist` (prerendered HTML + hashed assets + a `_worker.js`
fallback). The Git-connected Pages build runs the same command.

## Why we are migrating

The existing `orlando-planner` Pages project is a **Direct Upload** project.
Direct Upload Pages projects cannot be converted to Git-integrated projects, so
we need to create a new Git-integrated project, configure it, and cut over
safely. The old project stays available as a rollback target until the new one is
verified.

A second reason for migrating: the current Direct Upload project is not serving
the Nitro worker bundle correctly. All `/api/**` routes on recent deploys return
Nitro `404 Cannot find any path matching`. The same build works locally with
`wrangler pages dev`. A Git-integrated Pages project in advanced mode is the
supported way to run the Nuxt/Nitro worker on Cloudflare Pages.

## Current environment values (record before changing anything)

| Item | Value |
| --- | --- |
| Old production URL | `https://orlando-planner.pages.dev` |
| Old project name | `orlando-planner` |
| Production D1 | `orlando-planner-production` (`8235120f-1820-455a-8b9b-92ca36f16817`) |
| Preview D1 | `orlando-planner-preview` (`7e917655-43fe-48b7-a28e-3f76ca26ca68`) |
| Repo | `https://github.com/jviddy/OrlandoPlanner` |
| Production branch | `main` |

## Step 1 — Create the new Git-integrated Pages project

This step must be done in the Cloudflare dashboard. It cannot be done via the
Wrangler CLI.

1. Open Cloudflare dashboard → **Workers & Pages**.
2. Click **Create** → **Pages** → **Connect to Git**.
3. Authorize Cloudflare's GitHub app if prompted.
4. Select your repo: `jviddy/OrlandoPlanner`.
5. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | `Nuxt` (or `None` if `Nuxt` is not listed) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(repo root)* |

6. Save. Cloudflare will start the first build.

## Step 2 — Set build environment variables

Go to the new project's **Settings → Environment variables** and add these to
**both Production and Preview**:

| Name | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `22` | matches `.nvmrc` |
| `NPM_CONFIG_LEGACY_PEER_DEPS` | `true` | mirrors `.npmrc`; avoids the npm 11 peer-resolver crash |

## Step 3 — Add the D1 database binding

Go to the new project's **Settings → Functions → D1 database bindings** and add:

| Environment | Binding name | Database |
| --- | --- | --- |
| Production | `ORLANDO_DB` | `orlando-planner-production` |
| Preview | `ORLANDO_DB` | `orlando-planner-preview` |

The migration files in `migrations/` are already in the repo, so the
Git-connected build will pick them up through `wrangler.toml`.

## Step 4 — Set compatibility flags

Go to the new project's **Settings → Functions → Compatibility flags** for both
environments and add:

```text
nodejs_compat
```

This mirrors the flag in `wrangler.toml`.

## Step 5 — Add runtime secrets

Go to the new project's **Settings → Environment variables → Encrypt** for each
environment and add:

| Name | Notes |
| --- | --- |
| `NUXT_AUTH_ENABLED` | `true` |
| `NUXT_PUBLIC_GOOGLE_ENABLED` | `true` |
| `NUXT_GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `NUXT_GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `NUXT_APP_BASE_URL` | the exact new environment URL, e.g. `https://<new-project>.pages.dev` |
| `NUXT_ANONYMOUS_CAPABILITY_SECRET` | strong random string, different per environment |
| `NUXT_RESEND_API_KEY` | if using Resend for magic links |
| `NUXT_AUTH_EMAIL_FROM` | e.g. `auth@yourdomain.com` |
| `NUXT_AUTH_RATE_LIMIT_SECRET` | strong random string, different per environment |

Never commit secret values to the repository.

## Step 6 — Update Google OAuth redirect URIs

In **Google Cloud Console → APIs & Services → Credentials → OAuth client**:

1. Add the new Production callback:
   `https://<new-production-domain>/api/auth/google/callback`
2. Add the new Preview callback:
   `https://<new-preview-domain>/api/auth/google/callback`
3. Keep the old callback URLs until the cutover is complete.

## Step 7 — Tell the agent the new project details

Once the first dashboard build finishes, reply with:

- New Pages project name
- New production URL
- New preview URL
- Whether the first build succeeded or failed

The agent will then:

- Verify the Nitro worker is active (`wrangler pages deployment tail`)
- Confirm `/api/auth/session` returns an application response, not a Nitro 404
- Confirm `/api/auth/google/start` redirects to Google
- Apply/verify D1 migrations on the new project
- Walk through the full Google OAuth sign-in flow
- Update `BACKEND_PROGRESS.md` and the migration checklist

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
- `wrangler.toml` carries `compatibility_date` and the `nodejs_compat`
  compatibility flag; mirror the flag under **Settings → Functions →
  Compatibility flags** for both environments when configuring through the
  dashboard.
- Rollbacks: each deployment is versioned in the Pages dashboard. Keep the old
  `orlando-planner` project available until the new Git-integrated project is
  fully verified.

## Legacy direct upload (emergency only)

`npm run deploy:legacy` builds and uploads directly to the old
`orlando-planner` Direct Upload project. This is intended only as a temporary
fallback during the Git migration; do not use it for routine deployments.

For the full migration checklist, see
[`docs/cloudflare-pages-git-worker-migration.md`](docs/cloudflare-pages-git-worker-migration.md).
