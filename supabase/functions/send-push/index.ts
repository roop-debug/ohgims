// v7-debug
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('step 1 - parsing keys')
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const anonKey = publishableKeys.default
    const serviceRoleKey = secretKeys.default
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    console.log('step 1 done', { hasAnon: !!anonKey, hasService: !!serviceRoleKey })

    console.log('step 2 - parsing body')
    const { user_id, title, body, url } = await req.json()
    console.log('step 2 done', { user_id, title })

    console.log('step 3 - creating admin client')
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    console.log('step 3 done')

    console.log('step 4 - checking auth header')
    const authHeader = req.headers.get('Authorization')
    console.log('step 4 done', { hasAuth: !!authHeader })

    return new Response(JSON.stringify({ ok: true, user_id, title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})