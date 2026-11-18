import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const styles =
            t.variant === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : t.variant === 'info'
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-teal-50 border-teal-200 text-teal-950';

          const Icon =
            t.variant === 'error'
              ? AlertCircle
              : t.variant === 'info'
                ? Info
                : CheckCircle2;

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all ${styles}`}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Tutup notifikasi"
                className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
