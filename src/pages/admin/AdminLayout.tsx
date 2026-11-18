import React, { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
} from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  AlertCircle,
  ClipboardCheck,
  ExternalLink,
  History,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Store,
  Users,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../../firebase';
import {
  checkAdminServerSession,
  checkIsAdmin,
  logoutAdminOnServer,
  subscribeAdminBookings,
  subscribeAdminBusinesses,
  subscribeVisitEvents,
  verifyAdminPinOnServer,
} from '../../services/portalService';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  type Business,
  type ServiceBooking,
  type VisitEvent,
} from '../../types';
import { useToast } from '../../components/ToastContext';

export interface AdminOutletContext {
  user: User;
  isBootstrappedAdmin: boolean;
  businesses: Business[];
  businessesLoading: boolean;
  visitEvents: VisitEvent[];
  bookings: ServiceBooking[];
  bookingsLoading: boolean;
}

export function useAdminContext() {
  return useOutletContext<AdminOutletContext>();
}

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/admin/lokasi', label: 'Daftar Bisnis', icon: Store, end: false },
  { to: '/admin/survei', label: 'Program Survei', icon: ClipboardCheck, end: false },
  { to: '/admin/partisipan', label: 'Partisipan & Apresiasi', icon: Users, end: false },
  { to: '/admin/booking', label: 'Booking Jasa', icon: Inbox, end: false },
  { to: '/admin/layanan', label: 'Manajemen Layanan', icon: Layers, end: false },
  { to: '/admin/riwayat', label: 'Riwayat & Log Email', icon: History, end: false },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings, end: false },
];

const LEGACY_TITLE_MAP: Record<string, string> = {
  '/admin/qr': 'Daftar Bisnis · QR Code',
  '/admin/galeri': 'Daftar Bisnis · Galeri Gambar',
  '/admin/panduan': 'Daftar Bisnis · Panduan Pengalaman',
  '/admin/statistik': 'Riwayat · Statistik Kunjungan',
};

