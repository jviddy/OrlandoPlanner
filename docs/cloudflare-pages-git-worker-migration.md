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
- [x] Commit and push all backend/auth changes to the repository's `main` branch.

## 2. Create a new Git-integrated Pages project

Do this from **Cloudflare Dashboard → Workers & Pages → Create → Pages →
Connect to Git**. Use a temporary project name so the existing production
project remains available during verification, for example:
`orlando-planner-git`.

- [x] Connect GitHub and authorize Cloudflare's GitHub application.
- [x] Select `jviddy/OrlandoPlanner`.
- [x] Set the production branch to `main`.
- [x] Set the framework preset to **None** (Nuxt was not listed).
- [x] Set the root directory to the repository root.
- [x] Set the build command to `npm run build`.
- [x] Set the build output directory to `dist`.
- [x] Enable preview deployments for the branch/PR workflow you want to use.
- [x] Save the project and wait for its first build to complete.

Expected result: the new project shows a Git repository under **Settings →
Builds**, and the deployment is associated with a commit from `main` rather
than a manual Wrangler upload.

## 3. Recreate Cloudflare bindings and compatibility settings

- [x] Add the `nodejs_compat` compatibility flag for Production and Preview (managed by `wrangler.toml`; confirmed on Production).
- [x] Add the D1 binding named `ORLANDO_DB`:
  - Production → `orlando-planner-production`
  - Preview → `orlando-planner-preview`
- [x] Confirm the migration set is applied to each database:

  ```bash
  npx wrangler d1 migrations list orlando-planner-production --remote --env production
  npx wrangler d1 migrations list orlando-planner-preview --remote
  ```

- [x] Add non-secret build variables in both environments (managed by the repository build configuration):
  - `NODE_VERSION=22`
  - `NPM_CONFIG_LEGACY_PEER_DEPS=true`
- [x] Confirm the Pages build is using the repository's `wrangler.toml`.

## 4. Add runtime variables and secrets

Set these separately for **Production** and **Preview**. Never commit values to
the repository.

- [x] `NUXT_AUTH_ENABLED=true` (application default; dashboard text variables are locked to `wrangler.toml`)
- [x] `NUXT_PUBLIC_GOOGLE_ENABLED=true` (application default; dashboard text variables are locked to `wrangler.toml`)
- [x] `NUXT_GOOGLE_CLIENT_ID=<Google OAuth client ID>` (Production and Preview secret)
- [x] `NUXT_GOOGLE_CLIENT_SECRET=<Google OAuth client secret>` (Production and Preview secret)
- [x] `NUXT_APP_BASE_URL=<exact URL for that environment>` (request-origin fallback is active for the Pages URL)
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

- [x] Add the new Production callback:
      `https://orlando-planner-git.pages.dev/api/auth/google/callback`
      Google Cloud Console now shows the URI on the OAuth client. Google
      still returned a cached `redirect_uri_mismatch` during immediate retry;
      allow the documented propagation window and retry.
- [ ] Add the new Preview callback:
      `https://<new-preview-domain>/api/auth/google/callback`
- [ ] Keep the existing callback URLs until the cutover is complete.
- [ ] Check that the OAuth consent screen/test-user configuration still allows
      the account used for testing.

## 6. Verify that the Nitro worker is active

- [x] Open the new Pages deployment URL: `https://orlando-planner-git.pages.dev`.
- [x] Confirm the deployment is marked as Git-based, not Direct Upload.
- [ ] From the repository, identify the deployment ID and run:

  ```bash
  npx wrangler pages deployment list --project-name=<new-project-name>
  npx wrangler pages deployment tail <deployment-id> \
    --project-name=<new-project-name>
  ```

- [ ] Confirm `deployment tail` connects to a Functions deployment. If it says
      `does not have a Pages Function`, stop and fix the deployment mode before
      testing authentication.
- [x] Check the OAuth start route:

  ```bash
  curl -i https://<new-production-domain>/api/auth/google/start
  ```

  Expected result: HTTP `302` with a `Location` header beginning with
  `https://accounts.google.com/o/oauth2/v2/auth`.

- [x] Check the session route:

  ```bash
  curl -i https://<new-production-domain>/api/auth/session
  ```

  Actual result: HTTP `200` with `{"user":null}` when no session is present.

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

- [x] New Pages project name: `orlando-planner-git`
- [x] New production URL: `https://orlando-planner-git.pages.dev`
- [ ] New preview URL: *(no separate preview deployment URL recorded yet)*
- [x] GitHub commit verified in production: `6784585`
- [x] Production OAuth start route verified: 19 September 2026
- [x] Old project retained for rollback: `orlando-planner.pages.dev`
- [x] Update `BACKEND_PROGRESS.md` with the production deployment status.

The complete interactive Google callback/session test remains open until the
production callback is added to Google Cloud Console and a browser sign-in is
completed successfully. The old Direct Upload project is intentionally
retained as the rollback point.
