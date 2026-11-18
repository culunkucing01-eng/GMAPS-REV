import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, Printer } from 'lucide-react';
import { type Business } from '../types';
import { useToast } from './ToastContext';

interface QrCodeCardProps {
  business: Business;
  compact?: boolean;
}

export function QrCodeCard({ business, compact = false }: QrCodeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const { showToast } = useToast();

  const targetUrl = `${window.location.origin}/lokasi/${business.id}?sumber=qr`;
  const directUrl = `${window.location.origin}/lokasi/${business.id}`;

  useEffect(() => {
    let active = true;
    const renderQr = async () => {
      if (!canvasRef.current) return;
      try {
        await QRCode.toCanvas(canvasRef.current, targetUrl, {
          width: compact ? 180 : 220,
          margin: 2,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        if (active) setQrReady(true);
      } catch (err) {
        console.error('Gagal membuat QR Code:', err);
      }
    };
    void renderQr();
    return () => {
      active = false;
    };
  }, [targetUrl, compact]);

  const safeSlug = business.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const handleDownloadPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 1024,
        margin: 3,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${safeSlug || business.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`QR Code untuk ${business.name} berhasil diunduh.`);
    } catch {
      showToast('Gagal mengunduh gambar QR Code.', 'error');
    }
  };

  const handleDownloadPosterCard = async () => {
    try {
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 720,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });

      const qrImg = new Image();
      qrImg.onload = () => {
        const card = document.createElement('canvas');
        card.width = 1000;
        card.height = 1320;
        const ctx = card.getContext('2d');
        if (!ctx) return;

        // Latar belakang putih bersih
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, card.width, card.height);

        // Bingkai luar halus
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 6;
        ctx.strokeRect(24, 24, card.width - 48, card.height - 48);

        // Header warna teal
        ctx.fillStyle = '#0F766E';
        ctx.fillRect(24, 24, card.width - 48, 220);

        ctx.fillStyle = '#CCFBF1';
        ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PORTAL BERBAGI PENGALAMAN', card.width / 2, 100);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
        const title =
          business.name.length > 34
            ? `${business.name.slice(0, 34)}...`
            : business.name;
        ctx.fillText(title, card.width / 2, 175);

        // QR Code di tengah
        const qrSize = 620;
        ctx.drawImage(qrImg, (card.width - qrSize) / 2, 310, qrSize, qrSize);

        // Instruksi sederhana
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Pindai Kode QR dari Ponsel Anda', card.width / 2, 1015);

        ctx.fillStyle = '#475569';
        ctx.font = '400 25px "DM Sans", sans-serif';
        ctx.fillText(
          'Tidak perlu login · Tulis pengalaman dengan kata-kata sendiri',
          card.width / 2,
          1075
        );
        ctx.fillText(
          'Lalu lanjutkan ke halaman Google Maps bisnis ini',
          card.width / 2,
          1118
        );

        ctx.fillStyle = '#64748B';
        ctx.font = '500 22px "DM Sans", sans-serif';
        const addr =
          business.address.length > 56
            ? `${business.address.slice(0, 56)}...`
            : business.address;
        ctx.fillText(addr, card.width / 2, 1225);

        const pngUrl = card.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `kartu-qr-${safeSlug || business.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Kartu QR siap cetak (PNG) berhasil diunduh.');
      };
      qrImg.src = qrDataUrl;
    } catch {
      showToast('Gagal membuat kartu QR Code.', 'error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      showToast('Tautan halaman lokasi berhasil disalin.');
    } catch {
      showToast('Gagal menyalin tautan.', 'error');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col">
      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-1">{business.category}</div>
        <h3 className="text-base font-bold text-slate-900 line-clamp-1">
          {business.name}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
          {business.address}
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-center mb-4">
        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
          <canvas
            ref={canvasRef}
            aria-label={`Kode QR untuk ${business.name}`}
            className={`block ${qrReady ? 'opacity-100' : 'opacity-40'}`}
          />
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-4 break-all font-mono">
        {directUrl}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          type="button"
          onClick={handleDownloadPng}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Unduh QR Code (PNG)
        </button>

        <button
          type="button"
          onClick={handleDownloadPosterCard}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Unduh Kartu QR Cetak (PNG)
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Salin Tautan
          </button>
          <a
            href={`/lokasi/${business.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka Halaman
          </a>
        </div>
      </div>
    </div>
  );
}
