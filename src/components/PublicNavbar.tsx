import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface PublicNavbarProps {
  portalName: string;
}

export function PublicNavbar({ portalName }: PublicNavbarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = location.pathname;

  const navItems = [
    {
      label: 'Beranda',
      to: '/',
      active: pathname === '/',
      secondary: false,
    },
    {
      label: 'Program Partisipasi',
      to: '/program-partisipasi',
      active: pathname === '/program-partisipasi' || pathname === '/survei',
      secondary: false,
    },
    {
      label: 'Daftar Bisnis',
      to: '/daftar-bisnis',
      active: pathname === '/daftar-bisnis' || pathname.startsWith('/lokasi/'),
      secondary: false,
    },
    {
      label: 'Cara Berpartisipasi',
      to: '/cara-berpartisipasi',
      active: pathname === '/cara-berpartisipasi',
      secondary: false,
    },
    {
      label: 'Booking Jasa',
      to: '/booking',
      active:
        pathname === '/booking' ||
        pathname === '/booking-jasa' ||
        pathname === '/cek-status',
      secondary: true,
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 truncate min-w-0"
        >
          {portalName}
        </Link>

        {/* Zone 2: Desktop Navigation (Exact 5 Menu Order; Booking Jasa Secondary) */}
        <nav
          aria-label="Navigasi utama"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              aria-current={item.active ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                item.active
                  ? 'text-teal-800 font-semibold'
                  : item.secondary
                    ? 'text-slate-500 hover:text-slate-900'
                    : 'hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: 1 Primary CTA (Program Partisipasi) + Mobile Drawer Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/program-partisipasi"
            className="hidden sm:inline-flex min-h-[40px] items-center justify-center px-4 py-2 rounded-xl bg-teal-700 text-white text-xs sm:text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            Ikuti Survei Rp1.500
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-sm">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`min-h-[44px] flex items-center justify-between px-3 rounded-xl text-sm ${
                item.active
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
              {item.secondary && (
                <span className="text-[11px] text-slate-400 font-normal">
                  Pemilik Usaha
                </span>
              )}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100">
            <Link
              to="/cek-status"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] flex items-center px-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Cek Status Booking Jasa
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
