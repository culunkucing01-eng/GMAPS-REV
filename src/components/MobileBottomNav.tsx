import { Link, useLocation } from 'react-router-dom';
import { Briefcase, ClipboardCheck, Home, Store } from 'lucide-react';

export function MobileBottomNav() {
  const location = useLocation();
  const pathname = location.pathname;

  const tabs = [
    {
      label: 'Beranda',
      to: '/',
      icon: Home,
      active: pathname === '/',
    },
    {
      label: 'Partisipasi',
      to: '/program-partisipasi',
      icon: ClipboardCheck,
      active: pathname === '/program-partisipasi' || pathname === '/survei',
    },
    {
      label: 'Bisnis',
      to: '/daftar-bisnis',
      icon: Store,
      active: pathname === '/daftar-bisnis' || pathname.startsWith('/lokasi/'),
    },
    {
      label: 'Booking',
      to: '/booking',
      icon: Briefcase,
      active:
        pathname === '/booking' ||
        pathname === '/booking-jasa' ||
        pathname === '/cek-status',
    },
  ];

  return (
    <nav
      aria-label="Navigasi cepat mobile"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200"
    >
      <div className="grid grid-cols-4 items-center h-16 max-w-xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={tab.active ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                tab.active
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={tab.active ? 2.4 : 1.9} />
              <span className="text-[11px] leading-tight tracking-tight truncate max-w-full">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
