import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  History,
  MapPin,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../components/ToastContext';
import {
  getLocalParticipationHistory,
  lookupParticipationStatusAndHistory,
  submitSurveyResponse,
  subscribeActiveBusinesses,
  subscribeActiveSurveys,
  subscribePortalSettings,
  type SubmitSurveyResult,
} from '../services/portalService';
import {
  type Business,
  DEFAULT_PORTAL_SETTINGS,
  LIMITS,
  type LocalParticipationRecord,
  type ParticipationStatusItem,
  type PortalSettings,
  REWARD_STATUS_LABELS,
  type RewardEligibleStatus,
  type SurveyCampaign,
} from '../types';

function getRewardStatusVisual(status: RewardEligibleStatus) {
  switch (status) {
    case 'paid':
      return {
        boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        labelClass: 'text-emerald-700',
        summary: 'Apresiasi survei Rp1.500 telah disalurkan oleh admin.',
      };
    case 'eligible':
      return {
        boxClass: 'bg-teal-50 border-teal-200 text-teal-950',
        labelClass: 'text-teal-800',
        summary: 'Pengajuan dinyatakan memenuhi syarat dan masuk antrean penyaluran Rp1.500.',
      };
    case 'not_eligible':
      return {
        boxClass: 'bg-red-50 border-red-200 text-red-950',
        labelClass: 'text-red-700',
        summary: 'Pengajuan belum memenuhi ketentuan kelengkapan verifikasi survei.',
      };
    default:
      return {
        boxClass: 'bg-amber-50 border-amber-200 text-amber-950',
        labelClass: 'text-amber-800',
        summary: 'Pengajuan telah diterima dan sedang diverifikasi oleh tim admin.',
      };
  }
}

