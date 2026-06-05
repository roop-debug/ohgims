import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client — service role, bypasses RLS
   const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).service_role_key
)

    // Verify the caller is actually an admin
    const anonClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!).anon_key,
  { global: { headers: { Authorization: authHeader } } }
)
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden — admins only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const {
      name,
      poc_name,
      poc_contact,
      poc_email,
      billing_address,
      shipping_address,
      gst_no,
      fssai_no,
      location,
      password,
    } = await req.json()

    // Validate required fields
    const required = { name, poc_name, poc_contact, poc_email, billing_address, shipping_address, gst_no, fssai_no, password }
    for (const [key, value] of Object.entries(required)) {
      if (!value || String(value).trim() === '') {
        return new Response(JSON.stringify({ error: `${key} is required` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Step 1 — Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: poc_email,
      password,
      email_confirm: true, // auto confirm, no email sent
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newUserId = authData.user.id

    // Step 2 — Insert distributor row
    const { data: distributorData, error: distError } = await supabaseAdmin
      .from('distributors')
      .insert({
        name,
        poc_name,
        poc_contact,
        poc_email,
        billing_address,
        shipping_address,
        gst_no,
        fssai_no,
        location: location ?? null,
        user_id: newUserId,
      })
      .select('distributor_id')
      .single()

    if (distError) {
      // Rollback — delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: distError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 3 — Create profile row
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        email: poc_email,
        role: 'distributor',
        distributor_id: distributorData.distributor_id,
      })

    if (profileError) {
      // Rollback both
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      await supabaseAdmin.from('distributors').delete().eq('distributor_id', distributorData.distributor_id)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        distributor_id: distributorData.distributor_id,
        user_id: newUserId,
      }),
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