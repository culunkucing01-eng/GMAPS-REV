import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAdminContext } from './AdminLayout';

type PeriodFilter = '7d' | '30d' | 'all';

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Kunjungan Halaman Web',
  qr_scan: 'Scan Kode QR',
  copy_text: 'Salin Tulisan Pribadi',
  open_maps: 'Buka Google Maps',
};

export function AdminStatsPage() {
  const { businesses, visitEvents } = useAdminContext();
  const [selectedBizId, setSelectedBizId] = useState('all');
  const [period, setPeriod] = useState<PeriodFilter>('30d');

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const cutoff =
      period === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : period === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;

    return visitEvents.filter((ev) => {
      const matchBiz =
        selectedBizId === 'all' || ev.businessId === selectedBizId;
      const ms = ev.createdAt?.toMillis?.() ?? now;
      const matchPeriod = cutoff === 0 || ms >= cutoff;
      return matchBiz && matchPeriod;
    });
  }, [visitEvents, selectedBizId, period]);

  const counts = useMemo(() => {
    let pageViews = 0;
    let qrScans = 0;
    let copyTexts = 0;
    let openMaps = 0;

    filteredEvents.forEach((ev) => {
      if (ev.eventType === 'page_view') pageViews++;
      else if (ev.eventType === 'qr_scan') qrScans++;
      else if (ev.eventType === 'copy_text') copyTexts++;
      else if (ev.eventType === 'open_maps') openMaps++;
    });

    return {
      totalVisits: pageViews + qrScans,
      pageViews,
      qrScans,
      copyTexts,
      openMaps,
    };
  }, [filteredEvents]);

  const perBusinessRows = useMemo(() => {
    return businesses.map((biz) => {
      const evs = filteredEvents.filter((e) => e.businessId === biz.id);
      return {
        id: biz.id,
        name: biz.name,
        category: biz.category,
        pageViews: evs.filter((e) => e.eventType === 'page_view').length,
        qrScans: evs.filter((e) => e.eventType === 'qr_scan').length,
        copyTexts: evs.filter((e) => e.eventType === 'copy_text').length,
        openMaps: evs.filter((e) => e.eventType === 'open_maps').length,
      };
    });
  }, [businesses, filteredEvents]);

  const businessNameMap = useMemo(() => {
    const map = new Map<string, string>();
    businesses.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [businesses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Statistik Kunjungan
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Pantau kunjungan halaman lokasi, pemindaian QR Code, serta interaksi menuju Google Maps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBizId}
            onChange={(e) => setSelectedBizId(e.target.value)}
            aria-label="Filter berdasarkan lokasi bisnis"
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
          >
            <option value="all">Semua Lokasi Bisnis</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            {(
              [
                { key: '7d', label: '7 Hari' },
                { key: '30d', label: '30 Hari' },
                { key: 'all', label: 'Semua' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  period === opt.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ringkasan Angka */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Kunjungan Portal Web
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {counts.pageViews}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Scan Kode QR
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2 tabular-nums">
            {counts.qrScans}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Salin Tulisan Sendiri
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {counts.copyTexts}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Lanjut ke Google Maps
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {counts.openMaps}
          </div>
        </div>
      </div>

      {/* Tabel Rekap Per Lokasi */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            Rincian Statistik per Lokasi Bisnis
          </h3>
        </div>

        {perBusinessRows.length === 0 ? (
          <div className="p-8 text-center">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Belum ada lokasi bisnis untuk ditampilkan statistiknya.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Lokasi Bisnis</th>
                  <th className="py-3 px-4 text-right">Buka Web</th>
                  <th className="py-3 px-4 text-right">Scan QR</th>
                  <th className="py-3 px-4 text-right">Salin Tulisan</th>
                  <th className="py-3 px-5 text-right">Klik Maps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {perBusinessRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-slate-900">
                        {row.name}
                      </div>
                      <div className="text-xs text-slate-500">{row.category}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.pageViews}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                      {row.qrScans}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.copyTexts}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-700">
                      {row.openMaps}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Aktivitas Terbaru */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">
            Catatan Kunjungan Terbaru
          </h3>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada aktivitas pengunjung tercatat pada rentang waktu ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Waktu</th>
                  <th className="py-3 px-4">Lokasi Bisnis</th>
                  <th className="py-3 px-4">Aktivitas</th>
                  <th className="py-3 px-5">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEvents.slice(0, 20).map((ev) => {
                  const dateLabel = ev.createdAt?.toDate
                    ? ev.createdAt.toDate().toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Baru saja';
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {dateLabel}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {businessNameMap.get(ev.businessId) ?? ev.businessId}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-600">
                        {ev.source === 'qr' ? 'Kode QR' : 'Portal Web'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
