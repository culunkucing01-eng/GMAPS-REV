import React, { useEffect, useState } from 'react';
import { Mail, Plus, RotateCcw, Save, Shield, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastContext';
import {
  addAdminUser,
  fetchAdminEmailStatus,
  fetchAdminSecuritySummary,
  listAdmins,
  removeAdminUser,
  savePortalSettings,
  subscribePortalSettings,
} from '../../services/portalService';
import {
  type AdminUser,
  DEFAULT_PORTAL_SETTINGS,
  LIMITS,
} from '../../types';
import { useAdminContext } from './AdminLayout';

export function AdminSettingsPage() {
  const { user, isBootstrappedAdmin } = useAdminContext();
  const { showToast } = useToast();

  const [portalName, setPortalName] = useState(DEFAULT_PORTAL_SETTINGS.portalName);
  const [welcomeHeadline, setWelcomeHeadline] = useState(
    DEFAULT_PORTAL_SETTINGS.welcomeHeadline
  );
  const [welcomeSubheadline, setWelcomeSubheadline] = useState(
    DEFAULT_PORTAL_SETTINGS.welcomeSubheadline
  );
  const [reviewEthicsNote, setReviewEthicsNote] = useState(
    DEFAULT_PORTAL_SETTINGS.reviewEthicsNote
  );
  const [bookingFormOpen, setBookingFormOpen] = useState(true);
  const [bookingFormIntro, setBookingFormIntro] = useState(
    DEFAULT_PORTAL_SETTINGS.bookingFormIntro ?? ''
  );
  const [requireNotesOnBooking, setRequireNotesOnBooking] = useState(false);
  const [surveyCompensationNote, setSurveyCompensationNote] = useState(
    DEFAULT_PORTAL_SETTINGS.surveyCompensationNote ?? ''
  );
  const [savingPortal, setSavingPortal] = useState(false);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [removingAdmin, setRemovingAdmin] = useState(false);
  const [securityInfo, setSecurityInfo] = useState<{
    status: string;
    sessionExpiresAt: number;
  } | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    host: string | null;
    port: number | null;
    from: string | null;
    adminRecipientMasked: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribePortalSettings((s) => {
      setPortalName(s.portalName);
      setWelcomeHeadline(s.welcomeHeadline);
      setWelcomeSubheadline(s.welcomeSubheadline);
      setReviewEthicsNote(s.reviewEthicsNote);
      setBookingFormOpen(s.bookingFormOpen ?? true);
      setBookingFormIntro(
        s.bookingFormIntro || DEFAULT_PORTAL_SETTINGS.bookingFormIntro || ''
      );
      setRequireNotesOnBooking(Boolean(s.requireNotesOnBooking));
      setSurveyCompensationNote(
        s.surveyCompensationNote ||
          DEFAULT_PORTAL_SETTINGS.surveyCompensationNote ||
          ''
      );
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    user
      .getIdToken()
      .then(async (token) => {
        const [sec, smtp] = await Promise.all([
          fetchAdminSecuritySummary(token).catch(() => null),
          fetchAdminEmailStatus(token).catch(() => null),
        ]);
        if (sec) setSecurityInfo(sec);
        if (smtp) setEmailStatus(smtp);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!isBootstrappedAdmin) return;
    listAdmins()
      .then(setAdmins)
      .catch(() => {});
  }, [isBootstrappedAdmin]);

  const handleSavePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPortal(true);
    try {
      await savePortalSettings({
        portalName,
        welcomeHeadline,
        welcomeSubheadline,
        reviewEthicsNote,
        bookingFormOpen,
        bookingFormIntro,
        requireNotesOnBooking,
        surveyCompensationNote,
      });
      showToast('Pengaturan portal & formulir booking berhasil diperbarui.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan portal.',
        'error'
      );
    } finally {
      setSavingPortal(false);
    }
  };

  const handleApplyRedesignDefaults = () => {
    setPortalName(DEFAULT_PORTAL_SETTINGS.portalName);
    setWelcomeHeadline(DEFAULT_PORTAL_SETTINGS.welcomeHeadline);
    setWelcomeSubheadline(DEFAULT_PORTAL_SETTINGS.welcomeSubheadline);
    setReviewEthicsNote(DEFAULT_PORTAL_SETTINGS.reviewEthicsNote);
    setBookingFormIntro(DEFAULT_PORTAL_SETTINGS.bookingFormIntro ?? '');
    setSurveyCompensationNote(
      DEFAULT_PORTAL_SETTINGS.surveyCompensationNote ?? ''
    );
    showToast(
      'Teks standar Portal Partisipasi & Layanan Maps dimuat. Klik Simpan untuk menerapkan ke database.',
      'info'
    );
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUid.trim() || !newEmail.trim()) {
      showToast('UID dan alamat email pengelola wajib diisi.', 'error');
      return;
    }
    setAddingAdmin(true);
    try {
      await addAdminUser(newUid, newEmail, newDisplayName);
      const updated = await listAdmins();
      setAdmins(updated);
      setNewUid('');
      setNewEmail('');
      setNewDisplayName('');
      showToast('Pengelola baru berhasil ditambahkan.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menambahkan pengelola.',
        'error'
      );
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeTarget) return;
    setRemovingAdmin(true);
    try {
      await removeAdminUser(removeTarget.uid);
      setAdmins((prev) => prev.filter((a) => a.uid !== removeTarget.uid));
      setRemoveTarget(null);
      showToast('Akses pengelola telah dihapus.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menghapus akses pengelola.',
        'error'
      );
    } finally {
      setRemovingAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Pengaturan</h2>
        <p className="text-sm text-slate-600 mt-1">
          Kelola tampilan portal, pengaturan formulir booking jasa, status email SMTP, dan akun pengelola.
        </p>
      </div>

      {/* Pengaturan Teks Portal & Formulir Booking */}
      <form
        onSubmit={handleSavePortal}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
          Tampilan Portal &amp; Formulir Booking Customer
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Portal
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.PORTAL_NAME_MAX}
              value={portalName}
              onChange={(e) => setPortalName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Judul Utama Sambutan
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.PORTAL_HEADLINE_MAX}
              value={welcomeHeadline}
              onChange={(e) => setWelcomeHeadline(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subjudul Penjelasan Singkat
            </label>
            <textarea
              rows={2}
              required
              maxLength={LIMITS.PORTAL_SUBHEADLINE_MAX}
              value={welcomeSubheadline}
              onChange={(e) => setWelcomeSubheadline(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kebijakan Partisipasi &amp; Kepatuhan Google Maps
            </label>
            <textarea
              rows={3}
              required
              maxLength={LIMITS.PORTAL_ETHICS_MAX}
              value={reviewEthicsNote}
              onChange={(e) => setReviewEthicsNote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Teks Pengantar Halaman Booking Jasa
            </label>
            <textarea
              rows={2}
              maxLength={400}
              value={bookingFormIntro}
              onChange={(e) => setBookingFormIntro(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Penjelasan Kompensasi Survei Riset Internal (Rp1.500)
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={surveyCompensationNote}
              onChange={(e) => setSurveyCompensationNote(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-1">
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={bookingFormOpen}
                onChange={(e) => setBookingFormOpen(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="text-sm font-medium text-slate-800">
                Buka Penerimaan Formulir Booking Customer
              </span>
            </label>

            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireNotesOnBooking}
                onChange={(e) => setRequireNotesOnBooking(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="text-sm font-medium text-slate-800">
                Wajibkan Kolom Catatan pada Booking
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleApplyRedesignDefaults}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Terapkan Teks Standar Redesign
          </button>
          <button
            type="submit"
            disabled={savingPortal}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingPortal ? 'Menyimpan...' : 'Simpan Pengaturan Portal'}
          </button>
        </div>
      </form>

      {/* Status Layanan Email Notifikasi SMTP */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Mail className="w-5 h-5 text-teal-700 shrink-0" />
          <h3 className="text-base font-bold text-slate-900">
            Integrasi Email Notifikasi (SMTP Server)
          </h3>
        </div>
        {emailStatus ? (
          <div className="text-sm text-slate-700 space-y-1.5">
            <div>
              <span className="text-slate-500">Status Konfigurasi SMTP:</span>{' '}
              <strong
                className={`font-semibold ${
                  emailStatus.configured ? 'text-teal-700' : 'text-amber-700'
                }`}
              >
                {emailStatus.configured
                  ? `Aktif (${emailStatus.host}:${emailStatus.port})`
                  : 'Belum dikonfigurasi di environment variable server'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Email Penerima Notifikasi Admin:</span>{' '}
              <strong className="font-mono text-slate-900">
                {emailStatus.adminRecipientMasked}
              </strong>
            </div>
            {emailStatus.from && (
              <div>
                <span className="text-slate-500">Alamat Pengirim:</span>{' '}
                <span className="text-slate-800">{emailStatus.from}</span>
              </div>
            )}
            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              Kredensial SMTP (<code className="font-mono">SMTP_HOST</code>,{' '}
              <code className="font-mono">SMTP_USER</code>,{' '}
              <code className="font-mono">SMTP_PASS</code>) disimpan aman di sisi server tanpa dikirim ke browser. Seluruh riwayat pengiriman tetap tercatat pada menu Riwayat.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Memeriksa status layanan email...</p>
        )}
      </div>

      {/* Info Akun & Status Keamanan PIN Server */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Akun Pengelola &amp; Sesi Keamanan
        </h3>
        <div className="text-sm text-slate-700 space-y-1.5">
          <div>
            <span className="text-slate-500">Nama:</span>{' '}
            <strong className="font-semibold text-slate-900">
              {user.displayName || 'Pengelola'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Email:</span>{' '}
            <strong className="font-semibold text-slate-900">
              {user.email}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Status Verifikasi PIN Server:</span>{' '}
            <strong className="font-semibold text-teal-700">
              {securityInfo ? 'Terverifikasi (Sesi Aktif)' : 'Memeriksa sesi...'}
            </strong>
          </div>
          {securityInfo && (
            <div className="text-xs text-slate-500">
              Berlaku hingga:{' '}
              {new Date(securityInfo.sessionExpiresAt).toLocaleString('id-ID')}
            </div>
          )}
          <div className="text-xs text-slate-500 pt-1">
            ID Pengguna (UID): <code className="font-mono">{user.uid}</code>
          </div>
        </div>
      </div>

      {/* Kelola Daftar Admin (khusus Admin Utama) */}
      {isBootstrappedAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pengelola Tambahan (Admin)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Berikan akses kelola portal kepada rekan pengelola dengan memasukkan UID dan email Google mereka.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAddAdmin}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <input
              type="text"
              value={newUid}
              onChange={(e) => setNewUid(e.target.value)}
              placeholder="UID Firebase pengguna"
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email Google pengguna"
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Nama panggilan"
                className="flex-1 min-w-0 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
              <button
                type="submit"
                disabled={addingAdmin}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>
          </form>

          {admins.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {admins.map((adm) => (
                <div
                  key={adm.uid}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm bg-white"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {adm.displayName || adm.email}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {adm.email} · <span className="font-mono">{adm.uid}</span>
                    </div>
                  </div>
                  {adm.uid !== user.uid && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(adm)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                      aria-label={`Hapus akses ${adm.email}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(removeTarget)}
        title="Hapus Akses Pengelola?"
        message={`Pengguna "${removeTarget?.email}" tidak akan lagi bisa masuk ke Panel Admin.`}
        confirmLabel="Ya, Cabut Akses"
        isDanger
        isLoading={removingAdmin}
        onConfirm={handleRemoveAdmin}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
