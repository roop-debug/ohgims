// Represents an active offer for a specific SKU
export interface ActiveOffer {
  offer_id: string
  offer_sku_id: string
  sku_id: string
  original_price: number
  discount_type: 'percent' | 'value'
  discount_value: number
  offer_name: string
  end_date: string
}

// Computes the effective price for a SKU given the active offers map
export function getEffectivePrice(
  sku_id: string,
  fallback_price: number,
  activeOffers: ActiveOffer[]
): { effectivePrice: number; originalPrice: number | null; hasOffer: boolean } {
  const offer = activeOffers.find((o) => o.sku_id === sku_id)

  if (!offer) {
    return { effectivePrice: fallback_price, originalPrice: null, hasOffer: false }
  }

  const original = offer.original_price
  const discounted =
    offer.discount_type === 'percent'
      ? original - (original * offer.discount_value) / 100
      : original - offer.discount_value

  return {
    effectivePrice: Math.max(0, discounted),
    originalPrice: original,
    hasOffer: true,
  }
}

// Fetch all currently active offers with their SKU associations
// Call this once on page mount and pass the result to getEffectivePrice
export async function fetchActiveOffers(supabase: any): Promise<ActiveOffer[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('offer_skus')
    .select(`
      offer_sku_id,
      sku_id,
      original_price,
      offers!inner (
        offer_id,
        name,
        discount_type,
        discount_value,
        end_date,
        status
      )
    `)
    .eq('offers.status', 'active')
    .gt('offers.end_date', now)

  if (error || !data) return []

  return data.map((row: any) => ({
    offer_id: row.offers.offer_id,
    offer_sku_id: row.offer_sku_id,
    sku_id: row.sku_id,
    original_price: row.original_price,
    discount_type: row.offers.discount_type,
    discount_value: row.offers.discount_value,
    offer_name: row.offers.name,
    end_date: row.offers.end_date,
  }))
}

/* export async function fetchActiveOffers(supabase: any): Promise<ActiveOffer[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('offer_skus')
    .select(`
      offer_sku_id,
      sku_id,
      original_price,
      offers!inner (
        offer_id,
        name,
        discount_type,
        discount_value,
        end_date,
        status
      )
    `)

  if (error || !data) return []

  // [OFFERS] Filter in JS — avoids PostgREST joined column filtering quirks
  return data
    .filter((row: any) =>
      row.offers.status === 'active' && new Date(row.offers.end_date) > new Date()
    )
    .map((row: any) => ({
      offer_id: row.offers.offer_id,
      offer_sku_id: row.offer_sku_id,
      sku_id: row.sku_id,
      original_price: row.original_price,
      discount_type: row.offers.discount_type,
      discount_value: row.offers.discount_value,
      offer_name: row.offers.name,
      end_date: row.offers.end_date,
    }))
}*/ 