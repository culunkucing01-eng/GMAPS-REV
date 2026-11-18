import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExperienceGuidesEditor } from '../../components/ExperienceGuidesEditor';
import { SmartImage } from '../../components/SmartImage';
import { useToast } from '../../components/ToastContext';
import {
  createBusiness,
  deleteBusiness,
  deleteStorageByUrl,
  updateBusiness,
  uploadCoverImageToStorage,
} from '../../services/portalService';
import {
  BUSINESS_CATEGORIES,
  type Business,
  type BusinessInput,
  LIMITS,
} from '../../types';
import { AdminGalleryPage } from './AdminGalleryPage';
import { AdminGuidesPage } from './AdminGuidesPage';
import { useAdminContext } from './AdminLayout';
import { AdminQrCodesPage } from './AdminQrCodesPage';

const EMPTY_FORM: BusinessInput = {
  name: '',
  category: BUSINESS_CATEGORIES[0],
  address: '',
  city: '',
  phone: '',
  openingHours: '',
  description: '',
  googleReviewUrl: '',
  coverImageUrl: '',
  isActive: true,
};

type WorkspaceTab = 'businesses' | 'qr' | 'gallery' | 'guides';

export function AdminBusinessesPage() {
  const { user, businesses, businessesLoading } = useAdminContext();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('businesses');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = businesses.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q) ||
      (b.city || '').toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditingBusiness(null);
    setForm(EMPTY_FORM);
    setMode('create');
  };

  const openEdit = (biz: Business) => {
    setEditingBusiness(biz);
    setForm({
      name: biz.name,
      category: biz.category,
      address: biz.address,
      city: biz.city ?? '',
      phone: biz.phone ?? '',
      openingHours: biz.openingHours ?? '',
      description: biz.description ?? '',
      googleReviewUrl: biz.googleReviewUrl,
      coverImageUrl: biz.coverImageUrl ?? '',
      isActive: biz.isActive,
    });
    setMode('edit');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const prevUrl = form.coverImageUrl;
      const key = editingBusiness?.id ?? `new_${user.uid}`;
      const { imageUrl } = await uploadCoverImageToStorage(key, file);
      setForm((prev) => ({ ...prev, coverImageUrl: imageUrl }));
      if (prevUrl && prevUrl !== imageUrl) {
        void deleteStorageByUrl(prevUrl);
      }
      showToast(
        mode === 'edit'
          ? 'Foto cover berhasil diunggah. Tekan Simpan Perubahan Bisnis untuk menerapkan.'
          : 'Foto cover berhasil diunggah.'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal mengunggah foto cover.',
        'error'
      );
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleRemoveCover = () => {
    const prevUrl = form.coverImageUrl;
    setForm((prev) => ({ ...prev, coverImageUrl: '' }));
    if (prevUrl) {
      void deleteStorageByUrl(prevUrl);
    }
    showToast(
      'Foto cover dihapus dari formulir. Jangan lupa tekan Simpan untuk memperbarui.',
      'info'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim() || !form.googleReviewUrl.trim()) {
      showToast(
        'Nama bisnis, alamat lengkap, dan tautan Google Review wajib diisi.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const newId = await createBusiness(form);
        showToast(
          'Lokasi bisnis baru beserta 7 panduan awal berhasil ditambahkan.'
        );
        setEditingBusiness({
          id: newId,
          ...form,
          createdBy: user.uid,
        });
        setMode('edit');
      } else if (mode === 'edit' && editingBusiness) {
        await updateBusiness(editingBusiness.id, form);
        setEditingBusiness({
          ...editingBusiness,
          ...form,
        });
        showToast('Perubahan informasi & foto cover lokasi bisnis berhasil disimpan.');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyimpan data lokasi bisnis.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.coverImageUrl) {
        void deleteStorageByUrl(deleteTarget.coverImageUrl);
      }
      await deleteBusiness(deleteTarget.id);
      showToast(`Lokasi "${deleteTarget.name}" telah dihapus.`);
      if (editingBusiness?.id === deleteTarget.id) {
        setMode('list');
        setEditingBusiness(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menghapus lokasi bisnis.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const renderTabsBar = () => (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {(
        [
          { id: 'businesses', label: 'Lokasi Bisnis', icon: Store },
          { id: 'qr', label: 'QR Code', icon: QrCode },
          { id: 'gallery', label: 'Galeri Promosi', icon: ImageIcon },
          { id: 'guides', label: 'Panduan Pengalaman', icon: BookOpenCheck },
        ] as const
      ).map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'businesses') setMode('list');
            }}
            className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  if (activeTab === 'qr') {
    return (
      <div className="space-y-6">
        {renderTabsBar()}
        <AdminQrCodesPage />
      </div>
    );
  }

  if (activeTab === 'gallery') {
    return (
      <div className="space-y-6">
        {renderTabsBar()}
        <AdminGalleryPage />
      </div>
    );
  }

  if (activeTab === 'guides') {
    return (
      <div className="space-y-6">
        {renderTabsBar()}
        <AdminGuidesPage />
      </div>
    );
  }

  if (mode === 'create' || mode === 'edit') {
    const hasCover = Boolean(form.coverImageUrl?.trim());
    return (
      <div className="space-y-6">
        {renderTabsBar()}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMode('list')}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Bisnis
          </button>

          {mode === 'edit' && editingBusiness && (
            <a
              href={`/lokasi/${editingBusiness.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50"
            >
              <ExternalLink className="w-4 h-4" />
              Lihat Halaman Publik
            </a>
          )}
        </div>

        {/* Form Informasi Bisnis & Pengaturan Foto Cover */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6"
        >
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'create'
                ? 'Tambah Lokasi Bisnis Baru'
                : `Edit Lokasi: ${editingBusiness?.name}`}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Hanya admin terotorisasi yang dapat menambah, memperbarui, atau menonaktifkan listing lokasi Google Maps.
            </p>
          </div>

          {/* Bagian Foto Cover Bisnis */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-700" />
                  Foto Cover Bisnis
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Foto utama yang tampil di kartu lokasi dan bagian paling atas halaman detail bisnis (rasio 16:9).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-6">
                <div className="aspect-[16/9] w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <SmartImage
                    src={form.coverImageUrl}
                    alt={`Pratinjau foto cover ${form.name || 'bisnis'}`}
                    fallbackTitle={
                      form.name || 'Belum ada foto cover bisnis'
                    }
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>

              <div className="lg:col-span-6 space-y-3">
                <div className="flex flex-wrap gap-2.5">
                  <label className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap">
                    {hasCover ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingCover
                      ? 'Mengunggah...'
                      : hasCover
                        ? 'Ganti Foto Cover'
                        : 'Unggah Foto Cover'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingCover}
                      onChange={handleCoverUpload}
                      className="sr-only"
                    />
                  </label>

                  {hasCover && (
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus Foto Cover
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="cover-url-input"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Atau Simpan URL Gambar Cover (HTTPS)
                  </label>
                  <input
                    id="cover-url-input"
                    type="text"
                    maxLength={LIMITS.COVER_URL_MAX}
                    value={form.coverImageUrl ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, coverImageUrl: e.target.value })
                    }
                    placeholder="https://... (tempelkan URL foto resmi bisnis)"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Gunakan foto asli tampak depan atau interior resmi bisnis. Jika dikosongkan, sistem menampilkan tampilan cadangan yang rapi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Lokasi Bisnis *
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.BUSINESS_NAME_MAX}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Kopi Ruang Hati — Kemang"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kategori Bisnis *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Lengkap *
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.BUSINESS_ADDRESS_MAX}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Contoh: Jl. Kemang Selatan VIII No. 14"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kota / Kabupaten
              </label>
              <input
                type="text"
                maxLength={LIMITS.BUSINESS_CITY_MAX}
                value={form.city ?? ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Contoh: Jakarta Selatan"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="text"
                maxLength={LIMITS.BUSINESS_PHONE_MAX}
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Contoh: 0812-8899-4410"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jam Operasional
              </label>
              <input
                type="text"
                maxLength={LIMITS.BUSINESS_HOURS_MAX}
                value={form.openingHours ?? ''}
                onChange={(e) =>
                  setForm({ ...form, openingHours: e.target.value })
                }
                placeholder="Contoh: Setiap hari, 08.00 – 21.00 WIB"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tautan Google Review / Google Maps Bisnis *
              </label>
              <input
                type="url"
                required
                maxLength={LIMITS.BUSINESS_URL_MAX}
                value={form.googleReviewUrl}
                onChange={(e) =>
                  setForm({ ...form, googleReviewUrl: e.target.value })
                }
                placeholder="https://g.page/r/..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Tempelkan tautan langsung halaman Google Maps Bisnis Anda (diawali https://).
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deskripsi Singkat Bisnis
              </label>
              <textarea
                rows={3}
                maxLength={LIMITS.BUSINESS_DESC_MAX}
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Jelaskan secara singkat layanan atau produk utama di lokasi ini..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 resize-y"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span className="text-sm font-medium text-slate-800">
                  Tampilkan lokasi bisnis ini di portal publik (Aktif)
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => setMode('list')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || uploadingCover}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving
                ? 'Menyimpan...'
                : mode === 'create'
                  ? 'Simpan & Lanjut Atur Panduan'
                  : 'Simpan Perubahan Bisnis'}
            </button>
          </div>
        </form>

        {/* Fitur Panduan Menulis Pengalaman di Halaman Edit Bisnis */}
        {mode === 'edit' && editingBusiness && (
          <ExperienceGuidesEditor
            businessId={editingBusiness.id}
            businessName={editingBusiness.name}
            uid={user.uid}
            email={user.email}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderTabsBar()}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Daftar Bisnis
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Kelola listing Google Maps, foto cover, QR Code, galeri promosi, dan panduan pengalaman per lokasi.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Tambah Lokasi Bisnis
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama bisnis, kota, kategori, atau alamat..."
          className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
        />
      </div>

      {businessesLoading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat data lokasi bisnis...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 mb-4">
            {businesses.length === 0
              ? 'Belum ada lokasi bisnis yang ditambahkan.'
              : 'Tidak ada lokasi yang sesuai dengan pencarian Anda.'}
          </p>
          {businesses.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Lokasi Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((biz) => (
            <div
              key={biz.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/9] w-full bg-slate-100 border-b border-slate-100 overflow-hidden">
                <SmartImage
                  src={biz.coverImageUrl}
                  alt={`Cover ${biz.name}`}
                  fallbackTitle={biz.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-4 flex-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className="truncate">{biz.category}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      biz.isActive
                        ? 'text-teal-700 font-semibold'
                        : 'text-slate-500 font-medium'
                    }
                  >
                    {biz.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {biz.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {biz.address}
                  {biz.city ? `, ${biz.city}` : ''}
                </p>
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 mt-auto">
                <a
                  href={`/lokasi/${biz.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Portal
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(biz)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit &amp; Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(biz)}
                    aria-label={`Hapus ${biz.name}`}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Lokasi Bisnis?"
        message={`Lokasi "${deleteTarget?.name}" beserta seluruh panduan dan galeri fotonya akan dihapus permanen.`}
        confirmLabel="Ya, Hapus Lokasi"
        isDanger
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
