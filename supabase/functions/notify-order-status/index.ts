import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  approved:         { title: 'Order Approved',          body: 'Your order has been approved and is being prepared.' },
  dispatched:       { title: 'Order Dispatched',        body: 'Your order is on the way! Check dispatch details.' },
  in_transit:       { title: 'Order In Transit',        body: 'Your order has been dispatched and is in transit.' },
  delivered:        { title: 'Order Delivered',         body: 'Your order has been marked as delivered.' },
  cancelled:        { title: 'Order Cancelled',         body: 'Your order has been cancelled. Contact admin for details.' },
  pending_dispatch: { title: 'Dispatch Pending',        body: 'Your order is approved and pending dispatch.' },
  out_of_stock:     { title: 'Item Out of Stock',       body: 'An item in your order is out of stock.' },
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

    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { order_id, new_status } = await req.json()
    if (!order_id || !new_status) return new Response(JSON.stringify({ error: 'order_id and new_status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const message = STATUS_MESSAGES[new_status]
    if (!message) return new Response(JSON.stringify({ error: `Unknown status: ${new_status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Fetch order with po_id for use in notification URLs
    const { data: order } = await supabaseAdmin
      .from('purchase_orders')
      .select('distributor_id, po_id')
      .eq('po_id', order_id)
      .single()
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Fetch distributor's user_id from distributors table directly
    const { data: distributor } = await supabaseAdmin
      .from('distributors')
      .select('user_id')
      .eq('distributor_id', order.distributor_id)
      .single()
    if (!distributor) return new Response(JSON.stringify({ error: 'Distributor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // [NOTIFY] Insert in-app notification for the distributor
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: distributor.user_id,
        title: message.title,
        message: message.body,
        url: `/distributor/orders/${order.po_id}`,
        read: false,
      })

    // Send push notification to distributor (existing behavior)
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        user_id: distributor.user_id,
        title: message.title,
        body: message.body,
        url: `/distributor/orders/${order.po_id}`,
      }),
    })

    // [NOTIFY] On approval, insert a dispatch pending notification for all admins
    if (new_status === 'approved') {
      const { data: admins } = await supabaseAdmin
        .from('admins')
        .select('user_id')

      if (admins && admins.length > 0) {
        const adminNotifs = admins.map((a: { user_id: string }) => ({
          user_id: a.user_id,
          title: 'Dispatch Pending',
          message: `Order ${order.po_id} has been approved and is awaiting dispatch.`,
          url: '/admin/dispatch',
          read: false,
        }))

        await supabaseAdmin
          .from('notifications')
          .insert(adminNotifs)
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})