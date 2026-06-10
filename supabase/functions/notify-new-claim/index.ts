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

    const { claim_id, distributor_id } = await req.json()
    if (!claim_id || !distributor_id) {
      return new Response(JSON.stringify({ error: 'claim_id and distributor_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get distributor name
    const { data: dist } = await supabaseAdmin
      .from('distributors')
      .select('name')
      .eq('distributor_id', distributor_id)
      .single()

    // Notify all admins
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (!admins?.length) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await Promise.allSettled(
      admins.map((admin) =>
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: admin.id,
            title: '📋 New Claim Submitted',
            body: `${dist?.name ?? 'A distributor'} has submitted a new claim (${claim_id}).`,
            url: '/admin/claims',
          }),
        })
      )
    )

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})