import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const serviceRoleKey = secretKeys.default
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

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

    // Send push + in-app notifications to all distributors
    await Promise.allSettled(
      distributors
        .filter((d: { user_id: string | null }) => d.user_id)
        .map((d: { user_id: string }) =>
          fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              user_id: d.user_id,
              title: `🎉 New Offer: ${offer_name}`,
              body: offer_description ?? `A new offer is now active${skuText}.`,
              url: '/distributor/inventory',
            }),
          })
        )
    )

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})