type Status =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'in_transit'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  // [OFFERS] Added offer statuses
  | 'active'
  | 'expired'
  | 'deactivated'
  // [FIX] Added capitalized aliases — actual DB values for master_inventory/distributor_inventory
  | 'In Stock'
  | 'Low Stock'
  | 'Out of Stock'

interface StatusBadgeProps {
  status: string
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending:       { label: 'Pending',       className: 'bg-yellow-100 text-yellow-700' },
  approved:      { label: 'Approved',      className: 'bg-green-100 text-green-700' },
  declined:      { label: 'Declined',      className: 'bg-red-100 text-red-700' },
  dispatched:    { label: 'Dispatched',    className: 'bg-blue-100 text-blue-700' },
  delivered:     { label: 'Delivered',     className: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Cancelled',     className: 'bg-gray-100 text-gray-500' },
  in_transit:    { label: 'In Transit',    className: 'bg-orange-100 text-orange-700' },
  in_stock:      { label: 'In Stock',      className: 'bg-green-100 text-green-700' },
  low_stock:     { label: 'Low Stock',     className: 'bg-yellow-100 text-yellow-700' },
  out_of_stock:  { label: 'Out of Stock',  className: 'bg-red-100 text-red-700' },
  // [OFFERS] Offer status styling
  active:        { label: 'Active',        className: 'bg-green-100 text-green-700' },
  expired:       { label: 'Expired',       className: 'bg-gray-100 text-gray-500' },
  deactivated:   { label: 'Deactivated',   className: 'bg-red-100 text-red-700' },
  // [FIX] Capitalized aliases mapped to the same styling as their lowercase counterparts
  'In Stock':     { label: 'In Stock',     className: 'bg-green-100 text-green-700' },
  'Low Stock':    { label: 'Low Stock',    className: 'bg-yellow-100 text-yellow-700' },
  'Out of Stock': { label: 'Out of Stock', className: 'bg-red-100 text-red-700' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {

  const config = statusConfig[status as Status] ?? { label: status, className: 'bg-gray-100 text-gray-500' }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}