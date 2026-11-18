import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="confirm-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {title}
            </h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 mt-6">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {isLoading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
