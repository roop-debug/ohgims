Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Temporary debug — remove after fixing
  const debug = {
    has_url: !!Deno.env.get('SUPABASE_URL'),
    has_service_role: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    has_anon: !!Deno.env.get('SUPABASE_ANON_KEY'),
    has_publishable: !!Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
    has_secret: !!Deno.env.get('SUPABASE_SECRET_KEYS'),
    publishable_value: Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
    secret_value: Deno.env.get('SUPABASE_SECRET_KEYS'),
  }

  return new Response(JSON.stringify(debug), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})