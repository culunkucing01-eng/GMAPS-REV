import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Info,
  MapPin,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../components/ToastContext';
import {
  getBusinessById,
  recordVisitEvent,
  subscribeActiveGuides,
  subscribeGallery,
  subscribePortalSettings,
} from '../services/portalService';
import {
  type Business,
  DEFAULT_PORTAL_SETTINGS,
  type ExperienceGuide,
  type GalleryItem,
  type PortalSettings,
} from '../types';

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [business, setBusiness] = useState<Business | null>(null);
  const [guides, setGuides] = useState<ExperienceGuide[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [copiedGuideId, setCopiedGuideId] = useState<string | null>(null);
  const [experienceText, setExperienceText] = useState('');
  const [copiedMyText, setCopiedMyText] = useState(false);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  const trackedVisitRef = useRef<string | null>(null);
  const isFromQr = searchParams.get('sumber') === 'qr';

  useEffect(() => {
    const unsubSettings = subscribePortalSettings(setSettings);
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getBusinessById(id)
      .then((biz) => {
        if (cancelled) return;
        if (!biz || !biz.isActive) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setBusiness(biz);
        setLoading(false);

        if (trackedVisitRef.current !== biz.id) {
          trackedVisitRef.current = biz.id;
          void recordVisitEvent(
            biz.id,
            biz.createdBy,
            isFromQr ? 'qr_scan' : 'page_view',
            isFromQr ? 'qr' : 'portal'
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });

    const unsubGuides = subscribeActiveGuides(id, (list) => {
      if (!cancelled) setGuides(list);
    });
    const unsubGallery = subscribeGallery(id, (list) => {
      if (!cancelled) setGallery(list);
    });

    return () => {
      cancelled = true;
      unsubGuides();
      unsubGallery();
    };
  }, [id, isFromQr]);

  const charCount = experienceText.length;
  const wordCount = useMemo(() => {
    const trimmed = experienceText.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [experienceText]);

  const selectedGuide = useMemo(
    () => guides.find((g) => g.id === selectedGuideId) ?? null,
    [guides, selectedGuideId]
  );

  const handleSelectGuide = (guide: ExperienceGuide) => {
    setSelectedGuideId((prev) => (prev === guide.id ? null : guide.id));
  };

  const handleCopyGuideText = async (guide: ExperienceGuide) => {
    const textToCopy = `${guide.title}: ${guide.question}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setSelectedGuideId(guide.id);
      setCopiedGuideId(guide.id);
      window.setTimeout(() => {
        setCopiedGuideId((cur) => (cur === guide.id ? null : cur));
      }, 2500);
      showToast('Poin panduan berhasil disalin sebagai pengingat.');
      if (business) {
        void recordVisitEvent(
          business.id,
          business.createdBy,
          'copy_text',
          isFromQr ? 'qr' : 'portal'
        );
      }
    } catch {
      showToast(
        'Browser tidak mengizinkan salin otomatis. Silakan salin secara manual.',
        'error'
      );
    }
  };

  const handleCopyMyText = async () => {
    const trimmed = experienceText.trim();
    if (!trimmed) {
      showToast(
        'Tuliskan pengalaman pribadi Anda terlebih dahulu sebelum menyalin.',
        'info'
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(experienceText);
      setCopiedMyText(true);
      window.setTimeout(() => setCopiedMyText(false), 2500);
      showToast(
        'Tulisan Anda berhasil disalin! Silakan buka Google Review untuk menempelkan ulasan Anda.'
      );
      if (business) {
        void recordVisitEvent(
          business.id,
          business.createdBy,
          'copy_text',
          isFromQr ? 'qr' : 'portal'
        );
      }
    } catch {
      showToast(
        'Browser tidak mengizinkan salin otomatis. Anda dapat memilih teks lalu menyalinnya secara manual.',
        'error'
      );
    }
  };

  const handleClearText = () => {
    if (!experienceText) return;
    setExperienceText('');
    setCopiedMyText(false);
    showToast('Kolom tulisan telah dibersihkan.', 'info');
  };

  const handleDownloadPromoImage = async (item: GalleryItem) => {
    try {
      const response = await fetch(item.imageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      link.href = objectUrl;
      link.download = `promosi-${safeName || 'gambar'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      showToast('Gambar promosi berhasil diunduh.');
    } catch {
      const link = document.createElement('a');
      link.href = item.imageUrl;
      link.download = `promosi-${item.id}.jpg`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Membuka gambar promosi untuk disimpan.');
    }
  };

  const handleTrackOpenMaps = () => {
    if (business) {
      void recordVisitEvent(
        business.id,
        business.createdBy,
        'open_maps',
        isFromQr ? 'qr' : 'portal'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
          <div className="h-10 w-40 bg-slate-200 rounded-xl" />
          <div className="aspect-[16/9] bg-slate-200 rounded-2xl" />
          <div className="h-40 bg-white border border-slate-200 rounded-2xl" />
          <div className="h-56 bg-white border border-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Lokasi Bisnis Tidak Tersedia
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Lokasi yang Anda cari tidak ditemukan atau sedang dinonaktifkan oleh pengelola.
          </p>
          <Link
            to="/"
            className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Lihat Daftar Lokasi Lainnya
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      {/* Header Ringkas Mobile-First (<56px) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            to="/daftar-bisnis"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Daftar Bisnis
          </Link>
          <span className="text-sm font-bold text-slate-900 truncate text-center">
            {business.name}
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 hidden sm:inline">
            {settings.portalName}
          </span>
        </div>
      </header>

      {/* Susunan Vertikal Mobile-First (1. Foto Cover -> 2. Nama -> 3. Info Lokasi -> 4. Galeri -> 5. Tombol Google Maps -> 6. Pilihan Panduan -> 7. Tombol Google Review) */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 lg:py-8 space-y-6">
        {/* 1. Foto Cover Bisnis + 2. Nama Bisnis + 3. Informasi Lokasi */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="aspect-[16/9] w-full bg-slate-100 border-b border-slate-200 overflow-hidden">
            <SmartImage
              src={business.coverImageUrl}
              alt={`Foto cover utama ${business.name}`}
              fallbackTitle={business.name}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-teal-800 font-medium mb-2">
              <span>{business.category}</span>
              <span aria-hidden="true">·</span>
              <span>Tanpa Login</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3 text-balance">
              {business.name}
            </h1>

            {business.description && (
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5">
                {business.description}
              </p>
            )}

            <div className="space-y-3 text-sm text-slate-700 pt-4 border-t border-slate-100">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span className="leading-snug">{business.address}</span>
              </div>
              {business.openingHours && (
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span className="leading-snug">{business.openingHours}</span>
                </div>
              )}
              {business.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span className="tabular-nums leading-snug">
                    {business.phone}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Galeri Foto Bisnis (Lazy Load) */}
        {gallery.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Galeri Foto Lokasi
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Ketuk foto untuk memperbesar atau mengunduh materi promosi bisnis.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {gallery.length} foto
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="aspect-[4/3] w-full bg-slate-100 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                    aria-label={`Perbesar gambar ${item.title}`}
                  >
                    <SmartImage
                      src={item.imageUrl}
                      alt={item.title}
                      fallbackTitle={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>

                  <div className="p-3.5 flex-1 flex flex-col bg-white">
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Lihat Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPromoImage(item)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Unduh Gambar Promosi"
                      >
                        <Download className="w-4 h-4" />
                        Unduh
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Camera className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
                <strong className="font-semibold">
                  Pisahkan Foto Promosi &amp; Foto Pribadi:
                </strong>{' '}
                Galeri di atas adalah foto resmi bisnis. Jika ingin melampirkan foto pada ulasan di Google Maps, gunakan hanya foto yang Anda ambil sendiri saat berkunjung.
              </p>
            </div>
          </section>
        )}

        {/* 5. Tombol Google Maps (Akses Cepat Lokasi) */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Lokasi di Google Maps
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Buka halaman resmi bisnis ini di aplikasi atau situs Google Maps.
            </p>
          </div>
          <a
            href={business.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleTrackOpenMaps}
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-teal-700 bg-teal-50 text-teal-800 text-sm sm:text-base font-bold hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4" />
            Buka Google Maps
            <ExternalLink className="w-4 h-4" />
          </a>
        </section>

        {/* 6. Daftar Pilihan Teks Panduan Ulasan */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Panduan Menulis Pengalaman
            </h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Pilih salah satu topik panduan di bawah untuk membantu Anda mengingat hal yang ingin diceritakan secara jujur dengan kata-kata sendiri.
            </p>
          </div>

          {guides.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              Ceritakan secara jujur kesan Anda tentang pelayanan, tempat, maupun pengalaman selama berkunjung ke {business.name}.
            </div>
          ) : (
            <div className="space-y-3">
              {guides.map((guide, index) => {
                const isSelected = selectedGuideId === guide.id;
                const isCopied = copiedGuideId === guide.id;
                return (
                  <div
                    key={guide.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-600'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectGuide(guide)}
                      aria-pressed={isSelected}
                      className="w-full text-left flex items-start justify-between gap-3 cursor-pointer min-h-[44px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-bold text-slate-900">
                          {index + 1}. {guide.title}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                          {guide.question}
                        </p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {isSelected ? 'Topik dipilih' : 'Ketuk untuk memilih topik'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyGuideText(guide)}
                        className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isCopied
                            ? 'bg-teal-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Berhasil Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Salin Panduan
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Panduan ini bersifat opsional untuk memicu ide cerita Anda. Pengiriman ulasan sepenuhnya Anda tulis dan kirimkan sendiri secara sukarela di Google Maps.
            </span>
          </div>
        </section>

        {/* Kolom Menulis Pengalaman Pribadi + 7. Tombol Lanjutkan ke Google Review */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Tulis Pengalaman Pribadi Anda
            </h2>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {charCount} karakter · {wordCount} kata
            </span>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Susun pengalaman nyata Anda di sini dengan kata-kata sendiri, salin tulisan Anda, lalu lanjutkan ke halaman Google Review.
          </p>

          {selectedGuide && (
            <div className="mb-3 p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs sm:text-sm text-slate-800">
              <div className="font-semibold text-teal-900">
                Topik panduan yang dipilih: {selectedGuide.title}
              </div>
              <div className="text-slate-600 mt-0.5">{selectedGuide.question}</div>
            </div>
          )}

          <label htmlFor="experience-textarea" className="sr-only">
            Kolom penulisan pengalaman pribadi
          </label>
          <textarea
            id="experience-textarea"
            value={experienceText}
            onChange={(e) => setExperienceText(e.target.value)}
            rows={6}
            placeholder="Ceritakan pengalaman pribadi Anda selama berkunjung ke lokasi ini..."
            className="w-full p-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 resize-y min-h-[160px]"
          />

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCopyMyText}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm sm:text-base font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedMyText ? (
                <>
                  <Check className="w-5 h-5 text-teal-300" />
                  Tulisan Berhasil Disalin
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Salin Tulisan Saya
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearText}
              disabled={!experienceText}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>

          {/* 7. Tombol Lanjutkan ke Google Review */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <a
              href={business.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleTrackOpenMaps}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-teal-700 text-white text-base font-bold hover:bg-teal-800 transition-colors shadow-sm"
            >
              Lanjutkan ke Google Review
              <ExternalLink className="w-5 h-5" />
            </a>
            <p className="text-xs text-slate-500 text-center mt-2.5 leading-relaxed">
              Membuka halaman ulasan resmi{' '}
              <strong className="font-medium text-slate-700">
                {business.name}
              </strong>{' '}
              di Google Maps. Jika melampirkan foto, gunakan hanya foto yang Anda ambil sendiri.
            </p>
          </div>
        </section>

        {/* Tautan Terpisah untuk Survei Pengalaman Internal */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Survei Riset Pengalaman Pelanggan (Terpisah dari Google Maps)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
              Ingin memberikan masukan internal langsung kepada pengelola? Kompensasi riset Rp1.500 hanya berlaku untuk survei internal yang memenuhi syarat dan tidak terkait rating maupun ulasan Google.
            </p>
          </div>
          <Link
            to={`/program-partisipasi?lokasi=${encodeURIComponent(business.id)}`}
            className="min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Ikuti Program Partisipasi
          </Link>
        </section>
      </main>
      <MobileBottomNav />

      {/* Lightbox Preview Modal Gambar Promosi (Menyesuaikan Tinggi Layar Mobile) */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau gambar ${previewItem.title}`}
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 shrink-0">
              <h3 className="text-base font-bold text-slate-900 truncate pr-4">
                {previewItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Tutup pratinjau gambar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-100 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              <SmartImage
                src={previewItem.imageUrl}
                alt={previewItem.title}
                fallbackTitle={previewItem.title}
                className="max-h-[58dvh] w-full object-contain"
              />
            </div>

            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="text-sm text-slate-600">
                {previewItem.description || 'Foto promosi resmi lokasi bisnis.'}
              </div>
              <button
                type="button"
                onClick={() => handleDownloadPromoImage(previewItem)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Unduh Gambar Promosi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
