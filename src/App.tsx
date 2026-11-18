/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastContext';
import { BookingPage } from './pages/BookingPage';
import { BookingStatusPage } from './pages/BookingStatusPage';
import { BusinessDirectoryPage } from './pages/BusinessDirectoryPage';
import { HowToParticipatePage } from './pages/HowToParticipatePage';
import { LocationDetailPage } from './pages/LocationDetailPage';
import { PublicHomePage } from './pages/PublicHomePage';
import { SurveyPage } from './pages/SurveyPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminBusinessesPage } from './pages/admin/AdminBusinessesPage';
import { AdminGalleryPage } from './pages/admin/AdminGalleryPage';
import { AdminGuidesPage } from './pages/admin/AdminGuidesPage';
import { AdminHistoryPage } from './pages/admin/AdminHistoryPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { AdminQrCodesPage } from './pages/admin/AdminQrCodesPage';
import { AdminServicesPage } from './pages/admin/AdminServicesPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminStatsPage } from './pages/admin/AdminStatsPage';
import { AdminSurveysPage } from './pages/admin/AdminSurveysPage';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Portal Publik (Tanpa Wajib Login) */}
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/program-partisipasi" element={<SurveyPage />} />
            <Route path="/survei" element={<SurveyPage />} />
            <Route path="/daftar-bisnis" element={<BusinessDirectoryPage />} />
            <Route path="/cara-berpartisipasi" element={<HowToParticipatePage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/booking-jasa" element={<BookingPage />} />
            <Route path="/cek-status" element={<BookingStatusPage />} />
            <Route path="/lokasi/:id" element={<LocationDetailPage />} />

            {/* Dasbor Pengelola (Admin) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="lokasi" element={<AdminBusinessesPage />} />
              <Route path="survei" element={<AdminSurveysPage />} />
              <Route path="partisipan" element={<AdminParticipantsPage />} />
              <Route path="booking" element={<AdminBookingsPage />} />
              <Route path="layanan" element={<AdminServicesPage />} />
              <Route path="riwayat" element={<AdminHistoryPage />} />
              <Route path="pengaturan" element={<AdminSettingsPage />} />

              {/* Rute legacy tetap dipertahankan agar tautan/bookmark lama tetap berjalan */}
              <Route path="qr" element={<AdminQrCodesPage />} />
              <Route path="galeri" element={<AdminGalleryPage />} />
              <Route path="panduan" element={<AdminGuidesPage />} />
              <Route path="statistik" element={<AdminStatsPage />} />
            </Route>

            {/* Fallback rute tidak dikenal */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
