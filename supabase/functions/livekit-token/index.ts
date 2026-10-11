// Èkó voice: hands a player a LiveKit pass for their game's voice room.
//
// The LiveKit secret never reaches the browser. This function checks who's asking (their Supabase
// session) and that they have a seat in the game, then signs a short-lived, audio-only pass.
//
// Secrets to set in Supabase → Edge Functions → Secrets:
//   LIVEKIT_URL         wss://your-project.livekit.cloud
//   LIVEKIT_API_KEY     from LiveKit Cloud → Settings → API keys
//   LIVEKIT_API_SECRET  the matching secret
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.
//
// No imports, so it can be pasted straight into the dashboard editor.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** How long a pass lasts. Reconnecting after this needs a new one, which the game fetches itself. */
const TTL_SECONDS = 6 * 60 * 60

// Trimmed: a secret pasted into the dashboard can pick up a trailing line break, which breaks signing
const env = (name: string) => (Deno.env.get(name) ?? '').trim()

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)))

/** A LiveKit access token: an HS256 JWT signed with the API secret. */
export async function mintToken(opts: {
  apiKey: string
  apiSecret: string
  room: string
  identity: string
  name: string
  metadata?: string
  ttl?: number
}) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const claims = {
    iss: opts.apiKey,
    sub: opts.identity,
    jti: opts.identity,
    name: opts.name,
    metadata: opts.metadata ?? '',
    nbf: now - 10,
    exp: now + (opts.ttl ?? TTL_SECONDS),
    video: {
      room: opts.room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      // Voice only: no camera, no screen share, no data messages
      canPublishSources: ['microphone'],
      canPublishData: false,
    },
  }
  const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(opts.apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64url(new Uint8Array(signature))}`
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' })

  const livekitUrl = env('LIVEKIT_URL')
  const apiKey = env('LIVEKIT_API_KEY')
  const apiSecret = env('LIVEKIT_API_SECRET')
  if (!livekitUrl || !apiKey || !apiSecret) return reply(503, { error: 'Voice isn’t set up on the server yet.' })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'Sign in first.' })

  let gameId = ''
  try {
    gameId = String((await req.json()).gameId ?? '')
  } catch {
    // Falls through to the check below
  }
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return reply(400, { error: 'Which game?' })

  const supabaseUrl = env('SUPABASE_URL')
  const headers = { apikey: env('SUPABASE_ANON_KEY'), Authorization: auth }

  // Who is this? (Supabase checks the session token for us)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers })
  if (!userRes.ok) return reply(401, { error: 'Your session has expired. Reload the page.' })
  const user = (await userRes.json()) as { id: string }

  // Are they seated in this game? Row-level security only shows seats in games they belong to.
  const seatRes = await fetch(
    `${supabaseUrl}/rest/v1/game_players?select=seat,nickname&game_id=eq.${gameId}&user_id=eq.${user.id}`,
    { headers },
  )
  const seats = seatRes.ok ? ((await seatRes.json()) as { seat: number; nickname: string }[]) : []
  if (seats.length === 0) return reply(403, { error: 'You’re not in this game.' })

  const token = await mintToken({
    apiKey,
    apiSecret,
    room: `eko-${gameId}`,
    identity: user.id,
    name: seats[0].nickname,
    metadata: JSON.stringify({ seat: seats[0].seat }),
  })
  return reply(200, { url: livekitUrl, token })
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (err) {
    console.error(err)
    return reply(500, { error: 'Voice server error. Try again.' })
  }
})
