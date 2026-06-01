export interface Profile {
  id: string
  email: string
  role: 'admin' | 'distributor'
  distributor_id: string | null
  created_at: string
}

export interface Distributor {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  created_at: string
}

export interface SKU {
  id: string
  name: string
  unit: string
  rate: number
  low_stock_threshold: number | null
  created_at: string
}

export interface MasterInventory {
  id: string
  sku_id: string
  total_stock: number
  updated_at: string
}

export interface DistributorInventory {
  id: string
  distributor_id: string
  sku_id: string
  stock: number
  updated_at: string
}

export interface PurchaseOrder {
  id: string
  distributor_id: string
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled'
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  sku_id: string
  quantity: number
  rate: number
  gst: number
  line_total: number
}

export interface Dispatch {
  id: string
  order_id: string
  distributor_id: string
  dispatched_at: string
  eta: string | null
  status: 'in_transit' | 'delivered'
}

export interface Claim {
  id: string
  distributor_id: string
  sku_id: string
  claim_number: string
  claim_type: string
  units: number
  selling_rate: number
  reimbursement_amt: number | null
  status: 'pending' | 'approved' | 'declined'
  created_at: string
}

export interface SalesLog {
  id: string
  distributor_id: string
  sku_id: string
  units_sold: number
  logged_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  url: string | null
  is_read: boolean
  created_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

// Env types
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_VAPID_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}