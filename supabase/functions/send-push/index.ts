import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =============================================
// VAPID JWT generation (unchanged from original)
// =============================================
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
  const payload = { aud: audience, exp: expiration, sub: `mailto:${vapidEmail}` }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const signingInput = `${encode(header)}.${encode(payload)}`

  const keyData = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const privateKey = await crypto.subtle.importKey(
    'raw',
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

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
  }
}

// =============================================
// [FIX] AES-128-GCM Web Push payload encryption
// Encrypts the push body using the subscriber's p256dh and auth keys
// as required by the Web Push protocol (RFC 8291 / RFC 8188)
// =============================================
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder()

  // Decode subscriber keys
  const subscriberPublicKeyRaw = Uint8Array.from(
    atob(p256dh.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )
  const authSecret = Uint8Array.from(
    atob(auth.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  // Import subscriber public key
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )

  // Export server public key (65 bytes uncompressed)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // Derive shared secret via ECDH
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPublicKey },
      serverKeyPair.privateKey,
      256
    )
  )

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF extract + expand for pseudo-random key (PRK)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey', 'deriveBits'])

  // PRK from auth secret
  const prkInfoBuf = concat(encoder.encode('WebPush: info\x00'), subscriberPublicKeyRaw, serverPublicKeyRaw)
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: prkInfoBuf },
    hkdfKey,
    256
  ))

  // Import PRK for further derivation
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveKey', 'deriveBits'])

  // Content encryption key (CEK)
  const cekInfo = concat(encoder.encode('Content-Encoding: aes128gcm\x00'))
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey,
    128
  ))

  // Nonce
  const nonceInfo = concat(encoder.encode('Content-Encoding: nonce\x00'))
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey,
    96
  ))

  // Import CEK for AES-GCM encryption
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])

  // Encode payload with padding delimiter (0x02) per RFC 8188
  const payloadBytes = encoder.encode(payload)
  const plaintext = concat(payloadBytes, new Uint8Array([0x02]))

  // Encrypt
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext)
  )

  // Build aes128gcm content (RFC 8188):
  // salt (16) + record_size (4, BE uint32) + key_len (1) + server_public_key (65) + ciphertext
  const recordSize = plaintext.length + 16 + 1 // tag size + delimiter
  const recordSizeBuf = new Uint8Array(4)
  new DataView(recordSizeBuf.buffer).setUint32(0, recordSize + 16, false)

  const ciphertext = concat(
    salt,
    recordSizeBuf,
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw,
    encrypted
  )

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw }
}

// Helper to concatenate Uint8Arrays
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// =============================================
// Main handler
// =============================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const anonKey = publishableKeys.default
    const serviceRoleKey = secretKeys.default
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

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

    // Insert in-app notification
    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id,
      title,
      message: body,
      url: url ?? null,
      read: false,
    })
    if (notifError) console.error('notification insert error:', notifError)

    // Get push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ success: true, push: false, message: 'In-app notification saved, no push subscription' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidEmail = Deno.env.get('VAPID_EMAIL')!

    const pushPayload = JSON.stringify({ title, body, url: url ?? '/' })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          // [FIX] Encrypt payload using subscriber's p256dh and auth keys
          const { ciphertext } = await encryptPayload(pushPayload, sub.p256dh, sub.auth)

          const vapidHeaders = await generateVapidHeaders(
            sub.endpoint,
            vapidPublicKey,
            vapidPrivateKey,
            vapidEmail
          )

          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              ...vapidHeaders,
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '86400',
            },
            body: ciphertext,
          })

          // 410 Gone = subscription expired, clean it up
          if (res.status === 410 || res.status === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          }

          if (!res.ok) {
            const errText = await res.text()
            console.error(`Push failed for ${sub.endpoint}: ${res.status} ${errText}`)
          }

          return res.status
        } catch (err) {
          console.error(`Encryption/push error for ${sub.endpoint}:`, err)
          throw err
        }
      })
    )

    return new Response(
      JSON.stringify({ success: true, push: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('send-push error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})