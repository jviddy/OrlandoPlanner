# Cloudflare Pages Git/Worker Migration Checklist

## Why this is needed

The current `orlando-planner` Pages project is a **Direct Upload** project. The
Cloudflare account currently reports `Git Provider: No`. Direct Upload Pages
projects cannot later be converted to Git-integrated projects, so the safe
migration is to create a new Git-integrated Pages project, verify it, and only
then cut over traffic.

References:

- [Cloudflare Direct Upload limitations](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

## 0. Record the current state before changing anything

- [x] Confirm the repository is `https://github.com/jviddy/OrlandoPlanner`.
- [x] Confirm the production branch is `main`.
- [x] Confirm the current project is named `orlando-planner`.
- [x] Confirm the current project reports `Git Provider: No`.
- [x] Do not delete the current project yet; it is the rollback target.
- [x] Record the current production URL and any custom domains:
  - Production URL: `https://orlando-planner.pages.dev`
  - Custom domain(s): *(none known)*
- [x] Record the current D1 database IDs/bindings and Pages environment variables
      before recreating them in the new project:
  - Preview: `orlando-planner-preview` (`7e917655-43fe-48b7-a28e-3f76ca26ca68`)
  - Production: `orlando-planner-production` (`8235120f-1820-455a-8b9b-92ca36f16817`)

## 1. Prepare the repository

- [x] Confirm `nuxt.config.ts` uses Nitro's `cloudflare-pages` preset.
- [x] Confirm `wrangler.toml` contains `pages_build_output_dir = "dist"`.
- [x] Confirm `wrangler.toml` contains the `nodejs_compat` compatibility flag.
- [x] Run a clean-install check before connecting deployment:

  ```bash
  npm ci
  ```

- [x] `npm test` — 42 tests passed.
- [x] `npm run typecheck` — passed.
- [x] `npm run db:verify` — passed.
- [x] `npm run build` — passed and generated the Nitro worker bundle.
- [ ] Commit and push all backend/auth changes to the repository's `main` branch.

## 2. Create a new Git-integrated Pages project

Do this from **Cloudflare Dashboard → Workers & Pages → Create → Pages →
Connect to Git**. Use a temporary project name so the existing production
project remains available during verification, for example:
`orlando-planner-git`.

- [ ] Connect GitHub and authorize Cloudflare's GitHub application.
- [ ] Select `jviddy/OrlandoPlanner`.
- [ ] Set the production branch to `main`.
- [ ] Set the framework preset to **Nuxt** (or **None** if Nuxt is not listed).
- [ ] Set the root directory to the repository root.
- [ ] Set the build command to `npm run build`.
- [ ] Set the build output directory to `dist`.
- [ ] Enable preview deployments for the branch/PR workflow you want to use.
- [ ] Save the project and wait for its first build to complete.

Expected result: the new project shows a Git repository under **Settings →
Builds**, and the deployment is associated with a commit from `main` rather
than a manual Wrangler upload.

## 3. Recreate Cloudflare bindings and compatibility settings

- [ ] Add the `nodejs_compat` compatibility flag for Production and Preview.
- [ ] Add the D1 binding named `ORLANDO_DB`:
  - Production → `orlando-planner-production`
  - Preview → `orlando-planner-preview`
- [ ] Confirm the migration set is applied to each database:

  ```bash
  npx wrangler d1 migrations list orlando-planner-production --remote --env production
  npx wrangler d1 migrations list orlando-planner-preview --remote
  ```

- [ ] Add non-secret build variables in both environments:
  - `NODE_VERSION=22`
  - `NPM_CONFIG_LEGACY_PEER_DEPS=true`
- [ ] Confirm the Pages build is using the repository's `wrangler.toml`.

## 4. Add runtime variables and secrets

Set these separately for **Production** and **Preview**. Never commit values to
the repository.

- [ ] `NUXT_AUTH_ENABLED=true`
- [ ] `NUXT_PUBLIC_GOOGLE_ENABLED=true`
- [ ] `NUXT_GOOGLE_CLIENT_ID=<Google OAuth client ID>`
- [ ] `NUXT_GOOGLE_CLIENT_SECRET=<Google OAuth client secret>`
- [ ] `NUXT_APP_BASE_URL=<exact URL for that environment>`
- [ ] `NUXT_ANONYMOUS_CAPABILITY_SECRET=<environment-specific secret>`
- [ ] Configure any magic-link variables required by the current environment:
  `NUXT_RESEND_API_KEY`, `NUXT_AUTH_EMAIL_FROM`, and
  `NUXT_AUTH_RATE_LIMIT_SECRET`.
- [ ] Verify Preview and Production do not accidentally share environment-only
      secrets.

Recommended base URLs:

```text
Production: https://<new-production-domain>
Preview:    https://<new-preview-domain>
```

## 5. Update Google OAuth redirect URIs

In **Google Cloud Console → APIs & Services → Credentials → OAuth client**:

- [ ] Add the new Production callback:
      `https://<new-production-domain>/api/auth/google/callback`
- [ ] Add the new Preview callback:
      `https://<new-preview-domain>/api/auth/google/callback`
- [ ] Keep the existing callback URLs until the cutover is complete.
- [ ] Check that the OAuth consent screen/test-user configuration still allows
      the account used for testing.

## 6. Verify that the Nitro worker is active

- [ ] Open the new Pages deployment URL.
- [ ] Confirm the deployment is marked as Git-based, not Direct Upload.
- [ ] From the repository, identify the deployment ID and run:

  ```bash
  npx wrangler pages deployment list --project-name=<new-project-name>
  npx wrangler pages deployment tail <deployment-id> \
    --project-name=<new-project-name>
  ```

- [ ] Confirm `deployment tail` connects to a Functions deployment. If it says
      `does not have a Pages Function`, stop and fix the deployment mode before
      testing authentication.
- [ ] Check the OAuth start route:

  ```bash
  curl -i https://<new-production-domain>/api/auth/google/start
  ```

  Expected result: HTTP `302` with a `Location` header beginning with
  `https://accounts.google.com/o/oauth2/v2/auth`.

- [ ] Check the session route:

  ```bash
  curl -i https://<new-production-domain>/api/auth/session
  ```

  Expected result: an application response (normally `401` when no session is
  present), not a Nitro route `404`.

## 7. Test the complete sign-in flow

- [ ] Open the new production site in a private/incognito window.
- [ ] Click **Sign in with Google**.
- [ ] Confirm Google redirects to the callback URL without
      `redirect_uri_mismatch`.
- [ ] Confirm the callback creates a session and returns to the application.
- [ ] Confirm refresh keeps the session.
- [ ] Confirm logout clears the session.
- [ ] Confirm a second browser cannot use the first browser's session.

## 8. Cut over production safely

- [ ] Keep the old `orlando-planner` project running until the new project has
      passed the complete sign-in and API checks.
- [ ] If a custom domain is used, attach it to the new Git-integrated project
      and verify DNS/SSL before removing it from the old project.
- [ ] Update Google OAuth Production callback URLs to the final production
      domain if the temporary verification URL was used.
- [ ] Update any bookmarks, documentation, and environment variables that
      still point at the old Pages URL.
- [ ] Make one small commit to `main` and confirm the new project deploys it
      automatically.
- [ ] Keep the old project available as rollback for at least one release
      window.
- [ ] Only after the new project is stable, decide whether to delete the old
      Direct Upload project.

## 9. Final record

- [ ] New Pages project name: `__________________________________________`
- [ ] New production URL: `______________________________________________`
- [ ] New preview URL: `________________________________________________`
- [ ] GitHub commit verified in production: `____________________________`
- [ ] Date/time of successful OAuth test: `_______________________________`
- [ ] Old project retained for rollback until: `__________________________`
- [ ] Update `BACKEND_PROGRESS.md` to mark production OAuth verification
      complete.
