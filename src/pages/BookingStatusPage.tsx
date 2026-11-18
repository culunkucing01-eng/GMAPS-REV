import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import {
  checkBookingStatus,
  subscribePortalSettings,
  type BookingStatusLookupResult,
} from '../services/portalService';
import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  DEFAULT_PORTAL_SETTINGS,
  type PortalSettings,
} from '../types';

function getStatusVisual(status: BookingStatus) {
  switch (status) {
    case 'approved':
    case 'completed':
      return {
        bg: 'bg-teal-50 border-teal-200 text-teal-900',
        badgeText: 'text-teal-800',
        Icon: CheckCircle2,
      };
    case 'revision_requested':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-950',
        badgeText: 'text-amber-800',
        Icon: FileEdit,
      };
    case 'rejected':
      return {
        bg: 'bg-red-50 border-red-200 text-red-900',
        badgeText: 'text-red-700',
        Icon: XCircle,
      };
    default:
      return {
        bg: 'bg-slate-50 border-slate-200 text-slate-900',
        badgeText: 'text-amber-700',
        Icon: Clock,
      };
  }
}

export function BookingStatusPage() {
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);

  const [bookingCode, setBookingCode] = useState(
    searchParams.get('kode')?.toUpperCase() ?? ''
  );
  const [email, setEmail] = useState(searchParams.get('email') ?? '');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<BookingStatusLookupResult | null>(null);

  useEffect(() => {
    const unsub = subscribePortalSettings(setSettings);
    return () => unsub();
  }, []);

  const performLookup = async (codeVal: string, emailVal: string) => {
    setErrorMsg('');
    setResult(null);

    const cleanCode = codeVal.trim().toUpperCase();
    const cleanEmail = emailVal.trim().toLowerCase();

    if (!/^BK-[A-Z0-9-]{4,28}$/.test(cleanCode)) {
      setErrorMsg('Masukkan Nomor Booking yang valid (diawali BK-...).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setErrorMsg('Masukkan alamat Email yang digunakan saat mengajukan booking.');
      return;
    }

    setLoading(true);
    try {
      const data = await checkBookingStatus(cleanCode, cleanEmail);
      setResult(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Data booking tidak ditemukan. Periksa kembali Nomor Booking dan Email Anda.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const k = searchParams.get('kode');
    const em = searchParams.get('email');
    if (k && em) {
      void performLookup(k, em);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLookup(bookingCode, email);
  };

  const visual = result ? getStatusVisual(result.status) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-1.5">
            Pelacakan Permohonan
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Cek Status Booking
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
            Masukkan Nomor Booking dan Email yang Anda daftarkan untuk melihat perkembangan pemeriksaan dari tim admin.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lookup-booking-code"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Nomor Booking *
              </label>
              <input
                id="lookup-booking-code"
                type="text"
                required
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                placeholder="BK-20261118-A1B2"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label
                htmlFor="lookup-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email Pemohon *
              </label>
              <input
                id="lookup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-900"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Terlindungi verifikasi kombinasi Nomor Booking &amp; Email.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Memeriksa...' : 'Periksa Status'}
            </button>
          </div>
        </form>

        {result && visual && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
            <div
              className={`p-4 sm:p-5 rounded-xl border flex items-start gap-3.5 ${visual.bg}`}
            >
              <visual.Icon className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium opacity-80">
                  Status Permohonan Saat Ini
                </div>
                <div className="text-lg sm:text-xl font-extrabold mt-0.5">
                  {BOOKING_STATUS_LABELS[result.status] ?? result.status}
                </div>
                {result.statusMessage && (
                  <p className="text-sm mt-1.5 leading-relaxed">
                    {result.statusMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Nomor Booking</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                  {result.bookingCode}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Waktu Pengajuan</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {result.submittedAtLabel}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Nama Bisnis &amp; Kategori</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {result.businessName}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {result.businessCategory} · {result.businessCity}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Jenis Layanan</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {result.serviceType}
                </div>
              </div>
            </div>

            {result.status === 'revision_requested' && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                <p className="text-xs sm:text-sm text-slate-600">
                  Ingin mengirimkan data perbaikan? Ajukan ulang melalui formulir booking dengan data yang sudah dilengkapi.
                </p>
                <Link
                  to="/booking"
                  className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Ajukan Revisi Booking
                </Link>
              </div>
            )}
          </section>
        )}
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
