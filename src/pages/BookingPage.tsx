import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { PublicFooter } from '../components/PublicFooter';
import { PublicNavbar } from '../components/PublicNavbar';
import { useToast } from '../components/ToastContext';
import {
  isValidGoogleMapsUrl,
  submitServiceBooking,
  subscribePortalSettings,
  uploadBookingPhotoToStorage,
  type SubmitBookingResult,
} from '../services/portalService';
import {
  BUSINESS_CATEGORIES,
  DEFAULT_PORTAL_SETTINGS,
  LIMITS,
  SERVICE_PACKAGES,
  type PortalSettings,
} from '../types';

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);

  const [selectedPkg, setSelectedPkg] = useState<(typeof SERVICE_PACKAGES)[number]>(SERVICE_PACKAGES[1]); // default Business Rp25k
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [businessCategory, setBusinessCategory] = useState<string>(BUSINESS_CATEGORIES[0]);
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // 1 hingga 5 foto asli bisnis
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState<SubmitBookingResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const unsubSettings = subscribePortalSettings(setSettings);
    return () => unsubSettings();
  }, []);

  // Pre-select paket jika ada parameter ?paket=...
  useEffect(() => {
    const reqPkg = searchParams.get('paket')?.trim().toLowerCase();
    if (reqPkg) {
      const found = SERVICE_PACKAGES.find((p) => p.id === reqPkg || p.name.toLowerCase() === reqPkg);
      if (found) {
        setSelectedPkg(found);
      }
    }
  }, [searchParams]);

  const handleSelectPackage = (pkgId: string) => {
    const found = SERVICE_PACKAGES.find((p) => p.id === pkgId);
    if (found) {
      setSelectedPkg(found);
    }
    const el = document.getElementById('form-booking');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const f of files) {
      if (f.size > LIMITS.GALLERY_MAX_FILE_BYTES) {
        showToast(`File "${f.name}" melebihi batas ukuran maksimal 5MB.`, 'error');
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        showToast(`File "${f.name}" harus berupa JPG, PNG, atau WebP.`, 'error');
        continue;
      }
      validFiles.push(f);
      validPreviews.push(URL.createObjectURL(f));
    }

    const combinedFiles = [...photoFiles, ...validFiles].slice(0, 5);
    const combinedPreviews = [...photoPreviews, ...validPreviews].slice(0, 5);

    setPhotoFiles(combinedFiles);
    setPhotoPreviews(combinedPreviews);
  };

  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const validateClient = (): string | null => {
    if (customerName.trim().length < 2) {
      return 'Nama lengkap minimal 2 karakter.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail.trim())) {
      return 'Masukkan alamat email yang valid.';
    }
    const digits = customerWhatsapp.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 16) {
      return 'Masukkan nomor WhatsApp aktif yang valid (8–15 digit).';
    }
    if (businessName.trim().length < 2) {
      return 'Nama bisnis minimal 2 karakter.';
    }
    if (!isValidGoogleMapsUrl(googleMapsUrl)) {
      return 'URL Google Maps wajib diawali https:// dan menggunakan domain Google Maps resmi (contoh: https://maps.app.goo.gl/... atau https://www.google.com/maps/...).';
    }
    if (businessAddress.trim().length < 5) {
      return 'Alamat lengkap bisnis minimal 5 karakter.';
    }
    if (businessCity.trim().length < 2) {
      return 'Kota/Kabupaten wajib diisi.';
    }
    if (photoFiles.length < 1) {
      return 'Wajib mengunggah minimal 1 foto asli bisnis (eksterior, interior, produk, atau identitas) untuk verifikasi audit.';
    }
    if (settings.requireNotesOnBooking && notes.trim().length < 5) {
      return 'Catatan kebutuhan wajib diisi minimal 5 karakter sesuai pengaturan pengelola.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    const validationErr = validateClient();
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload foto pendukung ke Firebase Storage
      const uploadedPhotoUrls: string[] = [];
      for (const file of photoFiles) {
        const url = await uploadBookingPhotoToStorage(file);
        uploadedPhotoUrls.push(url);
      }

      // 2. Kirim permohonan booking dengan paket & foto
      const result = await submitServiceBooking({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerWhatsapp: customerWhatsapp.trim(),
        businessName: businessName.trim(),
        googleMapsUrl: googleMapsUrl.trim(),
        businessCategory,
        businessAddress: businessAddress.trim(),
        businessCity: businessCity.trim(),
        packageTier: selectedPkg.name,
        packagePrice: selectedPkg.price,
        serviceType: `Paket ${selectedPkg.name} (${selectedPkg.priceLabel})`,
        photos: uploadedPhotoUrls,
        notes: notes.trim(),
        website: honeypot,
      });

      setConfirmation(result);
      showToast('Permohonan booking paket jasa berhasil dikirim.');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mengirim permohonan booking. Silakan periksa data Anda dan coba lagi.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyBookingCode = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.bookingCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2500);
      showToast('Nomor Booking berhasil disalin.');
    } catch {
      showToast('Silakan salin Nomor Booking secara manual.', 'info');
    }
  };

  const resetForAnother = () => {
    setConfirmation(null);
    setBusinessName('');
    setGoogleMapsUrl('');
    setBusinessAddress('');
    setBusinessCity('');
    setNotes('');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setFormError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      <PublicNavbar portalName={settings.portalName} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero Sekunder Pemilik Bisnis */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-semibold text-teal-700 mb-1.5">
              Layanan Sekunder Pemilik Usaha
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
              Pilih Paket Pengelolaan Google Business Profile
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5 leading-relaxed">
              Layanan audit dan pengelolaan profil Google Maps profesional. Tidak menjual jumlah ulasan atau rating buatan—seluruh ulasan di Google Maps harus murni sukarela berdasarkan pengalaman nyata.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectPackage(selectedPkg.id)}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm sm:text-base font-bold hover:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Pilih Paket &amp; Booking
              <ArrowDown className="w-4 h-4" />
            </button>
            <Link
              to="/cek-status"
              className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Cek Status Booking
            </Link>
          </div>
        </section>

        {/* 3 Pilihan Paket Layanan (Starter, Business, Professional) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Tiga Pilihan Paket Layanan
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Pilih paket yang sesuai dengan kebutuhan skala usaha Anda. Konfirmasi pembayaran dilakukan manual setelah admin menyetujui permohonan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SERVICE_PACKAGES.map((pkg) => {
              const isSelected = selectedPkg.id === pkg.id;
              return (
                <div
                  key={pkg.id}
                  className={`bg-white border rounded-2xl p-6 flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-teal-700 ring-2 ring-teal-700/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                        {pkg.name}
                      </span>
                      <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                        {pkg.priceLabel}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {pkg.description}
                    </p>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-700">
                        Termasuk Pekerjaan:
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {pkg.deliverables.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>Estimasi Pengerjaan</span>
                      <strong className="text-slate-800 font-semibold">
                        {pkg.estimatedDuration}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={`w-full min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? 'Paket Dipilih' : `Pilih Paket ${pkg.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Formulir Pengajuan Booking */}
        <section id="form-booking" className="scroll-mt-20">
          {confirmation ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    Permohonan Booking Berhasil Diterima
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Simpan Nomor Booking Anda di bawah ini. Tim admin akan memeriksa data dan foto asli bisnis Anda sebelum memberikan konfirmasi persetujuan beserta instruksi pembayaran manual.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Nomor Booking Anda
                  </div>
                  <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                    {confirmation.bookingCode}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Waktu pengajuan: {confirmation.submittedAtLabel} · Status:{' '}
                    <strong className="text-amber-700 font-semibold">
                      Pending Approval
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyBookingCode}
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
                      Salin Nomor Booking
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                <div>
                  <div className="text-xs text-slate-500">Pemohon</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{customerName}</div>
                  <div className="text-xs text-slate-600">{customerEmail}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Bisnis &amp; Paket Terpilih</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{businessName}</div>
                  <div className="text-xs text-teal-700 font-semibold">
                    Paket {selectedPkg.name} ({selectedPkg.priceLabel})
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex items-start gap-3 text-xs sm:text-sm text-teal-950">
                <Mail className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Notifikasi ke Admin:</span>{' '}
                  {confirmation.emailStatusNote}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to={`/cek-status?kode=${encodeURIComponent(confirmation.bookingCode)}&email=${encodeURIComponent(customerEmail.trim())}`}
                  className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 text-white text-sm sm:text-base font-semibold hover:bg-teal-800 transition-colors"
                >
                  Cek Status Booking Sekarang
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={resetForAnother}
                  className="min-h-[48px] inline-flex items-center justify-center px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Ajukan Booking Lainnya
                </button>
              </div>
            </div>
          ) : settings.bookingFormOpen === false ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <CalendarClock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Pengajuan Booking Sedang Ditutup Sementara
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Pengelola sedang menutup penerimaan pengajuan booking baru sementara waktu. Jika Anda sudah pernah mengajukan booking, Anda tetap dapat memeriksa statusnya.
              </p>
              <div className="pt-2">
                <Link
                  to="/cek-status"
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
                >
                  Cek Status Booking
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Formulir Permohonan Paket {selectedPkg.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Biaya layanan: <strong className="text-slate-900 font-mono">{selectedPkg.priceLabel}</strong> (dikonfirmasi manual oleh admin).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
                  {SERVICE_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPkg(pkg)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        selectedPkg.id === pkg.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kolom Honeypot Tersembunyi Anti-Spam */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="booking-website">Website</label>
                <input
                  id="booking-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Bagian 1: Informasi Pemohon */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                  1. Informasi Pemohon (Pemilik Usaha)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label
                      htmlFor="customer-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nama Lengkap *
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      required
                      maxLength={LIMITS.BOOKING_CUSTOMER_NAME_MAX}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-email"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Alamat Email *
                    </label>
                    <input
                      id="customer-email"
                      type="email"
                      required
                      maxLength={LIMITS.BOOKING_EMAIL_MAX}
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-whatsapp"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nomor WhatsApp *
                    </label>
                    <input
                      id="customer-whatsapp"
                      type="tel"
                      required
                      maxLength={LIMITS.BOOKING_WHATSAPP_MAX}
                      value={customerWhatsapp}
                      onChange={(e) => setCustomerWhatsapp(e.target.value)}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Informasi Bisnis & Google Maps */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                  2. Informasi Bisnis &amp; Lokasi Google Maps
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="business-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nama Bisnis *
                    </label>
                    <input
                      id="business-name"
                      type="text"
                      required
                      maxLength={LIMITS.BUSINESS_NAME_MAX}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Contoh: Kedai Kopi Nusantara"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="business-category"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Kategori Bisnis *
                    </label>
                    <select
                      id="business-category"
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      {BUSINESS_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="google-maps-url"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      URL Google Maps Bisnis *
                    </label>
                    <input
                      id="google-maps-url"
                      type="url"
                      required
                      maxLength={LIMITS.BUSINESS_URL_MAX}
                      value={googleMapsUrl}
                      onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/... atau https://www.google.com/maps/..."
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Salin tautan profil bisnis Anda dari aplikasi atau web Google Maps (wajib diawali https://).
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="business-address"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Alamat Lengkap Lokasi *
                    </label>
                    <input
                      id="business-address"
                      type="text"
                      required
                      maxLength={LIMITS.BUSINESS_ADDRESS_MAX}
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="Jl. Nama Jalan No. xx, Kecamatan"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="business-city"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Kota / Kabupaten *
                    </label>
                    <input
                      id="business-city"
                      type="text"
                      required
                      maxLength={LIMITS.BUSINESS_CITY_MAX}
                      value={businessCity}
                      onChange={(e) => setBusinessCity(e.target.value)}
                      placeholder="Contoh: Jakarta Selatan / Bandung"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 3: Unggah Foto Asli Bisnis (Wajib 1–5 Foto) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      3. Unggah Foto Asli Bisnis (Wajib 1–5 Foto) *
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unggah foto eksterior, interior, produk, fasilitas, atau plang nama usaha untuk verifikasi audit admin.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                    {photoFiles.length}/5 Foto
                  </span>
                </div>

                {photoFiles.length < 5 && (
                  <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-center">
                    <Upload className="w-6 h-6 text-teal-700 mb-2" />
                    <span className="text-sm font-semibold text-slate-800">
                      Ketuk untuk memilih foto asli bisnis
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Format JPG, PNG, atau WebP (Maksimal 5MB per file)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={handleFilesSelected}
                      className="sr-only"
                    />
                  </label>
                )}

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                    {photoPreviews.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative bg-slate-100 border border-slate-200 rounded-xl overflow-hiden group aspect-square flex items-center justify-center"
                      >
                        <img
                          src={src}
                          alt={`Pratinjau foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          title="Hapus foto"
                          aria-label={`Hapus foto ${idx + 1}`}
                          className="absolute top-2 right-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bagian 4: Catatan Tambahan */}
              <div className="space-y-2">
                <label
                  htmlFor="booking-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Catatan Tambahan untuk Admin {settings.requireNotesOnBooking ? '*' : '(Opsional)'}
                </label>
                <textarea
                  id="booking-notes"
                  rows={3}
                  required={Boolean(settings.requireNotesOnBooking)}
                  maxLength={LIMITS.BOOKING_NOTES_MAX}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jelaskan kendala profil atau informasi khusus yang ingin dioptimasi..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  Seluruh listing bisnis di portal dikelola penuh oleh Admin. Layanan pengelolaan Google Business Profile mematuhi kebijakan Google dan tidak memperjualbelikan ulasan atau rating.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 text-white text-base font-bold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Mengunggah Foto & Mengirim...' : `Ajukan Booking Paket ${selectedPkg.name} (${selectedPkg.priceLabel})`}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <PublicFooter portalName={settings.portalName} />
      <MobileBottomNav />
    </div>
  );
}
