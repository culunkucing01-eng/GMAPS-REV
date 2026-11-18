import { useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { ExperienceGuidesEditor } from '../../components/ExperienceGuidesEditor';
import { useAdminContext } from './AdminLayout';

export function AdminGuidesPage() {
  const { user, businesses, businessesLoading } = useAdminContext();
  const [selectedBizId, setSelectedBizId] = useState<string>('');

  useEffect(() => {
    if (!selectedBizId && businesses.length > 0) {
      setSelectedBizId(businesses[0].id);
    }
  }, [businesses, selectedBizId]);

  const selectedBiz = businesses.find((b) => b.id === selectedBizId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Panduan Pengalaman
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Kelola 5 hingga 7 topik panduan menulis pengalaman pribadi untuk setiap lokasi bisnis.
        </p>
      </div>

      {businessesLoading ? (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Memuat daftar lokasi bisnis...
        </div>
      ) : businesses.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
          <BookOpenCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            Tambahkan lokasi bisnis terlebih dahulu sebelum mengatur panduan pengalaman.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label
              htmlFor="guides-biz-select"
              className="block text-xs font-semibold text-slate-700 mb-2"
            >
              Pilih Lokasi Bisnis
            </label>
            <select
              id="guides-biz-select"
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

          {selectedBiz && (
            <ExperienceGuidesEditor
              businessId={selectedBiz.id}
              businessName={selectedBiz.name}
              uid={user.uid}
              email={user.email}
            />
          )}
        </>
      )}
    </div>
  );
}