export function SurveyPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [surveys, setSurveys] = useState<SurveyCampaign[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [customBusinessName, setCustomBusinessName] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [respondentWhatsapp, setRespondentWhatsapp] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [experienceFeedback, setExperienceFeedback] = useState('');
  const [consentIndependent, setConsentIndependent] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitResult, setSubmitResult] = useState<SubmitSurveyResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // State Cek Status Pengajuan, Riwayat Partisipasi & Apresiasi Rp1.500
  const [lookupEmail, setLookupEmail] = useState(searchParams.get('email') ?? '');
  const [lookupCode, setLookupCode] = useState(
    searchParams.get('kode')?.toUpperCase() ?? ''
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResults, setLookupResults] = useState<ParticipationStatusItem[]>([]);
  const [localHistory, setLocalHistory] = useState<LocalParticipationRecord[]>(() =>
    getLocalParticipationHistory()
  );

  useEffect(() => {
    const unsubSettings = subscribePortalSettings(setSettings);
    const unsubSurveys = subscribeActiveSurveys((list) => {
      setSurveys(list);
      setLoading(false);
    });
    const unsubBiz = subscribeActiveBusinesses((list) => {
      setBusinesses(list);
    });
    return () => {
      unsubSettings();
      unsubSurveys();
      unsubBiz();
    };
  }, []);

  useEffect(() => {
    if (!selectedSurveyId && surveys.length > 0) {
      setSelectedSurveyId(surveys[0].id);
    }
  }, [surveys, selectedSurveyId]);

  useEffect(() => {
    const lokasiParam = searchParams.get('lokasi');
    if (lokasiParam && businesses.some((b) => b.id === lokasiParam)) {
      setSelectedBusinessId(lokasiParam);
    }
  }, [searchParams, businesses]);

  useEffect(() => {
    if (location.hash === '#riwayat') {
      const el = document.getElementById('riwayat');
      if (el) {
        window.setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }, [location.hash]);

  const activeSurvey =
    surveys.find((s) => s.id === selectedSurveyId) ?? surveys[0] ?? null;

  const selectedBizObj = businesses.find((b) => b.id === selectedBusinessId) ?? null;

  const performLookup = async (emailVal: string, codeVal: string) => {
    setLookupError('');
    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanCode = codeVal.trim().toUpperCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setLookupError('Masukkan alamat Email yang digunakan saat mengisi survei.');
      return;
    }
    if (!/^PR-[A-Z0-9-]{4,28}$/.test(cleanCode)) {
      setLookupError('Masukkan Kode Partisipasi yang valid (contoh: PR-20261118-A1B2).');
      return;
    }

    const matchingLocalCodes = localHistory
      .filter((item) => item.email.toLowerCase() === cleanEmail)
      .map((item) => item.participationCode);

    setLookupLoading(true);
    try {
      const items = await lookupParticipationStatusAndHistory({
        email: cleanEmail,
        participationCode: cleanCode,
        additionalCodes: matchingLocalCodes,
      });
      setLookupResults(items);
    } catch (err) {
      setLookupResults([]);
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Data partisipasi tidak ditemukan. Periksa kembali Email dan Kode Partisipasi Anda.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    const em = searchParams.get('email');
    const kd = searchParams.get('kode');
    if (em && kd) {
      void performLookup(em, kd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelectSurveyCard = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    const formEl = document.getElementById('form-survei');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey || submitting) return;
    setErrorMsg('');

    const finalBizName = selectedBizObj
      ? selectedBizObj.name
      : customBusinessName.trim();

    if (!finalBizName) {
      setErrorMsg('Pilih atau tuliskan nama lokasi bisnis yang Anda kunjungi.');
      return;
    }
    if (respondentName.trim().length < 2) {
      setErrorMsg('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(respondentEmail.trim())) {
      setErrorMsg('Masukkan alamat email yang valid.');
      return;
    }
    if (respondentWhatsapp.replace(/\D/g, '').length < 8) {
      setErrorMsg('Masukkan nomor WhatsApp yang valid.');
      return;
    }
    if (!visitDate) {
      setErrorMsg('Pilih tanggal kunjungan Anda.');
      return;
    }
    if (experienceFeedback.trim().length < 20) {
      setErrorMsg(
        'Tuliskan pengalaman kunjungan Anda secara lengkap (minimal 20 karakter).'
      );
      return;
    }
    if (!consentIndependent) {
      setErrorMsg(
        'Centang persetujuan bahwa survei ini murni riset internal dan terpisah penuh dari ulasan Google Maps.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const cleanEmail = respondentEmail.trim().toLowerCase();
      const result = await submitSurveyResponse({
        surveyId: activeSurvey.id,
        surveyTitle: activeSurvey.title,
        businessId: selectedBizObj?.id,
        businessName: finalBizName,
        respondentName: respondentName.trim(),
        respondentEmail: cleanEmail,
        respondentWhatsapp: respondentWhatsapp.trim(),
        visitDate,
        experienceFeedback: experienceFeedback.trim(),
        consentIndependentFromGoogle: true,
        compensationAmount: activeSurvey.compensationAmount ?? 1500,
        website: honeypot,
      });

      setSubmitResult(result);
      setLocalHistory(getLocalParticipationHistory());
      setLookupEmail(cleanEmail);
      setLookupCode(result.participationCode);
      showToast('Jawaban survei berhasil dikirim! Simpan Kode Partisipasi Anda.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal mengirimkan jawaban survei.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async (codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2500);
      showToast('Kode Partisipasi berhasil disalin.');
    } catch {
      showToast('Silakan salin Kode Partisipasi secara manual.', 'info');
    }
  };

  const handleJumpToHistoryWithResult = async () => {
    if (submitResult && respondentEmail) {
      const em = respondentEmail.trim().toLowerCase();
      setLookupEmail(em);
      setLookupCode(submitResult.participationCode);
      const el = document.getElementById('riwayat');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await performLookup(em, submitResult.participationCode);
    }
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLookup(lookupEmail, lookupCode);
  };

  const handleSelectLocalRecord = async (rec: LocalParticipationRecord) => {
    setLookupEmail(rec.email);
    setLookupCode(rec.participationCode);
    await performLookup(rec.email, rec.participationCode);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Header Program Partisipasi */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-1.5">
              Program Utama Portal
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Program Partisipasi &amp; Survei Pelanggan
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              Ikuti survei pengalaman pelanggan, dapatkan apresiasi Rp1.500 untuk pengajuan yang memenuhi syarat, dan pantau status pengajuan Anda tanpa wajib login.
            </p>
          </div>

          <a
            href="#riwayat"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <History className="w-4 h-4 text-teal-700" />
            Cek Status &amp; Riwayat
          </a>
        </section>

        {/* Informasi Apresiasi Rp1.500 & Kepatuhan Kebijakan */}
        <section className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs sm:text-sm text-emerald-950 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              Informasi Apresiasi Survei Rp1.500 &amp; Pemisahan dari Ulasan Google
            </h2>
            <p>
              {settings.surveyCompensationNote ||
                DEFAULT_PORTAL_SETTINGS.surveyCompensationNote}
            </p>
            <p className="text-emerald-900">
              Survei pengalaman pelanggan internal dan aktivitas ulasan Google Maps adalah dua kegiatan yang sepenuhnya terpisah. Peserta dapat menerima apresiasi survei setelah lolos verifikasi admin tanpa kewajiban menulis atau memberi rating di Google Maps.
            </p>
          </div>
        </section>

        {/* Bagian 1: Daftar Survei yang Tersedia & Persyaratan Partisipasi */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                1. Daftar Survei yang Tersedia
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Pilih program survei aktif dan pahami persyaratan partisipasinya sebelum mengisi formulir.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {surveys.length} program aktif
            </span>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
              Memuat daftar survei yang tersedia...
            </div>
          ) : surveys.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">
                Belum Ada Program Survei Aktif Saat Ini
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Pengelola belum membuka program survei baru saat ini. Anda tetap dapat mengecek status pengajuan sebelumnya di bawah atau menjelajahi daftar bisnis.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <Link
                  to="/daftar-bisnis"
                  className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
                >
                  Jelajahi Daftar Bisnis
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {surveys.map((srv) => {
                const isSelected = activeSurvey?.id === srv.id;
                return (
                  <div
                    key={srv.id}
                    className={`bg-white rounded-2xl border p-5 flex flex-col transition-colors ${
                      isSelected
                        ? 'border-teal-700 ring-1 ring-teal-700/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <span className="font-bold text-emerald-700 tabular-nums">
                        Apresiasi: Rp{srv.compensationAmount.toLocaleString('id-ID')}
                      </span>
                      <span className="font-medium text-teal-700">
                        {isSelected ? 'Sedang Dipilih' : 'Tersedia'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{srv.title}</h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {srv.description}
                    </p>

                    <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">
                        Persyaratan Partisipasi:
                      </div>
                      <p className="leading-relaxed">{srv.eligibilityRule}</p>
                      <div className="text-slate-500 pt-1">
                        Panduan Topik: {srv.questionPrompt}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSelectSurveyCard(srv.id)}
                        className={`w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 text-white hover:bg-teal-800'
                            : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected ? 'Isi Formulir Survei Ini' : 'Pilih Program Survei'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bagian 2: Informasi Bisnis Terkait & Formulir Jawaban Survei */}
        {activeSurvey && (
          <section id="form-survei" className="scroll-mt-20 space-y-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                2. Formulir Jawaban Survei
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Lengkapi pengalaman kunjungan nyata Anda. Setelah mengirim, Anda akan mendapatkan Kode Partisipasi unik untuk mengecek status verifikasi &amp; apresiasi Rp1.500.
              </p>
            </div>

            {/* Preview Informasi Bisnis Terkait Survei */}
            {selectedBizObj && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4">
                <div className="w-full sm:w-44 aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <SmartImage
                    src={selectedBizObj.coverImageUrl}
                    alt={`Cover ${selectedBizObj.name}`}
                    fallbackTitle={selectedBizObj.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-xs font-semibold text-teal-700">
                    Informasi Bisnis Terkait Survei · {selectedBizObj.category}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {selectedBizObj.name}
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{selectedBizObj.address}</span>
                  </div>
                  {selectedBizObj.openingHours && (
                    <div className="text-xs text-slate-500 flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{selectedBizObj.openingHours}</span>
                    </div>
                  )}
                </div>
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                  <Link
                    to={`/lokasi/${selectedBizObj.id}`}
                    className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Detail Bisnis
                  </Link>
                  <a
                    href={selectedBizObj.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-teal-700 hover:bg-teal-50 whitespace-nowrap"
                  >
                    Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {submitResult ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Partisipasi Survei Berhasil Dicatat
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      Simpan Kode Partisipasi di bawah ini bersama alamat Email Anda untuk memantau status verifikasi kelayakan apresiasi Rp1.500 kapan saja tanpa perlu login.
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Kode Partisipasi Anda
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                      {submitResult.participationCode}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Dikirim: {submitResult.submittedAtLabel} · Status:{' '}
                      <strong className="text-amber-700 font-semibold">
                        Menunggu Verifikasi
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(submitResult.participationCode)}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-teal-700" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Salin Kode
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleJumpToHistoryWithResult}
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                    Lihat di Status &amp; Riwayat Partisipasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitResult(null);
                      setExperienceFeedback('');
                      setConsentIndependent(false);
                    }}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Isi Survei Bisnis Lain
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5"
              >
                {/* Kolom Honeypot Anti-Spam */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="survey-website">Website</label>
                  <input
                    id="survey-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {surveys.length > 1 && (
                  <div>
                    <label
                      htmlFor="survey-select"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Program Survei Terpilih
                    </label>
                    <select
                      id="survey-select"
                      value={activeSurvey.id}
                      onChange={(e) => setSelectedSurveyId(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      {surveys.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.title} (Apresiasi Rp
                          {srv.compensationAmount.toLocaleString('id-ID')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-900"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="survey-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nama Lengkap *
                    </label>
                    <input
                      id="survey-name"
                      type="text"
                      required
                      maxLength={LIMITS.BOOKING_CUSTOMER_NAME_MAX}
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="survey-email"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Email Peserta *
                    </label>
                    <input
                      id="survey-email"
                      type="email"
                      required
                      maxLength={LIMITS.BOOKING_EMAIL_MAX}
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="survey-wa"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nomor WhatsApp *
                    </label>
                    <input
                      id="survey-wa"
                      type="tel"
                      required
                      maxLength={LIMITS.BOOKING_WHATSAPP_MAX}
                      value={respondentWhatsapp}
                      onChange={(e) => setRespondentWhatsapp(e.target.value)}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="survey-date"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Tanggal Kunjungan *
                    </label>
                    <input
                      id="survey-date"
                      type="date"
                      required
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="survey-biz"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Lokasi Bisnis yang Dikunjungi *
                    </label>
                    {businesses.length > 0 ? (
                      <select
                        id="survey-biz"
                        value={selectedBusinessId}
                        onChange={(e) => setSelectedBusinessId(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      >
                        <option value="">
                          -- Pilih dari daftar bisnis atau tulis manual di bawah --
                        </option>
                        {businesses.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.category})
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {!selectedBusinessId && (
                      <input
                        type="text"
                        required
                        maxLength={LIMITS.BUSINESS_NAME_MAX}
                        value={customBusinessName}
                        onChange={(e) => setCustomBusinessName(e.target.value)}
                        placeholder="Ketik nama lokasi bisnis yang Anda kunjungi..."
                        className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                          businesses.length > 0 ? 'mt-2.5' : ''
                        }`}
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="survey-feedback"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Jawaban Survei &amp; Pengalaman Nyata *
                      </label>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {experienceFeedback.length}/{LIMITS.SURVEY_FEEDBACK_MAX}
                      </span>
                    </div>
                    <textarea
                      id="survey-feedback"
                      rows={5}
                      required
                      maxLength={LIMITS.SURVEY_FEEDBACK_MAX}
                      value={experienceFeedback}
                      onChange={(e) => setExperienceFeedback(e.target.value)}
                      placeholder={activeSurvey.questionPrompt}
                      className="w-full p-3.5 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentIndependent}
                        onChange={(e) => setConsentIndependent(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700 shrink-0"
                      />
                      <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        Saya memahami bahwa survei ini adalah program partisipasi internal yang sepenuhnya terpisah dari ulasan Google Maps, dan apresiasi Rp1.500 (jika memenuhi syarat) tidak mewajibkan saya memberi rating atau ulasan Google.
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 text-white text-base font-bold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Mengirim Jawaban...' : 'Kirim Jawaban Survei'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* Bagian 3: Status Pengajuan, Riwayat Partisipasi & Informasi Apresiasi (Email + Kode Partisipasi tanpa login) */}
        <section id="riwayat" className="scroll-mt-20 space-y-4 pt-4 border-t border-slate-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              3. Status Pengajuan, Riwayat Partisipasi &amp; Apresiasi Rp1.500
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Masukkan <strong>Email</strong> dan <strong>Kode Partisipasi</strong> (contoh:{' '}
              <span className="font-mono">PR-...</span>) tanpa perlu login untuk memeriksa status verifikasi, riwayat partisipasi Anda, dan status penyaluran apresiasi Rp1.500.
            </p>
          </div>

          <form
            onSubmit={handleLookupSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lookup-part-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email Peserta *
                </label>
                <input
                  id="lookup-part-email"
                  type="email"
                  required
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <div>
                <label
                  htmlFor="lookup-part-code"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Kode Partisipasi *
                </label>
                <input
                  id="lookup-part-code"
                  type="text"
                  required
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  placeholder="PR-20261118-A1B2"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>

            {lookupError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-900"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{lookupError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Terlindungi verifikasi kombinasi Email &amp; Kode Partisipasi.</span>
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                {lookupLoading ? 'Memeriksa...' : 'Cek Status & Riwayat'}
              </button>
            </div>
          </form>

          {/* Riwayat Tersimpan di Perangkat Ini */}
          {localHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-600">
                Kode Partisipasi yang baru dikirim dari perangkat ini (ketuk untuk memeriksa):
              </div>
              <div className="flex flex-wrap gap-2">
                {localHistory.slice(0, 6).map((rec) => (
                  <button
                    key={rec.participationCode}
                    type="button"
                    onClick={() => handleSelectLocalRecord(rec)}
                    className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-left text-xs transition-colors cursor-pointer"
                  >
                    <span className="font-mono font-bold text-slate-900">
                      {rec.participationCode}
                    </span>
                    <span className="text-slate-500 truncate max-w-[160px]">
                      · {rec.businessName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hasil Verifikasi Status & Riwayat Partisipasi */}
          {lookupResults.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-600 tabular-nums">
                Ditemukan {lookupResults.length} riwayat partisipasi terverifikasi:
              </div>
              {lookupResults.map((item) => {
                const visual = getRewardStatusVisual(item.rewardEligibleStatus);
                return (
                  <div
                    key={item.participationCode}
                    className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
                  >
                    <div
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${visual.boxClass}`}
                    >
                      <div>
                        <div className="text-xs opacity-80">
                          Status Pengajuan &amp; Apresiasi
                        </div>
                        <div className="text-base sm:text-lg font-extrabold mt-0.5">
                          {REWARD_STATUS_LABELS[item.rewardEligibleStatus] ??
                            item.rewardEligibleStatus}
                        </div>
                        <p className="text-xs sm:text-sm mt-1">{visual.summary}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="text-xs opacity-75">Nominal Program</div>
                        <div className="text-xl font-extrabold font-mono tabular-nums">
                          Rp{item.compensationAmount.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs sm:text-sm">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs text-slate-500">Kode Partisipasi</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                          {item.participationCode}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs text-slate-500">Bisnis Dikunjungi</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {item.businessName}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs text-slate-500">Tanggal Kunjungan</div>
                        <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                          {item.visitDate}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs text-slate-500">Waktu Pengiriman</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {item.submittedAtLabel}
                        </div>
                      </div>
                    </div>

                    {(item.payoutReference || item.adminNotes) && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-1">
                        {item.payoutReference && (
                          <div>
                            <span className="text-slate-500">Referensi Penyaluran:</span>{' '}
                            <strong className="font-mono text-slate-900">
                              {item.payoutReference}
                            </strong>
                          </div>
                        )}
                        {item.adminNotes && (
                          <div>
                            <span className="text-slate-500">Catatan Verifikasi Admin:</span>{' '}
                            <span className="text-slate-800">{item.adminNotes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
