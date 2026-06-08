import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Web Push encryption helpers
async function generateVapidHeaders(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
) {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600 // 12 hours

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Allow service role calls (from other edge functions)
const isServiceRole = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`

if (!isServiceRole) {
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

    // Parse body
    const { user_id, title, body, url } = await req.json()

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get push subscription for target user
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (subError || !subscriptions?.length) {
      return new Response(JSON.stringify({ error: 'No push subscription found for user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
          // Subscription expired — clean it up
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }

        return res.status
      })
    )

    // Also insert into notifications table if it exists
    // (for the NotificationBell in-app display)
    await supabaseAdmin.from('notifications').insert({
  user_id,
  title,
  message: body,
  read: false,
}).then(() => {}).catch(() => {})

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})