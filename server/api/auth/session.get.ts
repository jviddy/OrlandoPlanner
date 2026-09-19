import { currentSession, requireAuthDb } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await currentSession(event, requireAuthDb(event))
  setHeader(event, 'Cache-Control', 'no-store')
  return { user: session?.user ?? null }
})
