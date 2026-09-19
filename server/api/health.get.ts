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
    hasResendApiKey: !!config.resendApiKey,
    hasAuthEmailFrom: !!config.authEmailFrom,
    hasAppBaseUrl: !!config.appBaseUrl,
    branch: env.CF_PAGES_BRANCH,
    pagesUrl: env.CF_PAGES_URL,
    envKeys: Object.keys(env).filter((k) => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('key') && !k.toLowerCase().includes('token')),
  }
})
