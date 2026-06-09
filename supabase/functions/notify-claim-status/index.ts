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

    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { claim_id, new_status } = await req.json()
    if (!claim_id || !new_status) return new Response(JSON.stringify({ error: 'claim_id and new_status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const titleMap: Record<string, string> = {
      approved: '✅ Claim Approved',
      declined: '❌ Claim Declined',
    }
    const bodyMap: Record<string, string> = {
      approved: 'Your claim has been approved. Reimbursement will be processed.',
      declined: 'Your claim has been declined. Contact admin for more info.',
    }

    if (!titleMap[new_status]) return new Response(JSON.stringify({ error: 'new_status must be approved or declined' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: claim } = await supabaseAdmin
      .from('claims')
      .select('distributor_id, claim_id')
      .eq('claim_id', claim_id)
      .single()
    if (!claim) return new Response(JSON.stringify({ error: 'Claim not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: distProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('distributor_id', claim.distributor_id)
      .single()
    if (!distProfile) return new Response(JSON.stringify({ error: 'Distributor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        user_id: distProfile.id,
        title: `${titleMap[new_status]} — ${claim.claim_id}`,
        body: bodyMap[new_status],
        url: '/distributor/claims',
      }),
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})