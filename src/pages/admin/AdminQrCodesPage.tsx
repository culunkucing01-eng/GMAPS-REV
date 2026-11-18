import { useState } from 'react';
import { QrCode, Search } from 'lucide-react';
import { QrCodeCard } from '../../components/QrCodeCard';
import { useAdminContext } from './AdminLayout';

export function AdminQrCodesPage() {
  const { businesses, businessesLoading } = useAdminContext();
  const [search, setSearch] = useState('');

  const filtered = businesses.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Kelola QR Code
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Setiap lokasi memiliki Kode QR unik. Saat dipindai dari smartphone, pengunjung langsung masuk ke halaman lokasi terkait tanpa perlu login.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama lokasi bisnis..."
          className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
        />
      </div>

      {businessesLoading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
          Menyiapkan Kode QR...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center">
          <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            Belum ada lokasi bisnis untuk dibuatkan Kode QR.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((biz) => (
            <QrCodeCard key={biz.id} business={biz} />
          ))}
        </div>
      )}
    </div>
  );
}
