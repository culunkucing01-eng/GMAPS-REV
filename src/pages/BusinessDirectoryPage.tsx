import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import { SmartImage } from '../components/SmartImage';
import {
  subscribeActiveBusinesses,
  subscribePortalSettings,
} from '../services/portalService';
import {
  type Business,
  DEFAULT_PORTAL_SETTINGS,
  type PortalSettings,
} from '../types';

export function BusinessDirectoryPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  useEffect(() => {
    const unsubBiz = subscribeActiveBusinesses(
      (list) => {
        setBusinesses(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    const unsubSettings = subscribePortalSettings(setSettings);
    return () => {
      unsubBiz();
      unsubSettings();
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return ['Semua', ...Array.from(set)];
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return businesses.filter((b) => {
      const matchCat =
        selectedCategory === 'Semua' || b.category === selectedCategory;
      const matchSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        (b.city || '').toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [businesses, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-1.5">
              Direktori Bisnis Terkurasi Admin
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Daftar Bisnis
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
              Jelajahi profil bisnis yang dikelola resmi oleh admin beserta alamat, jam operasional, dan tautan Google Maps.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bisnis, kota, atau alamat..."
              aria-label="Cari bisnis"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>
        </div>

        {/* Informasi Kendali Admin & Kepatuhan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-slate-600">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <span>
            Daftar bisnis dibuat dan dikelola penuh oleh Admin. Peserta hanya dapat melihat informasi lokasi, mengisi survei pengalaman secara terpisah, atau membuka Google Maps secara sukarela.
          </span>
        </div>

        {categories.length > 1 && (
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
            role="tablist"
            aria-label="Filter kategori bisnis"
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
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
                  <div className="h-11 w-full bg-slate-200 rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="border border-slate-200 rounded-2xl bg-white p-8 sm:p-10 text-center max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              {businesses.length === 0
                ? 'Belum Ada Bisnis Dipublikasikan'
                : 'Bisnis Tidak Ditemukan'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {businesses.length === 0
                ? 'Admin belum mempublikasikan daftar bisnis saat ini. Anda tetap dapat mengikuti program survei pengalaman pelanggan.'
                : 'Tidak ada bisnis yang cocok dengan pencarian atau kategori yang Anda pilih.'}
            </p>
            {businesses.length === 0 ? (
              <Link
                to="/program-partisipasi"
                className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
              >
                Lihat Program Partisipasi
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                }}
                className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Tampilkan Semua Bisnis
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredBusinesses.map((biz, idx) => (
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
                    loading={idx < 6 ? 'eager' : 'lazy'}
                  />
                </Link>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-teal-800">
                      {biz.category}
                    </span>
                    {biz.city && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{biz.city}</span>
                      </>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                    {biz.name}
                  </h2>

                  <div className="space-y-1.5 text-sm text-slate-600 mb-4">
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{biz.address}</span>
                    </p>
                    {biz.openingHours && (
                      <p className="flex items-start gap-2 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{biz.openingHours}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <Link
                      to={`/lokasi/${biz.id}`}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors"
                    >
                      Detail Bisnis
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href={biz.googleReviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Google Maps
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
