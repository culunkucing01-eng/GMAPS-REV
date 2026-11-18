import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Info,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  saveBusinessGuides,
  subscribeAdminGuides,
} from '../services/portalService';
import {
  DEFAULT_GUIDE_TEMPLATES,
  type GuideDraft,
  LIMITS,
} from '../types';
import { useToast } from './ToastContext';

interface ExperienceGuidesEditorProps {
  businessId: string;
  businessName: string;
  uid: string;
  email: string | null | undefined;
}

export function ExperienceGuidesEditor({
  businessId,
  businessName,
  uid,
  email,
}: ExperienceGuidesEditorProps) {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<GuideDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAdminGuides(businessId, uid, email, (list) => {
      if (list.length > 0) {
        setDrafts(
          list.map((g, idx) => ({
            id: g.id,
            title: g.title,
            question: g.question,
            order: idx + 1,
            isActive: g.isActive,
          }))
        );
      } else {
        setDrafts(
          DEFAULT_GUIDE_TEMPLATES.map((g, idx) => ({
            ...g,
            order: idx + 1,
          }))
        );
      }
      setLoading(false);
    });
    return () => unsub();
  }, [businessId, uid, email]);

  const handleFieldChange = (
    index: number,
    field: 'title' | 'question' | 'isActive',
    value: string | boolean
  ) => {
    setDrafts((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= drafts.length) return;
    setDrafts((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const handleAddGuide = () => {
    if (drafts.length >= LIMITS.MAX_GUIDES) {
      showToast(
        `Maksimal ${LIMITS.MAX_GUIDES} pilihan panduan untuk setiap lokasi bisnis.`,
        'info'
      );
      return;
    }
    setDrafts((prev) => [
      ...prev,
      {
        title: '',
        question: '',
        order: prev.length + 1,
        isActive: true,
      },
    ]);
  };

  const handleRemoveGuide = (index: number) => {
    if (drafts.length <= LIMITS.MIN_GUIDES) {
      showToast(
        `Minimal harus ada ${LIMITS.MIN_GUIDES} pilihan panduan.`,
        'info'
      );
      return;
    }
    setDrafts((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, order: idx + 1 }))
    );
  };

  const handleResetTemplates = () => {
    setDrafts((prev) =>
      DEFAULT_GUIDE_TEMPLATES.map((tpl, idx) => ({
        id: prev[idx]?.id,
        title: tpl.title,
        question: tpl.question,
        order: idx + 1,
        isActive: true,
      }))
    );
    showToast('7 contoh panduan standar dimuat. Jangan lupa tekan Simpan Panduan.', 'info');
  };

  const handleSave = async () => {
    if (drafts.length < LIMITS.MIN_GUIDES || drafts.length > LIMITS.MAX_GUIDES) {
      showToast(
        `Jumlah panduan harus antara ${LIMITS.MIN_GUIDES} sampai ${LIMITS.MAX_GUIDES} pilihan.`,
        'error'
      );
      return;
    }

    for (let i = 0; i < drafts.length; i++) {
      if (!drafts[i].title.trim() || !drafts[i].question.trim()) {
        showToast(
          `Panduan urutan ke-${i + 1} wajib diisi judul dan pertanyaannya.`,
          'error'
        );
        return;
      }
    }

    setSaving(true);
    try {
      await saveBusinessGuides(businessId, drafts);
      showToast(`Panduan Menulis Pengalaman untuk ${businessName} berhasil disimpan.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyimpan panduan pengalaman.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-2xl animate-pulse space-y-3">
        <div className="h-5 w-60 bg-slate-200 rounded" />
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Panduan Menulis Pengalaman
          </h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Atur {LIMITS.MIN_GUIDES} sampai {LIMITS.MAX_GUIDES} topik pertanyaan untuk membantu pengunjung{' '}
            <strong className="font-semibold text-slate-800">{businessName}</strong> menulis ceritanya sendiri.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetTemplates}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Muat 7 Contoh Standar
          </button>

          <button
            type="button"
            onClick={handleAddGuide}
            disabled={drafts.length >= LIMITS.MAX_GUIDES}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Topik ({drafts.length}/{LIMITS.MAX_GUIDES})
          </button>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
        <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <span>
          Gunakan pertanyaan netral yang memancing cerita asli pengunjung. Hindari membuat kalimat ulasan siap-salin atau mengarahkan pemberian bintang tertentu.
        </span>
      </div>

      <div className="space-y-4">
        {drafts.map((guide, index) => (
          <div
            key={guide.id ?? `draft-${index}`}
            className={`border rounded-xl p-4 transition-colors ${
              guide.isActive
                ? 'border-slate-200 bg-white'
                : 'border-slate-200 bg-slate-50/70 opacity-85'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 tabular-nums">
                <span>Urutan {index + 1}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    guide.isActive ? 'text-teal-700' : 'text-slate-500'
                  }
                >
                  {guide.isActive ? 'Aktif ditampilkan' : 'Nonaktif'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  title="Naikkan urutan"
                  aria-label={`Naikkan urutan panduan ${index + 1}`}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === drafts.length - 1}
                  title="Turunkan urutan"
                  aria-label={`Turunkan urutan panduan ${index + 1}`}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange(index, 'isActive', !guide.isActive)
                  }
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    guide.isActive
                      ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {guide.isActive ? 'Aktif' : 'Nonaktif'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveGuide(index)}
                  disabled={drafts.length <= LIMITS.MIN_GUIDES}
                  title="Hapus panduan"
                  aria-label={`Hapus panduan ${index + 1}`}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-35 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Panduan
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.GUIDE_TITLE_MAX}
                  value={guide.title}
                  onChange={(e) =>
                    handleFieldChange(index, 'title', e.target.value)
                  }
                  placeholder="Misalnya: Pengalaman pelayanan"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi atau Pertanyaan Panduan
                </label>
                <textarea
                  rows={2}
                  maxLength={LIMITS.GUIDE_QUESTION_MAX}
                  value={guide.question}
                  onChange={(e) =>
                    handleFieldChange(index, 'question', e.target.value)
                  }
                  placeholder="Misalnya: Bagaimana keramahan dan kecepatan staf saat melayani Anda?"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <span className="text-xs text-slate-500 tabular-nums">
          Total {drafts.length} pilihan panduan (ketentuan: {LIMITS.MIN_GUIDES}–{LIMITS.MAX_GUIDES} pilihan)
        </span>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Panduan'}
        </button>
      </div>
    </div>
  );
}
