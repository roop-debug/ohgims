import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateVapidHeaders(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
) {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600

  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    aud: audience,
    exp: expiration,
    sub: `mailto:${vapidEmail}`,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  const signingInput = `${encode(header)}.${encode(payload)}`

  const keyData = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    'Content-Type': 'application/json',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use new key format
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const anonKey = publishableKeys.default
    const serviceRoleKey = secretKeys.default
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Allow service role calls from other edge functions
const isServiceRole = authHeader.startsWith('Bearer sb_secret_') || 
                      authHeader === `Bearer ${serviceRoleKey}`

if (!isServiceRole) {
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

    const { user_id, title, body, url } = await req.json()

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get push subscriptions for target user
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    // Insert in-app notification regardless of push subscription
    await supabaseAdmin.from('notifications').insert({
      user_id,
      title,
      message: body,
      url: url ?? null,
      read: false,
    }).catch(() => {})

    // If no push subscription, still return success (in-app notification was saved)
    if (subError || !subscriptions?.length) {
      return new Response(
        JSON.stringify({ success: true, push: false, message: 'In-app notification saved, no push subscription found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidEmail = Deno.env.get('VAPID_EMAIL')!

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const headers = await generateVapidHeaders(
          sub.endpoint,
          vapidPublicKey,
          vapidPrivateKey,
          vapidEmail
        )

        const payload = JSON.stringify({ title, body, url: url ?? '/' })

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Encoding': 'aes128gcm',
            TTL: '86400',
          },
          body: payload,
        })

        if (!res.ok && res.status === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }

        return res.status
      })
    )

    return new Response(
      JSON.stringify({ success: true, push: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})