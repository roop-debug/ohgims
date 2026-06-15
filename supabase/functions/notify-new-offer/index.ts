import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const anonKey = publishableKeys.default
    const serviceRoleKey = secretKeys.default
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify caller is admin
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { offer_name, offer_description, sku_names } = await req.json()
    if (!offer_name) return new Response(JSON.stringify({ error: 'offer_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Fetch all distributor user_ids
    const { data: distributors, error: distError } = await supabaseAdmin
      .from('distributors')
      .select('user_id')

    if (distError || !distributors?.length) {
      return new Response(JSON.stringify({ error: 'No distributors found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const skuText = sku_names?.length
      ? ` on ${sku_names.join(', ')}`
      : ''

    // Batch insert in-app notifications for all distributors
    const notifications = distributors
      .filter((d: { user_id: string | null }) => d.user_id)
      .map((d: { user_id: string }) => ({
        user_id: d.user_id,
        title: `New Offer: ${offer_name}`,
        message: offer_description
          ? `${offer_description}${skuText}`
          : `A new offer is now active${skuText}.`,
        url: '/distributor/inventory',
        read: false,
      }))

    await supabaseAdmin.from('notifications').insert(notifications)

    // Send push notifications to all distributors
    for (const d of distributors.filter((d: { user_id: string | null }) => d.user_id)) {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id: d.user_id,
          title: `New Offer: ${offer_name}`,
          body: offer_description ?? `A new offer is now active${skuText}.`,
          url: '/distributor/inventory',
        }),
      })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})