import {
  clearOAuthCookies,
  generateCodeChallenge,
  generateCodeVerifier,
  googleRedirectUri,
  requireAuthDb,
  setCodeVerifierCookie,
  setOAuthStateCookie,
} from '../../../utils/auth'
import { randomToken } from '../../../utils/anonymousTrips'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const clientId = String(config.googleClientId)
  if (!clientId) throw createError({ statusCode: 503, statusMessage: 'Google sign-in unavailable', data: { code: 'google_disabled' } })

  requireAuthDb(event) // gate on authEnabled

  const verifier = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = randomToken()

  clearOAuthCookies(event)
  setOAuthStateCookie(event, state)
  setCodeVerifierCookie(event, verifier)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(event),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })

  return sendRedirect(event, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})
