import React, { useEffect, useState } from 'react';
import {
  Camera,
  Download,
  Edit3,
  Eye,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { SmartImage } from '../../components/SmartImage';
import { useToast } from '../../components/ToastContext';
import {
  createGalleryItem,
  deleteGalleryItem,
  subscribeGallery,
  updateBusiness,
  updateGalleryItem,
  uploadImageToStorage,
} from '../../services/portalService';
import { type GalleryItem, LIMITS } from '../../types';
import { useAdminContext } from './AdminLayout';

export function AdminGalleryPage() {
  const { businesses, businessesLoading } = useAdminContext();
  const { showToast } = useToast();

  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Form tambah gambar
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit / Preview / Hapus
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selectedBizId && businesses.length > 0) {
      setSelectedBizId(businesses[0].id);
    }
  }, [businesses, selectedBizId]);

  useEffect(() => {
    if (!selectedBizId) {
      setGallery([]);
      return;
    }
    setLoadingGallery(true);
    const unsub = subscribeGallery(selectedBizId, (items) => {
      setGallery(items);
      setLoadingGallery(false);
    });
    return () => unsub();
  }, [selectedBizId]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    if (!title && files.length === 1) {
      const baseName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(baseName.slice(0, LIMITS.GALLERY_TITLE_MAX));
    }
  };

  const handleAddImages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizId) return;

    if (uploadMode === 'file') {
      if (selectedFiles.length === 0) {
        showToast('Pilih minimal 1 file gambar untuk diunggah.', 'error');
        return;
      }
      setUploading(true);
      try {
        let count = 0;
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const itemTitle =
            selectedFiles.length === 1 && title.trim()
              ? title.trim()
              : file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
          const { imageUrl, storagePath } = await uploadImageToStorage(
            selectedBizId,
            file
          );
          await createGalleryItem(selectedBizId, {
            title: itemTitle || `Foto Promosi ${gallery.length + i + 1}`,
            description: description.trim(),
            imageUrl,
            storagePath,
            order: gallery.length + i + 1,
          });
          count++;
        }
        setSelectedFiles([]);
        setTitle('');
        setDescription('');
        showToast(`${count} foto promosi berhasil diunggah ke galeri bisnis.`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal mengunggah gambar.',
          'error'
        );
      } finally {
        setUploading(false);
      }
    } else {
      if (!title.trim() || !imageUrlInput.trim()) {
        showToast('Judul gambar dan tautan gambar wajib diisi.', 'error');
        return;
      }
      setUploading(true);
      try {
        await createGalleryItem(selectedBizId, {
          title: title.trim(),
          description: description.trim(),
          imageUrl: imageUrlInput.trim(),
          order: gallery.length + 1,
        });
        setTitle('');
        setDescription('');
        setImageUrlInput('');
        showToast('Foto promosi berhasil ditambahkan ke galeri.');
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal menyimpan gambar.',
          'error'
        );
      } finally {
        setUploading(false);
      }
    }
  };

  const openEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDesc(item.description ?? '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !selectedBizId) return;
    if (!editTitle.trim()) {
      showToast('Judul gambar tidak boleh kosong.', 'error');
      return;
    }
    setSavingEdit(true);
    try {
      await updateGalleryItem(selectedBizId, editingItem.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        order: editingItem.order,
      });
      setEditingItem(null);
      showToast('Informasi gambar berhasil diperbarui.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memperbarui gambar.',
        'error'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !selectedBizId) return;
    setDeleting(true);
    try {
      await deleteGalleryItem(
        selectedBizId,
        deleteTarget.id,
        deleteTarget.storagePath
      );
      setDeleteTarget(null);
      showToast('Foto promosi telah dihapus dari galeri.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menghapus gambar.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadImage = async (item: GalleryItem) => {
    try {
      const res = await fetch(item.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'foto'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Gambar promosi berhasil diunduh.');
    } catch {
      showToast('Tidak dapat mengunduh gambar secara langsung.', 'error');
    }
  };

  const handleSetAsCover = async (item: GalleryItem) => {
    const biz = businesses.find((b) => b.id === selectedBizId);
    if (!biz) return;
    try {
      await updateBusiness(biz.id, {
        name: biz.name,
        category: biz.category,
        address: biz.address,
        phone: biz.phone,
        openingHours: biz.openingHours,
        description: biz.description,
        googleReviewUrl: biz.googleReviewUrl,
        coverImageUrl: item.imageUrl,
        isActive: biz.isActive,
      });
      showToast(`"${item.title}" berhasil dijadikan Foto Cover utama untuk ${biz.name}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal memperbarui foto cover bisnis.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Galeri Gambar Promosi
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Unggah beberapa foto resmi tempat usaha atau materi promosi untuk masing-masing lokasi bisnis.
        </p>
      </div>

      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Camera className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-amber-950 leading-relaxed">
          <strong className="font-semibold">
            Pemisahan Galeri Promosi &amp; Foto Pengalaman Pelanggan:
          </strong>{' '}
          Gambar di sini adalah foto resmi promosi bisnis untuk informasi pengunjung. Di halaman publik, pengunjung diingatkan untuk hanya mengirimkan foto jepretan pribadi mereka sendiri saat mengulas di Google Maps.
        </div>
      </div>

      {businessesLoading ? (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat daftar lokasi...
        </div>
      ) : businesses.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            Tambahkan lokasi bisnis terlebih dahulu sebelum mengelola galeri gambar.
          </p>
        </div>
      ) : (
        <>
          {/* Pilih Lokasi Bisnis */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label
              htmlFor="gallery-biz-select"
              className="block text-xs font-semibold text-slate-700 mb-2"
            >
              Pilih Lokasi Bisnis
            </label>
            <select
              id="gallery-biz-select"
              value={selectedBizId}
              onChange={(e) => setSelectedBizId(e.target.value)}
              className="w-full max-w-md min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id}>
                  {biz.name} ({biz.category})
                </option>
              ))}
            </select>
          </div>

          {/* Form Unggah Gambar */}
          <form
            onSubmit={handleAddImages}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Tambah Gambar Baru ke Galeri
              </h3>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unggah File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('url')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    uploadMode === 'url'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pakai Tautan Gambar
                </button>
              </div>
            </div>

            {uploadMode === 'file' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Satu atau Beberapa File Gambar (JPG, PNG, WebP)
                </label>
                <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer text-center">
                  <Upload className="w-6 h-6 text-teal-700 mb-2" />
                  <span className="text-sm font-semibold text-slate-800">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file gambar siap diunggah`
                      : 'Ketuk untuk memilih gambar dari perangkat'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Anda dapat memilih beberapa foto sekaligus
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFilesSelected}
                    className="sr-only"
                  />
                </label>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tautan Gambar (URL HTTPS) *
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.GALLERY_URL_MAX}
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Judul Gambar {uploadMode === 'url' ? '*' : '(Opsional untuk multi-unggah)'}
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.GALLERY_TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misalnya: Area Duduk Lantai Dua"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deskripsi Gambar
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.GALLERY_DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat mengenai foto ini..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {uploading ? 'Mengunggah...' : 'Simpan ke Galeri'}
              </button>
            </div>
          </form>

          {/* Daftar Gambar */}
          {loadingGallery ? (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
              Memuat foto galeri...
            </div>
          ) : gallery.length === 0 ? (
            <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
              <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                Belum ada foto promosi untuk lokasi ini. Unggah foto pertama di atas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="h-44 w-full bg-slate-100 overflow-hidden cursor-pointer"
                  >
                    <SmartImage
                      src={item.imageUrl}
                      alt={item.title}
                      fallbackTitle={item.title}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {item.description || 'Tanpa deskripsi'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSetAsCover(item)}
                        className="w-full min-h-[36px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800 hover:bg-teal-100 cursor-pointer mb-1"
                      >
                        Jadikan Foto Cover
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        title="Pratinjau"
                        className="min-h-[36px] flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Lihat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(item)}
                        title="Unduh Gambar Promosi"
                        className="min-h-[36px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        title="Edit judul & deskripsi"
                        className="min-h-[36px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        title="Hapus gambar"
                        className="min-h-[36px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Preview Gambar */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 shrink-0">
              <h3 className="text-base font-bold text-slate-900 truncate pr-3">
                {previewItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Tutup pratinjau"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-100 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              <SmartImage
                src={previewItem.imageUrl}
                alt={previewItem.title}
                className="max-h-[58dvh] w-full object-contain"
              />
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <p className="text-sm text-slate-600">
                {previewItem.description || 'Foto promosi bisnis.'}
              </p>
              <button
                type="button"
                onClick={() => handleDownloadImage(previewItem)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Unduh Gambar Promosi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Judul & Deskripsi */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">
              Ubah Keterangan Gambar
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul Gambar *
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.GALLERY_TITLE_MAX}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Gambar
              </label>
              <textarea
                rows={3}
                maxLength={LIMITS.GALLERY_DESC_MAX}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingEdit ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Gambar Promosi?"
        message={`Foto "${deleteTarget?.title}" akan dihapus dari galeri lokasi ini.`}
        confirmLabel="Ya, Hapus Foto"
        isDanger
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
