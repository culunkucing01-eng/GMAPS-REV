import React, { useEffect, useState } from 'react';
import { Edit3, Layers, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastContext';
import {
  createServiceItem,
  deleteServiceItem,
  seedDefaultServices,
  subscribeAdminServices,
  updateServiceItem,
} from '../../services/portalService';
import { LIMITS, type ServiceItem, type ServiceItemInput } from '../../types';
import { useAdminContext } from './AdminLayout';

const EMPTY_SERVICE: ServiceItemInput = {
  name: '',
  description: '',
  estimatedDuration: '',
  deliverables: '',
  order: 1,
  isActive: true,
};

export function AdminServicesPage() {
  const { user } = useAdminContext();
  const { showToast } = useToast();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ServiceItemInput>(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAdminServices(user.uid, user.email, (list) => {
      setServices(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid, user.email]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_SERVICE, order: services.length + 1 });
    setShowForm(true);
  };

  const openEdit = (item: ServiceItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description,
      estimatedDuration: item.estimatedDuration ?? '',
      deliverables: item.deliverables ?? '',
      order: item.order,
      isActive: item.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      showToast('Nama layanan dan deskripsi wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateServiceItem(editingItem.id, form);
        showToast('Pilihan layanan berhasil diperbarui.');
      } else {
        await createServiceItem(form);
        showToast('Layanan baru berhasil ditambahkan.');
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyimpan data layanan.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const count = await seedDefaultServices();
      showToast(`${count} layanan bawaan berhasil ditambahkan ke katalog.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal mengisi layanan bawaan.',
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
      await deleteServiceItem(deleteTarget.id);
      showToast(`Layanan "${deleteTarget.name}" telah dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menghapus layanan.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Manajemen Layanan
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Atur pilihan layanan yang tampil di halaman Beranda dan opsi pada formulir Booking Jasa customer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {services.length === 0 && !loading && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDefaults}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              {seeding ? 'Mengisi...' : 'Isi 5 Layanan Bawaan'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Layanan
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            {editingItem ? `Edit Layanan: ${editingItem.name}` : 'Tambah Layanan Baru'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Layanan *
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.SERVICE_NAME_MAX}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Setup Portal Lokasi & QR Code Resmi"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deskripsi Layanan *
              </label>
              <textarea
                rows={3}
                required
                maxLength={LIMITS.SERVICE_DESC_MAX}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Jelaskan cakupan layanan ini secara jelas untuk customer..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estimasi Waktu Pengerjaan
              </label>
              <input
                type="text"
                maxLength={LIMITS.SERVICE_DURATION_MAX}
                value={form.estimatedDuration ?? ''}
                onChange={(e) =>
                  setForm({ ...form, estimatedDuration: e.target.value })
                }
                placeholder="Contoh: 1–2 Hari Kerja"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Urutan Tampilan
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.order}
                onChange={(e) =>
                  setForm({ ...form, order: Number(e.target.value) || 1 })
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hasil / Deliverables Layanan
              </label>
              <input
                type="text"
                maxLength={LIMITS.SERVICE_DELIVERABLES_MAX}
                value={form.deliverables ?? ''}
                onChange={(e) =>
                  setForm({ ...form, deliverables: e.target.value })
                }
                placeholder="Contoh: Halaman Lokasi + QR Code PNG + 5–7 Poin Panduan Netral"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span className="text-sm font-medium text-slate-800">
                  Aktifkan layanan di halaman publik dan formulir booking
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingItem(null);
              }}
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
              {saving ? 'Menyimpan...' : 'Simpan Layanan'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat katalog layanan...
        </div>
      ) : services.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-4">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Belum ada layanan tersimpan di database. Anda dapat mengisi 5 layanan Google Business Profile bawaan sekaligus atau membuat layanan khusus secara manual.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDefaults}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              Isi 5 Layanan Bawaan
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Layanan Baru
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                <span className="font-mono tabular-nums">Urutan #{srv.order}</span>
                <span
                  className={
                    srv.isActive
                      ? 'text-teal-700 font-semibold'
                      : 'text-slate-500 font-medium'
                  }
                >
                  {srv.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{srv.name}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed flex-1">
                {srv.description}
              </p>
              {srv.estimatedDuration && (
                <div className="text-xs text-slate-500 mt-3">
                  Estimasi: <strong className="text-slate-700">{srv.estimatedDuration}</strong>
                </div>
              )}
              {srv.deliverables && (
                <div className="text-xs text-slate-500 mt-1">
                  Hasil: {srv.deliverables}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(srv)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(srv)}
                  aria-label={`Hapus ${srv.name}`}
                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Layanan?"
        message={`Layanan "${deleteTarget?.name}" akan dihapus dari katalog.`}
        confirmLabel="Ya, Hapus Layanan"
        isDanger
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
