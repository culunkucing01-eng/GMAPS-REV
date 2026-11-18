import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  PlusCircle,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import {
  createBusinessFromBooking,
  processAdminBookingStatus,
} from '../../services/portalService';
import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  LIMITS,
  type ServiceBooking,
} from '../../types';
import { useAdminContext } from './AdminLayout';

const STATUS_FILTERS: Array<{ key: 'all' | BookingStatus; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting_for_customer', label: 'Menunggu Customer' },
  { key: 'revision_requested', label: 'Revisi' },
  { key: 'completed', label: 'Selesai' },
  { key: 'rejected', label: 'Ditolak' },
];

function getStatusTextClass(status: BookingStatus): string {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'text-teal-700 font-semibold';
    case 'in_progress':
    case 'waiting_for_customer':
      return 'text-blue-700 font-semibold';
    case 'revision_requested':
      return 'text-amber-700 font-semibold';
    case 'rejected':
      return 'text-red-600 font-semibold';
    default:
      return 'text-amber-700 font-semibold';
  }
}

function buildWhatsAppUrl(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '#';
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function AdminBookingsPage() {
  const { bookings, bookingsLoading, isBootstrappedAdmin } = useAdminContext();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);

  const [actionNote, setActionNote] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [convertingBiz, setConvertingBiz] = useState(false);

  const counts = useMemo(() => {
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending_approval').length,
      inProgress: bookings.filter((b) => b.status === 'in_progress' || b.status === 'approved').length,
      revision: bookings.filter((b) => b.status === 'revision_requested' || b.status === 'waiting_for_customer').length,
      approvedOrDone: bookings.filter((b) => b.status === 'completed').length,
    };
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchQuery =
        !q ||
        b.bookingCode.toLowerCase().includes(q) ||
        b.businessName.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerEmail.toLowerCase().includes(q) ||
        b.businessCity.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [bookings, statusFilter, search]);

  const openDetail = (bk: ServiceBooking) => {
    setSelectedBooking(bk);
    setActionNote(bk.adminNotes || bk.rejectionReason || '');
  };

  const handleStatusChange = async (nextStatus: BookingStatus) => {
    if (!selectedBooking || processingAction) return;

    if (
      (nextStatus === 'rejected' || nextStatus === 'revision_requested') &&
      actionNote.trim().length < 5
    ) {
      showToast(
        nextStatus === 'rejected'
          ? 'Masukkan alasan penolakan (minimal 5 karakter).'
          : 'Masukkan instruksi revisi data untuk customer (minimal 5 karakter).',
        'error'
      );
      return;
    }

    setProcessingAction(true);
    try {
      const res = await processAdminBookingStatus({
        booking: selectedBooking,
        nextStatus,
        reason: actionNote.trim(),
        adminNotes: actionNote.trim(),
      });

      setSelectedBooking((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              adminNotes: actionNote.trim(),
              rejectionReason:
                nextStatus === 'rejected' ? actionNote.trim() : prev.rejectionReason,
            }
          : null
      );

      let msg = `Status booking ${selectedBooking.bookingCode} diubah menjadi ${BOOKING_STATUS_LABELS[nextStatus]}.`;
      if (res.emailDeliveryStatus === 'sent') {
        msg += ' Email notifikasi terkirim ke customer.';
      } else if (res.emailDeliveryStatus === 'pending_config') {
        msg += ' Tercatat di Log Email (SMTP server belum dikonfigurasi).';
      } else if (res.emailDeliveryStatus === 'failed') {
        msg += ' Perubahan status disimpan, namun pengiriman email SMTP gagal.';
      }
      showToast(msg);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memperbarui status booking.',
        'error'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleConvertToBusiness = async () => {
    if (!selectedBooking || convertingBiz) return;
    setConvertingBiz(true);
    try {
      const newBizId = await createBusinessFromBooking(selectedBooking);
      setSelectedBooking((prev) =>
        prev ? { ...prev, linkedBusinessId: newBizId } : null
      );
      showToast(
        `Bisnis "${selectedBooking.businessName}" berhasil ditambahkan ke Daftar Bisnis.`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menambahkan bisnis dari booking.',
        'error'
      );
    } finally {
      setConvertingBiz(false);
    }
  };

  if (!isBootstrappedAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-600">
          Daftar permohonan booking hanya dapat diakses oleh Admin Utama terotorisasi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Booking Masuk &amp; Paket Layanan
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Periksa permohonan booking paket GBP (Starter, Business, Professional), kelola status pengerjaan, dan kirim notifikasi email.
        </p>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Booking</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {bookingsLoading ? '—' : counts.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Pending Approval</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2 tabular-nums">
            {bookingsLoading ? '—' : counts.pending}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Sedang Dikerjakan</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 mt-2 tabular-nums">
            {bookingsLoading ? '—' : counts.inProgress}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Selesai</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2 tabular-nums">
            {bookingsLoading ? '—' : counts.approvedOrDone}
          </div>
        </div>
      </div>

      {/* Filter Status & Pencarian */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                statusFilter === opt.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor booking, bisnis, nama..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>
      </div>

      {/* Daftar Booking */}
      {bookingsLoading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat daftar permohonan booking...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {bookings.length === 0
              ? 'Belum ada permohonan booking jasa yang masuk.'
              : 'Tidak ada permohonan booking yang cocok dengan filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((bk) => (
              <div
                key={bk.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-900">
                      {bk.bookingCode}
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {bk.businessName}
                    </div>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${getStatusTextClass(bk.status)}`}>
                    {BOOKING_STATUS_LABELS[bk.status]}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    Paket: <strong className="text-teal-800 uppercase">{bk.packageTier || 'Custom'}</strong> {bk.packagePrice ? `(Rp${bk.packagePrice.toLocaleString('id-ID')})` : ''}
                  </div>
                  <div>
                    Pemohon: <strong className="text-slate-800">{bk.customerName}</strong> ({bk.customerWhatsapp})
                  </div>
                  <div className="text-slate-500">{bk.submittedAtLabel}</div>
                </div>

                <button
                  type="button"
                  onClick={() => openDetail(bk)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
                >
                  Periksa &amp; Proses
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3.5 px-5">Nomor Booking</th>
                    <th className="py-3.5 px-4">Paket Layanan</th>
                    <th className="py-3.5 px-4">Bisnis &amp; Kota</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        <div>{bk.bookingCode}</div>
                        <div className="font-sans font-normal text-[11px] text-slate-500 mt-0.5">
                          {bk.submittedAtLabel}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase">
                          {bk.packageTier || 'Custom'}
                        </span>
                        <div className="text-xs font-mono text-slate-600 mt-0.5 tabular-nums">
                          {bk.packagePrice ? `Rp${bk.packagePrice.toLocaleString('id-ID')}` : '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {bk.businessName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {bk.businessCategory} · {bk.businessCity}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {bk.customerName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {bk.customerEmail}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`text-xs ${getStatusTextClass(bk.status)}`}>
                          {BOOKING_STATUS_LABELS[bk.status]}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDetail(bk)}
                          className="min-h-[38px] inline-flex items-center px-3.5 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer"
                        >
                          Detail &amp; Proses
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Detail & Aksi Booking */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Detail booking ${selectedBooking.bookingCode}`}
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-teal-700">
                  {selectedBooking.bookingCode} · Paket <span className="uppercase">{selectedBooking.packageTier || 'Custom'}</span> ({selectedBooking.packagePrice ? `Rp${selectedBooking.packagePrice.toLocaleString('id-ID')}` : 'Manual'})
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 truncate">
                  {selectedBooking.businessName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label="Tutup detail booking"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500">Status Saat Ini:</span>{' '}
                  <span className={`text-sm ${getStatusTextClass(selectedBooking.status)}`}>
                    {BOOKING_STATUS_LABELS[selectedBooking.status]}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Diajukan: {selectedBooking.submittedAtLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Informasi Customer
                  </div>
                  <div className="font-bold text-slate-900">
                    {selectedBooking.customerName}
                  </div>
                  <div className="text-xs text-slate-600">{selectedBooking.customerEmail}</div>
                  <div className="text-xs text-slate-600 font-mono">
                    {selectedBooking.customerWhatsapp}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={buildWhatsAppUrl(selectedBooking.customerWhatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:${selectedBooking.customerEmail}`}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </a>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Informasi Bisnis &amp; Layanan
                  </div>
                  <div className="font-bold text-slate-900">
                    {selectedBooking.businessName}
                  </div>
                  <div className="text-xs text-slate-600">
                    {selectedBooking.businessCategory} · {selectedBooking.businessCity}
                  </div>
                  <div className="text-xs text-slate-600">
                    {selectedBooking.businessAddress}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 pt-1">
                    Layanan: {selectedBooking.serviceType}
                  </div>
                  <a
                    href={selectedBooking.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 mt-1"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-700" />
                    Buka Tautan Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Uploaded Photos by Customer */}
              {selectedBooking.photos && selectedBooking.photos.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Foto Pendukung Bisnis ({selectedBooking.photos.length} Foto Asli)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {selectedBooking.photos.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 block"
                      >
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Lihat Penuh
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedBooking.notes && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Catatan dari Customer
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-line">
                    {selectedBooking.notes}
                  </p>
                </div>
              )}

              {/* Konversi ke Daftar Bisnis (Admin-Controlled) */}
              <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-slate-700">
                  {selectedBooking.linkedBusinessId ? (
                    <span className="font-semibold text-teal-800">
                      Sudah terhubung ke Daftar Bisnis.
                    </span>
                  ) : (
                    <span>
                      Jika disetujui, admin dapat langsung membuat listing di Daftar Bisnis dari data booking ini.
                    </span>
                  )}
                </div>
                {selectedBooking.linkedBusinessId ? (
                  <Link
                    to={`/lokasi/${selectedBooking.linkedBusinessId}`}
                    target="_blank"
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-teal-300 text-teal-800 text-xs font-semibold hover:bg-teal-50 whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Lihat Listing Bisnis
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={convertingBiz}
                    onClick={handleConvertToBusiness}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {convertingBiz ? 'Menambahkan...' : 'Tambahkan ke Daftar Bisnis'}
                  </button>
                )}
              </div>

              {/* Catatan / Alasan Keputusan Admin */}
              <div>
                <label
                  htmlFor="admin-action-note"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Catatan Admin / Alasan Penolakan / Instruksi Revisi
                </label>
                <textarea
                  id="admin-action-note"
                  rows={3}
                  maxLength={LIMITS.BOOKING_REASON_MAX}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Wajib diisi jika menolak atau meminta revisi data kepada customer..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('approved')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Setujui
                </button>

                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('in_progress')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  In Progress
                </button>

                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('waiting_for_customer')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer disabled:opacity-50"
                >
                  <FileEdit className="w-4 h-4" />
                  Tunggu Customer
                </button>

                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('revision_requested')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                >
                  <FileEdit className="w-4 h-4" />
                  Minta Revisi
                </button>

                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('rejected')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Tolak
                </button>

                <button
                  type="button"
                  disabled={processingAction}
                  onClick={() => handleStatusChange('completed')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
