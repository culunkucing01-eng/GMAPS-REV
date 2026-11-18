import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardCheck,
  ExternalLink,
  Inbox,
  MapPin,
  Plus,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import {
  seedStarterBusinesses,
  subscribeAdminSurveyResponses,
} from '../../services/portalService';
import { BOOKING_STATUS_LABELS, type SurveyResponse } from '../../types';
import { useToast } from '../../components/ToastContext';
import { useAdminContext } from './AdminLayout';

export function AdminOverviewPage() {
  const {
    isBootstrappedAdmin,
    businesses,
    businessesLoading,
    visitEvents,
    bookings,
    bookingsLoading,
  } = useAdminContext();
  const { showToast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(true);

  useEffect(() => {
    if (!isBootstrappedAdmin) {
      setSurveyResponses([]);
      setResponsesLoading(false);
      return;
    }
    setResponsesLoading(true);
    const unsub = subscribeAdminSurveyResponses((list) => {
      setSurveyResponses(list);
      setResponsesLoading(false);
    });
    return () => unsub();
  }, [isBootstrappedAdmin]);

  const activeCount = businesses.filter((b) => b.isActive).length;
  const pendingBookingsCount = bookings.filter(
    (b) => b.status === 'pending_approval'
  ).length;
  const pendingSurveyCount = surveyResponses.filter(
    (r) => r.rewardEligibleStatus === 'pending_review'
  ).length;
  const eligibleOrPaidCount = surveyResponses.filter(
    (r) =>
      r.rewardEligibleStatus === 'eligible' || r.rewardEligibleStatus === 'paid'
  ).length;
  const totalQrScans = visitEvents.filter((e) => e.eventType === 'qr_scan').length;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const count = await seedStarterBusinesses();
      showToast(
        `${count} contoh lokasi bisnis beserta panduan & galeri awal berhasil ditambahkan ke database.`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menambahkan contoh data awal.',
        'error'
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Ringkasan Portal
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Pantau pengajuan survei partisipan, apresiasi Rp1.500, daftar bisnis terkurasi, dan booking jasa.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {businesses.length === 0 && !businessesLoading && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeed}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              {seeding ? 'Menambahkan...' : 'Isi 2 Contoh Lokasi Awal'}
            </button>
          )}
          <Link
            to="/admin/lokasi"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Kelola Daftar Bisnis
          </Link>
        </div>
      </div>

      {/* Peringatan Pengajuan Survei atau Booking Menunggu Verifikasi */}
      {pendingSurveyCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                Ada {pendingSurveyCount} Pengajuan Survei Menunggu Verifikasi Apresiasi Rp1.500
              </h3>
              <p className="text-xs sm:text-sm text-emerald-900 mt-0.5">
                Periksa kelengkapan jawaban partisipan dan tentukan kelayakan apresiasi Rp1.500.
              </p>
            </div>
          </div>
          <Link
            to="/admin/partisipan"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Verifikasi Partisipan
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {pendingBookingsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Inbox className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-amber-950">
                Ada {pendingBookingsCount} Permohonan Booking Jasa Menunggu Persetujuan
              </h3>
              <p className="text-xs sm:text-sm text-amber-900 mt-0.5">
                Periksa kelengkapan data bisnis dan tautan Google Maps sebelum menyetujui atau meminta revisi.
              </p>
            </div>
          </div>
          <Link
            to="/admin/booking"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Proses Booking Jasa
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Partisipasi Survei Masuk
          </div>
          <div className="text-3xl font-extrabold text-teal-700 mt-2 tabular-nums">
            {responsesLoading ? '—' : surveyResponses.length}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {pendingSurveyCount} menunggu · {eligibleOrPaidCount} layak/dibayar
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Lokasi Bisnis Aktif
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {businessesLoading ? '—' : activeCount}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            dari {businesses.length} total listing terkurasi
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Booking Jasa Pending
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-2 tabular-nums">
            {bookingsLoading ? '—' : pendingBookingsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            dari {bookings.length} total pengajuan
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Scan Kode QR
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {totalQrScans}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Kunjungan langsung via QR lokasi
          </div>
        </div>
      </div>

      {/* Akses Cepat 4 Kartu Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/partisipan"
          className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors flex flex-col"
        >
          <Users className="w-6 h-6 text-teal-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            Partisipan &amp; Apresiasi
          </h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Verifikasi pengajuan survei &amp; catat penyaluran apresiasi Rp1.500.
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            Buka Partisipan
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          to="/admin/survei"
          className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors flex flex-col"
        >
          <ClipboardCheck className="w-6 h-6 text-teal-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            Program Survei
          </h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Atur daftar survei pengalaman pelanggan dan persyaratan partisipasi.
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            Kelola Survei
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          to="/admin/lokasi"
          className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors flex flex-col"
        >
          <Store className="w-6 h-6 text-teal-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            Daftar Bisnis
          </h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Kelola foto cover 16:9, jam operasional, galeri, dan QR Code bisnis.
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            Kelola Bisnis
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          to="/admin/booking"
          className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors flex flex-col"
        >
          <Inbox className="w-6 h-6 text-teal-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            Booking Jasa
          </h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Setujui, tolak dengan alasan, atau minta revisi booking pemilik usaha.
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            Proses Booking
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>

      {/* Booking Terbaru */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            Permohonan Booking Jasa Terbaru
          </h3>
          <Link
            to="/admin/booking"
            className="text-xs sm:text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Lihat Semua
          </Link>
        </div>

        {bookingsLoading ? (
          <div className="p-6 text-sm text-slate-500">Memuat booking masuk...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            Belum ada pengajuan booking dari pemilik usaha.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Nomor Booking</th>
                  <th className="py-3 px-4">Bisnis</th>
                  <th className="py-3 px-4">Pemohon</th>
                  <th className="py-3 px-4">Layanan</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {bookings.slice(0, 5).map((bk) => (
                  <tr key={bk.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {bk.bookingCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {bk.businessName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{bk.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">{bk.serviceType}</td>
                    <td className="py-3 px-5 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {BOOKING_STATUS_LABELS[bk.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daftar Ringkas Lokasi Bisnis */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            Daftar Bisnis Terkurasi
          </h3>
          <Link
            to="/admin/lokasi"
            className="text-xs sm:text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Lihat Semua
          </Link>
        </div>

        {businessesLoading ? (
          <div className="p-6 text-sm text-slate-500">Memuat daftar lokasi...</div>
        ) : businesses.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-4">
              Belum ada lokasi bisnis di database. Mulai dengan menambahkan lokasi baru atau mengisi contoh lokasi awal.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeed}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
              >
                {seeding ? 'Menambahkan...' : 'Isi Contoh Data Awal'}
              </button>
              <Link
                to="/admin/lokasi"
                className="min-h-[40px] inline-flex items-center px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
              >
                Tambah Lokasi Baru
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Nama Lokasi</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Kunjungan</th>
                  <th className="py-3 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {businesses.slice(0, 6).map((biz) => {
                  const bizViews = visitEvents.filter(
                    (e) =>
                      e.businessId === biz.id &&
                      (e.eventType === 'page_view' || e.eventType === 'qr_scan')
                  ).length;
                  return (
                    <tr key={biz.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5 font-semibold text-slate-900">
                        {biz.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{biz.category}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            biz.isActive ? 'text-teal-700' : 'text-slate-500'
                          }`}
                        >
                          {biz.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {bizViews}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <a
                          href={`/lokasi/${biz.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                        >
                          Buka
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
