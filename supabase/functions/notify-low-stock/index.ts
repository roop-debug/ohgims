import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: lowStockItems } = await supabaseAdmin
      .from('master_inventory')
      .select('total_stock, skus(name, low_stock_threshold)')

    const items = (lowStockItems ?? []).filter((row: any) => {
      const threshold = row.skus?.low_stock_threshold
      return threshold !== null && row.total_stock <= threshold
    })

    if (items.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No low stock items' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (!admins?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No admins to notify' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const skuNames = items.map((i: any) => i.skus?.name).filter(Boolean).join(', ')
    const body = items.length === 1
      ? `${skuNames} is running low on stock.`
      : `${items.length} SKUs are running low: ${skuNames}`

    await Promise.allSettled(
      admins.map((admin) =>
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id: admin.id,
            title: `⚠️ Low Stock Alert (${items.length} SKU${items.length > 1 ? 's' : ''})`,
            body,
            url: '/admin/inventory',
          }),
        })
      )
    )

    return new Response(JSON.stringify({ success: true, notified: items.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})