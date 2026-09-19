export default defineEventHandler((event) => {
  const env = (event.context as any).cloudflare?.env ?? {}
  const db = env.ORLANDO_DB
  const config = useRuntimeConfig(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    authEnabled: config.authEnabled,
    hasOrlandoDbBinding: !!db,
    hasBatchMethod: typeof db?.batch === 'function',
    hasRateLimitSecret: !!config.authRateLimitSecret,
    hasRateLimitSecretEnv: !!env.NUXT_AUTH_RATE_LIMIT_SECRET,
    hasResendApiKey: !!config.resendApiKey,
    hasResendApiKeyEnv: !!env.NUXT_RESEND_API_KEY,
    hasAuthEmailFrom: !!config.authEmailFrom,
    hasAuthEmailFromEnv: !!env.NUXT_AUTH_EMAIL_FROM,
    hasGoogleClientSecret: !!config.googleClientSecret,
    hasGoogleClientSecretEnv: !!env.NUXT_GOOGLE_CLIENT_SECRET,
    hasAnonymousCapabilitySecret: !!config.anonymousCapabilitySecret,
    hasAnonymousCapabilitySecretEnv: !!env.NUXT_ANONYMOUS_CAPABILITY_SECRET,
    hasAppBaseUrl: !!config.appBaseUrl,
    hasAppBaseUrlEnv: !!env.NUXT_APP_BASE_URL,
    branch: env.CF_PAGES_BRANCH,
    pagesUrl: env.CF_PAGES_URL,
    envKeys: Object.keys(env).filter((k) => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('key') && !k.toLowerCase().includes('token')),
  }
})
