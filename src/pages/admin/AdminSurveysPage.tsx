import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Edit3,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastContext';
import {
  createSurveyCampaign,
  deleteSurveyCampaign,
  seedDefaultSurvey,
  subscribeAdminSurveyResponses,
  subscribeAdminSurveys,
  updateSurveyCampaign,
  updateSurveyResponseStatus,
} from '../../services/portalService';
import {
  LIMITS,
  REWARD_STATUS_LABELS,
  type RewardEligibleStatus,
  type SurveyCampaign,
  type SurveyResponse,
} from '../../types';
import { useAdminContext } from './AdminLayout';

export function AdminSurveysPage() {
  const { user, isBootstrappedAdmin } = useAdminContext();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'responses'>('campaigns');
  const [surveys, setSurveys] = useState<SurveyCampaign[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyCampaign | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [compensationAmount, setCompensationAmount] = useState(1500);
  const [eligibilityRule, setEligibilityRule] = useState(
    'Kompensasi riset Rp1.500 hanya untuk pengisian survei internal lengkap yang memenuhi syarat, tidak bergantung pada rating atau ulasan Google.'
  );
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SurveyCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingResponseId, setUpdatingResponseId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubSurveys = subscribeAdminSurveys(user.uid, user.email, (list) => {
      setSurveys(list);
      setLoading(false);
    });
    let unsubResponses: (() => void) | undefined;
    if (isBootstrappedAdmin) {
      unsubResponses = subscribeAdminSurveyResponses(setResponses);
    }
    return () => {
      unsubSurveys();
      if (unsubResponses) unsubResponses();
    };
  }, [user.uid, user.email, isBootstrappedAdmin]);

  const openCreate = () => {
    setEditingSurvey(null);
    setTitle('');
    setDescription('');
    setQuestionPrompt('');
    setCompensationAmount(1500);
    setEligibilityRule(
      'Kompensasi riset Rp1.500 hanya untuk pengisian survei internal lengkap yang memenuhi syarat, tidak bergantung pada rating atau ulasan Google.'
    );
    setIsActive(true);
    setShowForm(true);
  };

  const openEdit = (s: SurveyCampaign) => {
    setEditingSurvey(s);
    setTitle(s.title);
    setDescription(s.description);
    setQuestionPrompt(s.questionPrompt);
    setCompensationAmount(s.compensationAmount);
    setEligibilityRule(s.eligibilityRule);
    setIsActive(s.isActive);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !questionPrompt.trim()) {
      showToast('Judul, deskripsi, dan pertanyaan survei wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        questionPrompt: questionPrompt.trim(),
        compensationAmount: Math.max(0, Math.min(1500, Number(compensationAmount) || 0)),
        eligibilityRule: eligibilityRule.trim(),
        isActive,
      };
      if (editingSurvey) {
        await updateSurveyCampaign(editingSurvey.id, payload);
        showToast('Program survei internal berhasil diperbarui.');
      } else {
        await createSurveyCampaign(payload);
        showToast('Program survei internal baru berhasil dibuat.');
      }
      setShowForm(false);
      setEditingSurvey(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyimpan program survei.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSurvey = async () => {
    setSeeding(true);
    try {
      await seedDefaultSurvey();
      showToast('Program survei riset pengalaman pelanggan Rp1.500 berhasil dibuat.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membuat survei bawaan.',
        'error'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSurveyCampaign(deleteTarget.id);
      showToast(`Survei "${deleteTarget.title}" dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menghapus survei.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleChangeResponseStatus = async (
    resp: SurveyResponse,
    status: RewardEligibleStatus
  ) => {
    setUpdatingResponseId(resp.id);
    try {
      await updateSurveyResponseStatus({
        response: resp,
        rewardEligibleStatus: status,
        adminNotes: resp.adminNotes || '',
        payoutReference: resp.payoutReference || '',
      });
      showToast(`Status kelayakan riset ${resp.respondentName} diperbarui.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memperbarui status survei.',
        'error'
      );
    } finally {
      setUpdatingResponseId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Program Survei Partisipasi
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Kelola daftar program survei pada halaman /program-partisipasi beserta ketentuan apresiasi Rp1.500.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/partisipan"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50"
          >
            <Users className="w-4 h-4 text-teal-700" />
            Kelola Partisipan &amp; Apresiasi
          </Link>
          {surveys.length === 0 && !loading && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedSurvey}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              {seeding ? 'Membuat...' : 'Buat Survei Bawaan Rp1.500'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Buat Program Survei
          </button>
        </div>
      </div>

      {/* Peringatan Kepatuhan */}
      <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-teal-950 leading-relaxed">
          <strong className="font-semibold">Kepatuhan Kebijakan:</strong> Kompensasi riset maksimal Rp1.500 hanya diberikan untuk kelengkapan data riset pengalaman internal—tidak boleh bergantung pada pemberian ulasan atau rating tertentu di Google Maps.
        </p>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
            activeTab === 'campaigns'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Program Survei ({surveys.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('responses')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
            activeTab === 'responses'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Respons Masuk ({responses.length})
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            {editingSurvey ? 'Edit Program Survei' : 'Tambah Program Survei Internal'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Judul Program Survei *
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.SURVEY_TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Survei Riset Pengalaman Layanan Pelanggan"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deskripsi Survei *
              </label>
              <textarea
                rows={2}
                required
                maxLength={LIMITS.SURVEY_DESC_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pertanyaan Panduan untuk Responden *
              </label>
              <textarea
                rows={2}
                required
                maxLength={LIMITS.SURVEY_PROMPT_MAX}
                value={questionPrompt}
                onChange={(e) => setQuestionPrompt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kompensasi Riset (Rp, Maks 1500)
              </label>
              <input
                type="number"
                min={0}
                max={1500}
                value={compensationAmount}
                onChange={(e) =>
                  setCompensationAmount(Math.min(1500, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span className="text-sm font-medium text-slate-800">
                  Aktifkan di halaman /program-partisipasi
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Aturan Kelayakan Responden *
              </label>
              <textarea
                rows={2}
                required
                maxLength={LIMITS.SURVEY_RULE_MAX}
                value={eligibilityRule}
                onChange={(e) => setEligibilityRule(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Program Survei'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'campaigns' ? (
        loading ? (
          <div className="p-6 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
            Memuat program survei...
          </div>
        ) : surveys.length === 0 ? (
          <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
            <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600">
              Belum ada program survei internal. Klik tombol Buat Survei Bawaan Rp1.500 di atas untuk memulai.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surveys.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-teal-800 tabular-nums">
                    Kompensasi Riset: Rp{s.compensationAmount.toLocaleString('id-ID')}
                  </span>
                  <span className={s.isActive ? 'text-teal-700 font-semibold' : 'text-slate-500'}>
                    {s.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed flex-1">
                  {s.description}
                </p>
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  {s.eligibilityRule}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    aria-label={`Hapus ${s.title}`}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : responses.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
          Belum ada respons survei pelanggan internal yang masuk.
        </div>
      ) : (
        <div className="space-y-4">
          {responses.map((resp) => (
            <div
              key={resp.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {resp.respondentName} ·{' '}
                    <span className="font-normal text-slate-600">{resp.businessName}</span>
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {resp.respondentEmail} · {resp.respondentWhatsapp} · Kunjungan: {resp.visitDate}
                  </div>
                </div>
                <span className="text-xs font-bold text-teal-800 whitespace-nowrap">
                  {REWARD_STATUS_LABELS[resp.rewardEligibleStatus]}
                </span>
              </div>

              <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 leading-relaxed">
                {resp.experienceFeedback}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  ['eligible', 'not_eligible', 'paid'] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={updatingResponseId === resp.id || resp.rewardEligibleStatus === st}
                    onClick={() => handleChangeResponseStatus(resp, st)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                      resp.rewardEligibleStatus === st
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {REWARD_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Program Survei?"
        message={`Program "${deleteTarget?.title}" akan dihapus.`}
        confirmLabel="Ya, Hapus"
        isDanger
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
