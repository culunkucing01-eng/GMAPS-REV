import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import { SmartImage } from '../components/SmartImage';
import {
  subscribeActiveBusinesses,
  subscribeActiveSurveys,
  subscribePortalSettings,
} from '../services/portalService';
import {
  type Business,
  DEFAULT_PORTAL_SETTINGS,
  type PortalSettings,
  type SurveyCampaign,
} from '../types';

const HERO_IMAGE_PATH = '/src/assets/images/portal_hero_banner_1795007853832.jpg';

export function PublicHomePage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [surveys, setSurveys] = useState<SurveyCampaign[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [loadingBiz, setLoadingBiz] = useState(true);

  useEffect(() => {
    const unsubBiz = subscribeActiveBusinesses(
      (list) => {
        setBusinesses(list);
        setLoadingBiz(false);
      },
      () => {
        setLoadingBiz(false);
      }
    );
    const unsubSurveys = subscribeActiveSurveys(setSurveys);
    const unsubSettings = subscribePortalSettings(setSettings);

    return () => {
      unsubBiz();
      unsubSurveys();
      unsubSettings();
    };
  }, []);

  const featuredBusinesses = businesses.slice(0, 6);
  const featuredSurveys = surveys.slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1">
        {/* 1. Hero Section — Primary: Portal Partisipasi & Survei */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-center">
              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-2.5">
                  Portal Partisipasi &amp; Survei Pengalaman Pelanggan
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-slate-900 tracking-tight leading-[1.15] text-balance mb-4">
                  {settings.welcomeHeadline}
                </h1>

                <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-2xl mb-7">
                  {settings.welcomeSubheadline}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/program-partisipasi"
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-700 text-white text-sm sm:text-base font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
                  >
                    Lihat Program Partisipasi
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/daftar-bisnis"
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm sm:text-base font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    Jelajahi Bisnis
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                  <SmartImage
                    src={HERO_IMAGE_PATH}
                    alt="Portal partisipasi survei pengalaman pelanggan dan direktori bisnis"
                    fallbackTitle={settings.portalName}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Program Apresiasi Survei Rp1.500 (Independen dari Ulasan Google) */}
        <section className="py-10 sm:py-12 bg-slate-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700">
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Program Apresiasi Survei Rp1.500</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Apresiasi Rp1.500 untuk Setiap Survei yang Memenuhi Ketentuan
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {settings.surveyCompensationNote ||
                    DEFAULT_PORTAL_SETTINGS.surveyCompensationNote}
                </p>
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-950">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold">Penegasan Kebijakan:</strong>{' '}
                    Apresiasi tidak diberikan sebagai imbalan untuk ulasan Google. Survei pengalaman pelanggan dan ulasan Google Maps adalah dua aktivitas yang sepenuhnya terpisah.
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <Link
                  to="/program-partisipasi"
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
                >
                  Isi Survei &amp; Cek Apresiasi
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/program-partisipasi#riwayat"
                  className="min-h-[48px] inline-flex items-center justify-center px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Cek Status &amp; Riwayat
                </Link>
              </div>
            </div>

            {featuredSurveys.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredSurveys.map((srv) => (
                  <div
                    key={srv.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <span className="font-semibold text-teal-800">
                        Survei Aktif
                      </span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        Apresiasi Rp{srv.compensationAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {srv.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed flex-1">
                      {srv.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Tanpa wajib ulasan Google
                      </span>
                      <Link
                        to={`/program-partisipasi?survei=${encodeURIComponent(srv.id)}`}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Ikuti Survei
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 3. Ringkasan Cara Berpartisipasi */}
        <section className="py-10 sm:py-12 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Cara Berpartisipasi dalam 4 Langkah
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-1">
                  Cukup lewat smartphone, tanpa perlu membuat akun.
                </p>
              </div>
              <Link
                to="/cara-berpartisipasi"
                className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                Pelajari Ketentuan Lengkap
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-mono font-bold text-teal-700 mb-1.5">
                  01
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  Jelajahi Bisnis
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Temukan informasi bisnis terkurasi admin beserta alamat, jam buka, dan lokasinya.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-mono font-bold text-teal-700 mb-1.5">
                  02
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  Isi Survei Nyata
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Bagikan pengalaman kunjungan asli Anda melalui formulir survei pengalaman pelanggan.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-mono font-bold text-teal-700 mb-1.5">
                  03
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  Simpan Kode Partisipasi
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Dapatkan Kode Partisipasi untuk memantau status pengajuan dan riwayat verifikasi Anda.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="text-xs font-mono font-bold text-teal-700 mb-1.5">
                  04
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  Verifikasi Apresiasi Rp1.500
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Pengajuan yang memenuhi ketentuan berhak atas apresiasi survei Rp1.500, terpisah dari Google Maps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Pratinjau Daftar Bisnis (Dikelola Penuh oleh Admin) */}
        <section className="py-10 sm:py-12 bg-slate-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Daftar Bisnis Terkurasi Admin
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-1">
                  Informasi lokasi usaha resmi yang dikelola dan diperbarui langsung oleh tim admin.
                </p>
              </div>
              <Link
                to="/daftar-bisnis"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Store className="w-4 h-4 text-teal-700" />
                Jelajahi Semua Bisnis
              </Link>
            </div>

            {loadingBiz ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white animate-pulse"
                  >
                    <div className="aspect-[16/9] bg-slate-200" />
                    <div className="p-5 space-y-3">
                      <div className="h-3 w-24 bg-slate-200 rounded" />
                      <div className="h-5 w-3/4 bg-slate-200 rounded" />
                      <div className="h-4 w-full bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredBusinesses.length === 0 ? (
              <div className="border border-slate-200 rounded-2xl bg-white p-8 text-center max-w-xl mx-auto">
                <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Daftar Bisnis Sedang Disiapkan Admin
                </h3>
                <p className="text-sm text-slate-600">
                  Informasi bisnis terverifikasi akan segera ditampilkan di sini oleh pengelola portal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredBusinesses.map((biz, idx) => (
                  <article
                    key={biz.id}
                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white flex flex-col hover:border-slate-300 transition-colors"
                  >
                    <Link
                      to={`/lokasi/${biz.id}`}
                      className="block aspect-[16/9] w-full bg-slate-100 border-b border-slate-100 overflow-hidden"
                    >
                      <SmartImage
                        src={biz.coverImageUrl}
                        alt={`Foto cover ${biz.name}`}
                        fallbackTitle={biz.name}
                        className="w-full h-full object-cover"
                        loading={idx < 3 ? 'eager' : 'lazy'}
                      />
                    </Link>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-1.5">
                        <span className="font-semibold text-teal-800">
                          {biz.category}
                        </span>
                        {biz.openingHours && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              {biz.openingHours}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                        {biz.name}
                      </h3>

                      <p className="text-sm text-slate-600 flex items-start gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{biz.address}</span>
                      </p>

                      <div className="mt-auto pt-2 flex items-center gap-2">
                        <Link
                          to={`/lokasi/${biz.id}`}
                          className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
                        >
                          Lihat Detail
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                          href={biz.googleReviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Buka Google Maps ${biz.name}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                          title="Buka Google Maps"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. Kebijakan Kepatuhan & Layanan Sekunder Pemilik Usaha */}
        <section className="py-10 sm:py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-7 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Komitmen Kepatuhan Kebijakan Google Maps
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {settings.reviewEthicsNote}
                </p>
              </div>
            </div>

            {/* Secondary Service Block for Business Owners (Calm, Non-Dominant) */}
            <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Untuk Pemilik Usaha · Layanan Sekunder
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Butuh Bantuan Mengelola Google Maps Bisnis Anda?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Tersedia layanan audit profil, optimasi informasi bisnis, pembaruan foto, dan konsultasi Google Business Profile.
                  </p>
                </div>
              </div>

              <Link
                to="/booking"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                Lihat Booking Jasa
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
