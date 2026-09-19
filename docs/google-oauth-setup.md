# Google OAuth Setup

This guide walks through adding Google sign-in to Orlando Planner. The backend
uses the same session/membership infrastructure as magic-link auth — Google is
just another provider in the `auth_identities` table.

---

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → Credentials**.
4. Click **Create Credentials → OAuth client ID**.
5. If prompted, configure the **OAuth consent screen** first:
   - User type: **External** (unless you have a Google Workspace org).
   - App name: `Orlando Planner`.
   - User support email: your email.
   - Developer contact: your email.
   - Scopes: add `email` and `profile`.
6. Back in **Create OAuth client ID**:
   - Application type: **Web application**.
   - Name: `Orlando Planner`.
   - **Authorized redirect URIs** — add all of these:
     ```
     http://localhost:3000/api/auth/google/callback
     https://orlando-planner.pages.dev/api/auth/google/callback
     https://preview.orlando-planner.pages.dev/api/auth/google/callback
     ```
     Add any custom domain you plan to use.
7. Click **Create**. Note the **Client ID** and **Client Secret**.

---

## 2. Environment variables

### Local development (`.env` or shell)

```bash
NUXT_AUTH_ENABLED=true
NUXT_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NUXT_GOOGLE_CLIENT_SECRET=your-client-secret
NUXT_APP_BASE_URL=http://localhost:3000
```

### Cloudflare Pages preview

```bash
npx wrangler pages secret put NUXT_AUTH_ENABLED --project-name=orlando-planner --env preview <<< 'true'
npx wrangler pages secret put NUXT_GOOGLE_CLIENT_ID --project-name=orlando-planner --env preview <<< 'your-client-id.apps.googleusercontent.com'
npx wrangler pages secret put NUXT_GOOGLE_CLIENT_SECRET --project-name=orlando-planner --env preview <<< 'your-client-secret'
npx wrangler pages secret put NUXT_APP_BASE_URL --project-name=orlando-planner --env preview <<< 'https://preview.orlando-planner.pages.dev'
```

### Cloudflare Pages production

```bash
npx wrangler pages secret put NUXT_AUTH_ENABLED --project-name=orlando-planner <<< 'true'
npx wrangler pages secret put NUXT_GOOGLE_CLIENT_ID --project-name=orlando-planner <<< 'your-client-id.apps.googleusercontent.com'
npx wrangler pages secret put NUXT_GOOGLE_CLIENT_SECRET --project-name=orlando-planner <<< 'your-client-secret'
npx wrangler pages secret put NUXT_APP_BASE_URL --project-name=orlando-planner <<< 'https://orlando-planner.pages.dev'
```

---

## 3. Runtime config

Add the Google fields to `nuxt.config.ts` runtime config:

```ts
runtimeConfig: {
  // ... existing fields ...
  googleClientId: '',
  googleClientSecret: '',
  public: {
    // ... existing fields ...
    googleEnabled: false,
  },
},
```

The `googleEnabled` public flag controls whether the Google sign-in button
appears in the UI. Set it to `true` alongside `authEnabled`.

---

## 4. Database

The `auth_identities` table already exists from migration 0003:

```sql
CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);
```

No new migration is needed. Google OAuth stores a row with
`provider = 'google'` and `provider_subject = <Google's sub claim>`.

---

## 5. Implementation overview

### New files to create

| File | Purpose |
|------|---------|
| `server/api/auth/google/start.get.ts` | Redirects to Google's authorization URL with PKCE |
| `server/api/auth/google/callback.get.ts` | Handles the callback, exchanges code for tokens, upserts user, creates session |

### Changes to existing files

| File | Change |
|------|--------|
| `server/utils/auth.ts` | Add `stateCookieOptions()`, PKCE helpers (`generateCodeVerifier`, `generateCodeChallenge`) |
| `nuxt.config.ts` | Add `googleClientId`, `googleClientSecret`, `public.googleEnabled` |
| `app/components/LoginPanel.vue` | Add "Sign in with Google" button (conditional on `googleEnabled`) |

---

## 6. OAuth flow

```
Browser                    Server                         Google
  |                           |                              |
  |--- GET /api/auth/google/start -->|                        |
  |                           |-- 302 to Google auth URL --->|
  |<-- 302 Location: Google --|                              |
  |                           |                              |
  |--- GET /api/auth/google/callback?code=...&state=... ---->|
  |                           |<-- POST /token (code exchange)|
  |                           |-- GET /userinfo ------------>|
  |                           |<-- { sub, email, name } -----|
  |                           |                              |
  |                           |-- upsert users               |
  |                           |-- upsert auth_identities     |
  |                           |-- create session cookie      |
  |<-- 302 /trips (or redirect) --|                           |
```

### Key security points

- **PKCE**: The client generates a random `code_verifier` and its SHA-256
  `code_challenge`. The challenge is sent to Google; the verifier is stored in
  an HttpOnly cookie and sent back with the token exchange. This prevents
  authorization code interception.
- **State parameter**: A random `state` value is stored in a cookie and verified
  on callback to prevent CSRF.
- **No silent merging**: If a Google account's email matches an existing magic-link
  user, the OAuth identity is linked only if the user is already signed in.
  Unauthenticated email matches do not auto-merge.
- **Token exchange server-side**: The client secret never reaches the browser.
  The callback endpoint exchanges the code with Google's token endpoint
  directly.

---

## 7. Google Cloud Console checklist

- [ ] OAuth consent screen configured (External, Orlando Planner)
- [ ] Scopes: `email`, `profile`
- [ ] Redirect URIs include localhost, preview, and production
- [ ] Client ID and secret noted
- [ ] App is published (or added as test user) — Google blocks unverified apps
  for external users unless you go through verification

---

## 8. Testing locally

1. Set the env vars in your shell or `.env` file.
2. Run `npm run dev`.
3. Visit `http://localhost:3000` and click "Sign in with Google".
4. You should be redirected to Google, then back to `/trips` with a session.
5. Check D1: `SELECT * FROM auth_identities WHERE provider = 'google'`.

---

## 9. Common issues

**"redirect_uri_mismatch"**
The callback URL in your request doesn't match what's registered in Google Cloud
Console exactly. Check for trailing slashes, http vs https, and port numbers.

**"invalid_client"**
The client secret is wrong or the OAuth client was deleted. Regenerate in
Google Cloud Console.

**"access_denied"**
The user clicked cancel on Google's consent screen, or the app is in Testing
mode and the user isn't a test user.

**Email already exists (magic-link conflict)**
A user signed up with magic-link using the same email. If they're signed in,
link the identity. If not, they should sign in with magic-link first, then
link Google from account settings (future feature).
