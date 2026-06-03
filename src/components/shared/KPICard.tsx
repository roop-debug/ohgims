interface KPICardProps {
  label: string
  value: string | number
  icon?: string
}

export default function KPICard({ label, value, icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      {icon && (
        <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}