export function AdminLayout() {
  const { showToast } = useToast();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // State formulir PIN keamanan admin
  const [pinInput, setPinInput] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [lockSeconds, setLockSeconds] = useState(0);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [visitEvents, setVisitEvents] = useState<VisitEvent[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setPinError('');
      setPinInput('');

      if (!currentUser) {
        setIsAuthorized(false);
        setPinVerified(false);
        setAuthReady(true);
        return;
      }

      setCheckingRole(true);
      try {
        const [clientAdminOk, idToken] = await Promise.all([
          checkIsAdmin(
            currentUser.uid,
            currentUser.email,
            currentUser.emailVerified
          ),
          currentUser.getIdToken(),
        ]);

        if (!clientAdminOk) {
          setIsAuthorized(false);
          setPinVerified(false);
          setCheckingRole(false);
          setAuthReady(true);
          return;
        }

        const serverStatus = await checkAdminServerSession(idToken);
        setIsAuthorized(serverStatus.authorized);
        setPinVerified(serverStatus.authorized && serverStatus.pinVerified);
      } catch {
        setIsAuthorized(false);
        setPinVerified(false);
      } finally {
        setCheckingRole(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !isAuthorized || !pinVerified) {
      setBusinesses([]);
      setVisitEvents([]);
      setBookings([]);
      return;
    }

    setBusinessesLoading(true);
    const unsubBiz = subscribeAdminBusinesses(
      user.uid,
      user.email,
      (list) => {
        setBusinesses(list);
        setBusinessesLoading(false);
      },
      () => {
        setBusinessesLoading(false);
      }
    );
    const unsubEvents = subscribeVisitEvents(user.uid, user.email, (events) => {
      setVisitEvents(events);
    });

    let unsubBookings: (() => void) | undefined;
    if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) {
      setBookingsLoading(true);
      unsubBookings = subscribeAdminBookings(
        (list) => {
          setBookings(list);
          setBookingsLoading(false);
        },
        () => {
          setBookingsLoading(false);
        }
      );
    } else {
      setBookings([]);
      setBookingsLoading(false);
    }

    return () => {
      unsubBiz();
      unsubEvents();
      if (unsubBookings) unsubBookings();
    };
  }, [authReady, user, isAuthorized, pinVerified]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Akun Google terhubung. Lanjutkan verifikasi keamanan.');
    } catch (err) {
      console.error('Login error:', err);
      showToast(
        'Gagal masuk dengan akun Google. Pastikan jendela pop-up tidak diblokir browser.',
        'error'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || lockSeconds > 0) return;

    const cleanPin = pinInput.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setPinError('Masukkan 4 digit angka PIN keamanan.');
      return;
    }

    setVerifyingPin(true);
    setPinError('');
    try {
      const idToken = await user.getIdToken(true);
      const result = await verifyAdminPinOnServer(idToken, cleanPin);

      if (!result.ok) {
        if (result.retryAfterSeconds && result.retryAfterSeconds > 0) {
          setLockSeconds(result.retryAfterSeconds);
        }
        setPinError(
          result.error || 'Verifikasi gagal. Periksa kembali PIN Anda.'
        );
        setPinInput('');
        return;
      }

      setPinVerified(true);
      setPinInput('');
      setPinError('');
      showToast('Verifikasi keamanan berhasil. Selamat datang di dashboard Admin.');
    } catch {
      setPinError('Gagal menghubungi server verifikasi. Coba lagi sesaat.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutAdminOnServer();
      await signOut(auth);
      setPinVerified(false);
      setIsAuthorized(false);
      setPinInput('');
      setPinError('');
      showToast('Anda telah keluar dari Panel Admin.', 'info');
    } catch {
      showToast('Gagal keluar dari sesi.', 'error');
    }
  };

  if (!authReady || checkingRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">
            Memeriksa otorisasi pengelola...
          </p>
        </div>
      </div>
    );
  }

  // Langkah 1: Belum Login Google
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
            Masuk Dasbor Admin
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Masuk menggunakan akun Google pengelola yang terdaftar, lalu lanjutkan verifikasi PIN keamanan.
          </p>

          <button
            type="button"
            disabled={signingIn}
            onClick={handleSignIn}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {signingIn ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}
          </button>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <Link
              to="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Kembali ke Portal Publik
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Langkah 2: Akun Google tidak terdaftar sebagai Admin -> Tolak
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Akses Tidak Diizinkan
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Akun yang Anda gunakan tidak memiliki wewenang untuk mengakses halaman pengelola. Gunakan akun pengelola terdaftar atau kembali ke portal publik.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Keluar &amp; Ganti Akun
            </button>
            <Link
              to="/"
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Ke Portal Publik
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Langkah 3: Terotorisasi Google, Wajib Verifikasi PIN Server-Side
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Verifikasi Keamanan Admin
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              Masukkan PIN keamanan untuk melanjutkan ke dashboard pengelolaan.
            </p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                PIN Keamanan (4 Digit)
              </label>
              <input
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="one-time-code"
                autoFocus
                disabled={verifyingPin || lockSeconds > 0}
                value={pinInput}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinInput(digitsOnly);
                  if (pinError) setPinError('');
                }}
                placeholder="••••"
                className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-slate-300 bg-white text-center text-2xl tracking-[0.5em] font-mono text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 disabled:bg-slate-100"
              />
            </div>

            {pinError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{pinError}</p>
                  {lockSeconds > 0 && (
                    <p className="text-xs text-red-700 mt-1 tabular-nums">
                      Coba lagi dalam {Math.floor(lockSeconds / 60)}:
                      {String(lockSeconds % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingPin || lockSeconds > 0 || pinInput.length !== 4}
              className="w-full min-h-[48px] inline-flex items-center justify-center px-5 py-3 rounded-xl bg-teal-700 text-white text-sm sm:text-base font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifyingPin ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span className="truncate">{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Langkah 4: Admin Terautentikasi & PIN Terverifikasi Server
  const pendingBookingsCount = bookings.filter(
    (b) => b.status === 'pending_approval'
  ).length;

  const currentNav =
    ADMIN_NAV_ITEMS.find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to)
    ) ?? null;

  const pageHeaderTitle =
    LEGACY_TITLE_MAP[location.pathname] ??
    currentNav?.label ??
    'Dasbor Pengelola';

  const isBootstrappedAdmin =
    user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

  const renderNavLinks = () =>
    ADMIN_NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const isBookingMenu = item.to === '/admin/booking';
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`
          }
        >
          <span className="flex items-center gap-3 min-w-0">
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </span>
          {isBookingMenu && pendingBookingsCount > 0 && (
            <span className="text-xs font-bold font-mono tabular-nums text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
              {pendingBookingsCount}
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <Link
            to="/admin"
            className="text-base font-extrabold text-slate-900 truncate"
          >
            Panel Admin Portal
          </Link>
        </div>

        <nav
          aria-label="Menu Admin"
          className="flex-1 p-3 space-y-1 overflow-y-auto"
        >
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Lihat Portal Publik
          </Link>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'Pengelola'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Keluar dari akun"
              aria-label="Keluar dari akun"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-extrabold text-slate-900">
                Panel Admin Portal
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {renderNavLinks()}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3">
              <Link
                to="/"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                <ExternalLink className="w-4 h-4" />
                Lihat Portal Publik
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Keluar ({user.email})
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu admin"
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Admin</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-bold text-slate-900 truncate">
                {pageHeaderTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/admin/booking"
              className="min-h-[38px] inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-teal-700 text-white text-xs sm:text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              Booking Masuk{pendingBookingsCount > 0 ? ` (${pendingBookingsCount})` : ''}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          <Outlet
            context={
              {
                user,
                isBootstrappedAdmin,
                businesses,
                businessesLoading,
                visitEvents,
                bookings,
                bookingsLoading,
              } satisfies AdminOutletContext
            }
          />
        </main>
      </div>
    </div>
  );
}
