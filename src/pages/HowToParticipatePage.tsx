import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Store,
  XCircle,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import { subscribePortalSettings } from '../services/portalService';
import { DEFAULT_PORTAL_SETTINGS, type PortalSettings } from '../types';

export function HowToParticipatePage() {
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);

  useEffect(() => {
    const unsub = subscribePortalSettings(setSettings);
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-1.5">
            Panduan Peserta &amp; Kebijakan Kepatuhan
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Cara Berpartisipasi
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
            Pahami alur pengisian survei pengalaman pelanggan, ketentuan apresiasi Rp1.500, serta pemisahan penuh dari aktivitas ulasan Google Maps.
          </p>
        </div>

        {/* 4 Langkah Partisipasi */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <div className="text-xs font-mono font-bold text-teal-700 mb-2">
              LANGKAH 01
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              Pilih Program Survei Aktif
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Buka halaman Program Partisipasi untuk melihat daftar survei yang sedang dibuka, informasi bisnis terkait, serta syarat pengisiannya. Tidak wajib login untuk berpartisipasi.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <div className="text-xs font-mono font-bold text-teal-700 mb-2">
              LANGKAH 02
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              Bagikan Pengalaman Nyata Anda
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Isi tanggal kunjungan dan ceritakan pengalaman kunjungan asli Anda secara lengkap dan jujur (pelayanan, kebersihan, kualitas produk, atau saran perbaikan).
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <div className="text-xs font-mono font-bold text-teal-700 mb-2">
              LANGKAH 03
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              Simpan Kode Partisipasi
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setelah formulir terkirim, Anda akan memperoleh Kode Partisipasi unik (misalnya <span className="font-mono font-semibold text-slate-800">PR-...</span>). Gunakan Email dan Kode tersebut untuk memantau status pengajuan &amp; riwayat partisipasi.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <div className="text-xs font-mono font-bold text-teal-700 mb-2">
              LANGKAH 04
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
              Verifikasi &amp; Apresiasi Rp1.500
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Admin memeriksa kelengkapan dan keaslian jawaban survei. Pengajuan yang memenuhi syarat akan berstatus <strong className="text-emerald-700">Memenuhi Syarat (Rp1.500)</strong> hingga disalurkan.
            </p>
          </div>
        </section>

        {/* Aturan Pemisahan Survei vs Google Reviews */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pemisahan Survei Internal &amp; Ulasan Google Maps
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                {settings.reviewEthicsNote}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                Yang Berlaku di Portal Ini
              </div>
              <ul className="text-xs sm:text-sm text-emerald-950 space-y-1.5 leading-relaxed list-disc pl-4">
                <li>Apresiasi Rp1.500 murni untuk pengisian survei pengalaman internal yang valid.</li>
                <li>Anda bebas membuka atau menulis ulasan di Google Maps secara sukarela berdasarkan pengalaman pribadi.</li>
                <li>Status pengajuan &amp; apresiasi dapat dipantau transparan lewat Email + Kode Partisipasi.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-slate-700 shrink-0" />
                Yang Tidak Pernah Kami Lakukan
              </div>
              <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 leading-relaxed list-disc pl-4">
                <li>Tidak ada pembayaran per ulasan Google Maps.</li>
                <li>Tidak ada kewajiban memberi rating tertentu (misalnya wajib bintang 5).</li>
                <li>Tidak menyediakan teks ulasan buatan operator untuk ditempel massal, maupun instruksi mengubah/menghapus ulasan demi bayaran.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/program-partisipasi"
            className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm sm:text-base font-semibold hover:bg-teal-800 transition-colors"
          >
            <ClipboardCheck className="w-5 h-5" />
            Lihat Program Partisipasi
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/daftar-bisnis"
            className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm sm:text-base font-semibold hover:bg-slate-50 transition-colors"
          >
            <Store className="w-5 h-5 text-teal-700" />
            Jelajahi Daftar Bisnis
          </Link>
        </div>
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
