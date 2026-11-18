import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = 'Terjadi kendala saat memuat halaman ini.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          readable =
            'Maaf, Anda tidak memiliki izin untuk mengakses atau mengubah data tersebut. Pastikan Anda masuk dengan akun pengelola yang sesuai.';
        } else {
          readable = parsed.error;
        }
      }
    } catch {
      if (error.message) readable = error.message;
    }
    return { hasError: true, errorMessage: readable };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary menangkap kesalahan:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Halaman Mengalami Kendala
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.errorMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Halaman
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Kembali ke Beranda
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
