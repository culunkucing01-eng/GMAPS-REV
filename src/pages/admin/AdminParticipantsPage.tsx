import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import {
  subscribeAdminSurveyResponses,
  updateSurveyResponseStatus,
} from '../../services/portalService';
import {
  REWARD_STATUS_LABELS,
  type RewardEligibleStatus,
  type SurveyResponse,
} from '../../types';
import { useAdminContext } from './AdminLayout';

const STATUS_FILTERS: Array<{ value: 'all' | RewardEligibleStatus; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending_review', label: 'Menunggu Verifikasi' },
  { value: 'eligible', label: 'Memenuhi Syarat (Rp1.500)' },
  { value: 'paid', label: 'Apresiasi Disalurkan (Rp1.500)' },
  { value: 'not_eligible', label: 'Belum Memenuhi Syarat' },
];

export function AdminParticipantsPage() {
  const { isBootstrappedAdmin } = useAdminContext();
  const { showToast } = useToast();

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'participants'>(
    'submissions'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RewardEligibleStatus>('all');

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [payoutRefDraft, setPayoutRefDraft] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isBootstrappedAdmin) {
      setResponses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeAdminSurveyResponses((list) => {
      setResponses(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isBootstrappedAdmin]);

  const stats = useMemo(() => {
    const uniqueEmails = new Set(
      responses.map((r) => r.respondentEmail.trim().toLowerCase())
    );
    const pendingCount = responses.filter(
      (r) => r.rewardEligibleStatus === 'pending_review'
    ).length;
    const eligibleCount = responses.filter(
      (r) => r.rewardEligibleStatus === 'eligible'
    ).length;
    const paidCount = responses.filter(
      (r) => r.rewardEligibleStatus === 'paid'
    ).length;
    const totalAppreciationRp = (eligibleCount + paidCount) * 1500;
    const disbursedRp = paidCount * 1500;

    return {
      uniqueParticipants: uniqueEmails.size,
      totalSubmissions: responses.length,
      pendingCount,
      eligibleOrPaidCount: eligibleCount + paidCount,
      paidCount,
      totalAppreciationRp,
      disbursedRp,
    };
  }, [responses]);

  const filteredResponses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return responses.filter((r) => {
      if (statusFilter !== 'all' && r.rewardEligibleStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.respondentName.toLowerCase().includes(q) ||
        r.respondentEmail.toLowerCase().includes(q) ||
        (r.participationCode ?? '').toLowerCase().includes(q) ||
        r.businessName.toLowerCase().includes(q) ||
        r.surveyTitle.toLowerCase().includes(q)
      );
    });
  }, [responses, searchQuery, statusFilter]);

  const groupedParticipants = useMemo(() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        whatsapp: string;
        totalSubmissions: number;
        eligibleCount: number;
        paidCount: number;
        pendingCount: number;
        totalAppreciationRp: number;
        latestSubmittedAt: string;
      }
    >();

    responses.forEach((r) => {
      const emailKey = r.respondentEmail.trim().toLowerCase();
      const existing = map.get(emailKey);
      const isEligible = r.rewardEligibleStatus === 'eligible';
      const isPaid = r.rewardEligibleStatus === 'paid';
      const isPending = r.rewardEligibleStatus === 'pending_review';
      const addRp = isEligible || isPaid ? 1500 : 0;

      if (!existing) {
        map.set(emailKey, {
          email: emailKey,
          name: r.respondentName,
          whatsapp: r.respondentWhatsapp,
          totalSubmissions: 1,
          eligibleCount: isEligible ? 1 : 0,
          paidCount: isPaid ? 1 : 0,
          pendingCount: isPending ? 1 : 0,
          totalAppreciationRp: addRp,
          latestSubmittedAt: r.submittedAtLabel || r.visitDate,
        });
      } else {
        existing.totalSubmissions += 1;
        if (isEligible) existing.eligibleCount += 1;
        if (isPaid) existing.paidCount += 1;
        if (isPending) existing.pendingCount += 1;
        existing.totalAppreciationRp += addRp;
      }
    });

    const list = Array.from(map.values());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.whatsapp.toLowerCase().includes(q)
    );
  }, [responses, searchQuery]);

  const handleUpdateStatus = async (
    resp: SurveyResponse,
    nextStatus: RewardEligibleStatus
  ) => {
    setUpdatingId(resp.id);
    const notesValue = notesDraft[resp.id] ?? resp.adminNotes ?? '';
    const payoutValue = payoutRefDraft[resp.id] ?? resp.payoutReference ?? '';
    try {
      await updateSurveyResponseStatus({
        response: resp,
        rewardEligibleStatus: nextStatus,
        adminNotes: notesValue,
        payoutReference: payoutValue,
      });
      showToast(
        `Status pengajuan ${resp.participationCode || resp.respondentName} diperbarui ke "${REWARD_STATUS_LABELS[nextStatus]}".`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memperbarui status pengajuan.',
        'error'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isBootstrappedAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          Akses Terbatas Admin Utama
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
          Demi menjaga kerahasiaan data pribadi peserta (email dan nomor WhatsApp), daftar pengajuan survei dan verifikasi penyaluran apresiasi Rp1.500 hanya dapat diakses oleh akun Admin Utama.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Partisipan &amp; Apresiasi Rp1.500
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Kelola data partisipan, verifikasi kelayakan pengajuan survei, dan catat penyaluran apresiasi Rp1.500 tanpa ketergantungan ulasan Google Maps.
        </p>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Partisipan Unik</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {loading ? '—' : stats.uniqueParticipants}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Berdasarkan alamat email peserta
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Menunggu Verifikasi
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-2 tabular-nums">
            {loading ? '—' : stats.pendingCount}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            dari {stats.totalSubmissions} total pengajuan
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Pengajuan Layak &amp; Disalurkan
          </div>
          <div className="text-3xl font-extrabold text-teal-700 mt-2 tabular-nums">
            {loading ? '—' : stats.eligibleOrPaidCount}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {stats.paidCount} pengajuan sudah disalurkan
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Total Apresiasi Terverifikasi
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2 font-mono tabular-nums">
            Rp{stats.totalAppreciationRp.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            Sudah disalurkan: Rp{stats.disbursedRp.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Peringatan Kepatuhan */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <Award className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
          <strong className="font-semibold">Prinsip Verifikasi:</strong>{' '}
          Penilaian kelayakan apresiasi Rp1.500 hanya berdasarkan keaslian dan kelengkapan pengalaman kunjungan di formulir survei internal—tidak boleh mensyaratkan rating atau publikasi ulasan Google Maps.
        </p>
      </div>

      {/* Filter & Toggle Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
                activeTab === 'submissions'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Pengajuan &amp; Apresiasi ({responses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('participants')}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
                activeTab === 'participants'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Data Partisipan ({stats.uniqueParticipants})
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'submissions'
                  ? 'Cari kode PR-..., nama peserta, email, atau nama bisnis...'
                  : 'Cari nama, email, atau nomor WhatsApp partisipan...'
              }
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          {activeTab === 'submissions' && (
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | RewardEligibleStatus)
              }
              aria-label="Filter status apresiasi"
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Konten Tab */}
      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat data partisipan dan pengajuan survei...
        </div>
      ) : activeTab === 'submissions' ? (
        filteredResponses.length === 0 ? (
          <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
            Tidak ada pengajuan survei yang sesuai filter pencarian.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResponses.map((resp) => {
              const currentNotes = notesDraft[resp.id] ?? resp.adminNotes ?? '';
              const currentPayoutRef =
                payoutRefDraft[resp.id] ?? resp.payoutReference ?? '';
              const isBusy = updatingId === resp.id;

              return (
                <div
                  key={resp.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {resp.participationCode && (
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md tabular-nums">
                            {resp.participationCode}
                          </span>
                        )}
                        <span className="text-slate-500">
                          {resp.submittedAtLabel || `Kunjungan ${resp.visitDate}`}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {resp.respondentName}{' '}
                        <span className="font-normal text-slate-600">
                          · {resp.businessName}
                        </span>
                      </h3>
                      <div className="text-xs sm:text-sm text-slate-600">
                        {resp.respondentEmail} · WA: {resp.respondentWhatsapp} ·
                        Tanggal kunjungan: {resp.visitDate}
                      </div>
                    </div>

                    <div className="text-left lg:text-right shrink-0">
                      <div
                        className={`text-xs sm:text-sm font-bold ${
                          resp.rewardEligibleStatus === 'paid'
                            ? 'text-emerald-700'
                            : resp.rewardEligibleStatus === 'eligible'
                            ? 'text-teal-800'
                            : resp.rewardEligibleStatus === 'not_eligible'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {REWARD_STATUS_LABELS[resp.rewardEligibleStatus]}
                      </div>
                      {resp.paidAtLabel && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Disalurkan: {resp.paidAtLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-xs font-semibold text-slate-500">
                      {resp.surveyTitle}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                      {resp.experienceFeedback}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Referensi Penyaluran Rp1.500 (E-Wallet / Transfer)
                      </label>
                      <input
                        type="text"
                        maxLength={160}
                        value={currentPayoutRef}
                        onChange={(e) =>
                          setPayoutRefDraft((prev) => ({
                            ...prev,
                            [resp.id]: e.target.value,
                          }))
                        }
                        placeholder="Contoh: DANA-0812xxx / Ref #8821"
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Catatan Admin untuk Peserta
                      </label>
                      <input
                        type="text"
                        maxLength={500}
                        value={currentNotes}
                        onChange={(e) =>
                          setNotesDraft((prev) => ({
                            ...prev,
                            [resp.id]: e.target.value,
                          }))
                        }
                        placeholder="Catatan verifikasi atau alasan status..."
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {(
                      [
                        'pending_review',
                        'eligible',
                        'paid',
                        'not_eligible',
                      ] as const
                    ).map((st) => {
                      const active = resp.rewardEligibleStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleUpdateStatus(resp, st)}
                          className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-slate-900 text-white'
                              : st === 'paid'
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : st === 'eligible'
                              ? 'border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {REWARD_STATUS_LABELS[st]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : groupedParticipants.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
          Belum ada data partisipan yang cocok dengan pencarian Anda.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3.5 px-5">Nama Partisipan</th>
                  <th className="py-3.5 px-4">Kontak</th>
                  <th className="py-3.5 px-4 text-right">Pengajuan</th>
                  <th className="py-3.5 px-4 text-right">Layak / Disalurkan</th>
                  <th className="py-3.5 px-5 text-right">Total Apresiasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {groupedParticipants.map((p) => (
                  <tr key={p.email} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.latestSubmittedAt}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div>{p.email}</div>
                      <div className="font-mono mt-0.5">{p.whatsapp}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                      {p.totalSubmissions}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-700 tabular-nums">
                      {p.eligibleCount + p.paidCount} ({p.paidCount} dibayar)
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                      Rp{p.totalAppreciationRp.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
