interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      {/* Dialog box */}
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-4">

        {/* Title */}
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg text-white transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#E8400C] hover:bg-[#c93509]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  )
}