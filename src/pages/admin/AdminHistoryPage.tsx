import { useEffect, useState } from 'react';
import { BarChart3, History, Mail } from 'lucide-react';
import {
  subscribeBookingAuditLogs,
  subscribeEmailLogs,
} from '../../services/portalService';
import {
  BOOKING_STATUS_LABELS,
  type BookingAuditLog,
  type EmailLog,
} from '../../types';
import { useAdminContext } from './AdminLayout';
import { AdminStatsPage } from './AdminStatsPage';

type HistoryTab = 'audit' | 'email' | 'stats';

const EMAIL_EVENT_LABELS: Record<EmailLog['eventType'], string> = {
  new_booking_admin: 'Notifikasi Booking Baru ke Admin',
  booking_approved: 'Email Persetujuan ke Customer',
  booking_rejected: 'Email Penolakan ke Customer',
  booking_revision: 'Email Permintaan Revisi ke Customer',
  new_survey_admin: 'Notifikasi Survei Baru ke Admin',
  survey_received: 'Email Konfirmasi Penerimaan Survei',
  survey_revision_requested: 'Email Permintaan Revisi Survei',
  survey_approved: 'Email Persetujuan & Apresiasi Survei',
  survey_rejected: 'Email Penolakan Survei',
  participant_help_admin: 'Notifikasi Tiket Bantuan Peserta',
};

export function AdminHistoryPage() {
  const { isBootstrappedAdmin } = useAdminContext();
  const [activeTab, setActiveTab] = useState<HistoryTab>('audit');
  const [auditLogs, setAuditLogs] = useState<BookingAuditLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBootstrappedAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubAudit = subscribeBookingAuditLogs((list) => {
      setAuditLogs(list);
      setLoading(false);
    });
    const unsubEmail = subscribeEmailLogs((list) => {
      setEmailLogs(list);
    });
    return () => {
      unsubAudit();
      unsubEmail();
    };
  }, [isBootstrappedAdmin]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Riwayat &amp; Aktivitas
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Pantau riwayat perubahan status booking, log pengiriman notifikasi email, serta statistik kunjungan &amp; QR Code.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Status Booking ({auditLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'email'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          Log Notifikasi Email ({emailLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Statistik Kunjungan &amp; QR
        </button>
      </div>

      {activeTab === 'stats' ? (
        <AdminStatsPage />
      ) : !isBootstrappedAdmin ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
          Log riwayat booking dan email hanya dapat dilihat oleh Admin Utama terotorisasi.
        </div>
      ) : activeTab === 'audit' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Riwayat Perubahan Status Booking
            </h3>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Memuat riwayat...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada aktivitas perubahan status booking tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3 px-5">Waktu</th>
                    <th className="py-3 px-4">Nomor Booking</th>
                    <th className="py-3 px-4">Perubahan Status</th>
                    <th className="py-3 px-4">Catatan / Alasan</th>
                    <th className="py-3 px-5">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {auditLogs.map((log) => {
                    const timeLabel = log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Baru saja';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-5 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {timeLabel}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          {log.bookingCode}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {BOOKING_STATUS_LABELS[log.fromStatus]} →{' '}
                          <strong className="text-slate-900">
                            {BOOKING_STATUS_LABELS[log.toStatus]}
                          </strong>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                          {log.reason || '—'}
                        </td>
                        <td className="py-3 px-5 text-xs text-slate-500">
                          {log.actorEmail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Log Pengiriman Notifikasi Email
            </h3>
          </div>
          {emailLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada aktivitas notifikasi email yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3 px-5">Waktu</th>
                    <th className="py-3 px-4">Nomor Booking</th>
                    <th className="py-3 px-4">Jenis Notifikasi</th>
                    <th className="py-3 px-4">Penerima</th>
                    <th className="py-3 px-4">Status Pengiriman</th>
                    <th className="py-3 px-5">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {emailLogs.map((log) => {
                    const timeLabel = log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Baru saja';
                    const statusText =
                      log.deliveryStatus === 'sent'
                        ? 'Terkirim (SMTP)'
                        : log.deliveryStatus === 'pending_config'
                          ? 'Menunggu Config SMTP'
                          : 'Gagal Kirim';
                    const statusColor =
                      log.deliveryStatus === 'sent'
                        ? 'text-teal-700 font-semibold'
                        : log.deliveryStatus === 'pending_config'
                          ? 'text-amber-700 font-semibold'
                          : 'text-red-600 font-semibold';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-5 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {timeLabel}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          {log.bookingCode}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-800">
                          {EMAIL_EVENT_LABELS[log.eventType] ?? log.eventType}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {log.recipientMasked}
                        </td>
                        <td className={`py-3 px-4 text-xs whitespace-nowrap ${statusColor}`}>
                          {statusText}
                        </td>
                        <td className="py-3 px-5 text-xs text-slate-500 max-w-xs">
                          {log.statusNote || log.subject}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
