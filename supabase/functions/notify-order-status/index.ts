import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  approved:   { title: '✅ Order Approved',   body: 'Your order has been approved and is being prepared.' },
  dispatched: { title: '🚚 Order Dispatched', body: 'Your order is on the way! Check dispatch details.' },
  delivered:  { title: '📦 Order Delivered',  body: 'Your order has been marked as delivered.' },
  cancelled:  { title: '❌ Order Cancelled',  body: 'Your order has been cancelled. Contact admin for details.' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { order_id, new_status } = await req.json()
    if (!order_id || !new_status) return new Response(JSON.stringify({ error: 'order_id and new_status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const message = STATUS_MESSAGES[new_status]
    if (!message) return new Response(JSON.stringify({ error: `Unknown status: ${new_status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: order } = await supabaseAdmin
      .from('purchase_orders')
      .select('distributor_id')
      .eq('id', order_id)
      .single()
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: distProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('distributor_id', order.distributor_id)
      .single()
    if (!distProfile) return new Response(JSON.stringify({ error: 'Distributor profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: distProfile.id,
        title: message.title,
        body: message.body,
        url: '/distributor/orders',
      }),
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})