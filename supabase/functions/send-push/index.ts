// v6-debug
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  console.log('function started')
  
  try {
    console.log('env check:', {
      hasUrl: !!Deno.env.get('SUPABASE_URL'),
      hasPublishable: !!Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
      hasSecret: !!Deno.env.get('SUPABASE_SECRET_KEYS'),
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    console.error('error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})