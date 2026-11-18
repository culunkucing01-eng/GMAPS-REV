import { Link } from 'react-router-dom';

interface PublicFooterProps {
  portalName: string;
}

export function PublicFooter({ portalName }: PublicFooterProps) {
  return (
    <footer className="bg-white border-t border-slate-200 pt-8 pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 text-sm text-slate-500">
        <div className="max-w-md">
          <p className="font-bold text-slate-900">{portalName}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Portal partisipasi survei pengalaman pelanggan dan direktori informasi bisnis terkurasi admin. Survei internal terpisah penuh dari ulasan Google Maps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
          <Link
            to="/"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Beranda
          </Link>
          <Link
            to="/program-partisipasi"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Program Partisipasi
          </Link>
          <Link
            to="/daftar-bisnis"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Daftar Bisnis
          </Link>
          <Link
            to="/cara-berpartisipasi"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Cara Berpartisipasi
          </Link>
          <Link
            to="/booking"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Booking Jasa
          </Link>
          <Link
            to="/cek-status"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Cek Status Booking
          </Link>
          <Link
            to="/admin"
            className="min-h-[44px] inline-flex items-center hover:text-slate-900 transition-colors"
          >
            Masuk Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
