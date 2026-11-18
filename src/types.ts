import { Timestamp } from 'firebase/firestore';

export const LIMITS = {
  BUSINESS_NAME_MAX: 120,
  BUSINESS_CATEGORY_MAX: 60,
  BUSINESS_ADDRESS_MAX: 250,
  BUSINESS_CITY_MAX: 80,
  BUSINESS_PHONE_MAX: 40,
  BUSINESS_HOURS_MAX: 120,
  BUSINESS_DESC_MAX: 1000,
  BUSINESS_URL_MAX: 500,
  COVER_URL_MAX: 1500,
  GUIDE_TITLE_MAX: 100,
  GUIDE_QUESTION_MAX: 400,
  MIN_GUIDES: 5,
  MAX_GUIDES: 7,
  GALLERY_TITLE_MAX: 120,
  GALLERY_FILENAME_MAX: 160,
  GALLERY_DESC_MAX: 400,
  GALLERY_URL_MAX: 1500,
  GALLERY_ATTRIBUTION_MAX: 160,
  GALLERY_MAX_FILE_BYTES: 5 * 1024 * 1024,
  HELP_TOPIC_MAX: 120,
  HELP_MESSAGE_MAX: 1200,
  PORTAL_NAME_MAX: 100,
  PORTAL_HEADLINE_MAX: 160,
  PORTAL_SUBHEADLINE_MAX: 350,
  PORTAL_ETHICS_MAX: 400,
  SERVICE_NAME_MAX: 120,
  SERVICE_DESC_MAX: 500,
  SERVICE_DURATION_MAX: 80,
  SERVICE_DELIVERABLES_MAX: 400,
  BOOKING_CUSTOMER_NAME_MAX: 120,
  BOOKING_EMAIL_MAX: 160,
  BOOKING_WHATSAPP_MAX: 30,
  BOOKING_NOTES_MAX: 1000,
  BOOKING_REASON_MAX: 600,
  SURVEY_TITLE_MAX: 140,
  SURVEY_DESC_MAX: 500,
  SURVEY_PROMPT_MAX: 400,
  SURVEY_RULE_MAX: 400,
  SURVEY_FEEDBACK_MAX: 1500,
} as const;

export const BUSINESS_CATEGORIES = [
  'Kuliner & Kafe',
  'Toko & Ritel',
  'Klinik & Kesehatan',
  'Jasa & Layanan',
  'Bengkel & Otomotif',
  'Akomodasi & Wisata',
  'Lainnya',
] as const;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'lulukqueen17@gmail.com';

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  description?: string;
  googleReviewUrl: string;
  coverImageUrl?: string;
  isActive: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface BusinessInput {
  name: string;
  category: string;
  address: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  description?: string;
  googleReviewUrl: string;
  coverImageUrl?: string;
  isActive: boolean;
}

export interface ExperienceGuide {
  id: string;
  businessId: string;
  title: string;
  question: string;
  order: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface GuideDraft {
  id?: string;
  title: string;
  question: string;
  order: number;
  isActive: boolean;
}

export const GALLERY_CATEGORIES = [
  'Cover bisnis',
  'Eksterior',
  'Interior',
  'Fasilitas',
  'Produk',
  'Aktivitas',
  'Dokumentasi lainnya',
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export type GalleryUsagePermission =
  | 'public_view'
  | 'download_permitted'
  | 'internal_only';

export const GALLERY_PERMISSION_LABELS: Record<GalleryUsagePermission, string> = {
  public_view: 'Tampil Publik (Lihat Saja)',
  download_permitted: 'Boleh Diunduh Peserta',
  internal_only: 'Internal Admin Saja',
};

export interface GalleryItem {
  id: string;
  imageId?: string;
  businessId: string;
  title: string;
  fileName?: string;
  category?: GalleryCategory;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  storagePath?: string;
  imageType: 'promo';
  isActive?: boolean;
  usagePermission?: GalleryUsagePermission;
  attribution?: string;
  order: number;
  uploadedAt?: Timestamp | null;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface GalleryItemInput {
  title: string;
  fileName: string;
  category: GalleryCategory;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  storagePath?: string;
  isActive: boolean;
  usagePermission: GalleryUsagePermission;
  attribution?: string;
  order: number;
}

export type VisitEventType = 'page_view' | 'qr_scan' | 'copy_text' | 'open_maps';
export type VisitSource = 'portal' | 'qr';

export interface VisitEvent {
  id: string;
  businessId: string;
  businessOwnerId: string;
  eventType: VisitEventType;
  source: VisitSource;
  createdAt?: Timestamp | null;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  estimatedDuration?: string;
  deliverables?: string;
  order: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ServiceItemInput {
  name: string;
  description: string;
  estimatedDuration?: string;
  deliverables?: string;
  order: number;
  isActive: boolean;
}

export const SERVICE_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    price: 15000,
    priceLabel: 'Rp15.000',
    description: 'Audit awal kelengkapan profil bisnis dan rekomendasi perbaikan data dasar.',
    estimatedDuration: '1 Hari Kerja',
    deliverables: [
      'Audit kelengkapan profil & kategori',
      'Pemeriksaan tautan Google Maps',
      'Laporan rekomendasi perbaikan',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 25000,
    priceLabel: 'Rp25.000',
    description: 'Optimasi menyeluruh informasi operasional dan kurasi foto sampul utama.',
    estimatedDuration: '1–2 Hari Kerja',
    deliverables: [
      'Seluruh fasilitas paket Starter',
      'Optimasi deskripsi & jam operasional',
      'Kurasi & pemasangan foto sampul rasio 16:9',
      'Panduan pengalaman kunjungan netral',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 48500,
    priceLabel: 'Rp48.500',
    description: 'Pengelolaan penuh dan pendampingan eksklusif Google Business Profile secara berkala.',
    estimatedDuration: '2–3 Hari Kerja',
    deliverables: [
      'Seluruh fasilitas paket Business',
      'Penyusunan galeri promosi lengkap (hingga 10 foto)',
      'Penerbitan kode QR meja kasir siap cetak',
      'Pendampingan dan konsultasi prioritas admin',
    ],
  },
] as const;

export type ServicePackageId = (typeof SERVICE_PACKAGES)[number]['id'];

export type BookingStatus =
  | 'pending_approval'
  | 'revision_requested'
  | 'approved'
  | 'in_progress'
  | 'waiting_for_customer'
  | 'completed'
  | 'rejected';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_approval: 'Pending Approval',
  revision_requested: 'Perlu Revisi Data',
  approved: 'Disetujui',
  in_progress: 'Sedang Dikerjakan (In Progress)',
  waiting_for_customer: 'Menunggu Konfirmasi Customer',
  completed: 'Selesai',
  rejected: 'Ditolak',
};

export interface ServiceBooking {
  id: string;
  bookingCode: string;
  lookupHash: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  businessName: string;
  googleMapsUrl: string;
  businessCategory: string;
  businessAddress: string;
  businessCity: string;
  packageTier?: string;
  packagePrice?: number;
  serviceId?: string;
  serviceType: string;
  photos?: string[];
  notes?: string;
  status: BookingStatus;
  adminNotes?: string;
  rejectionReason?: string;
  linkedBusinessId?: string;
  submittedAtLabel: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface BookingSubmitPayload {
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  businessName: string;
  googleMapsUrl: string;
  businessCategory: string;
  businessAddress: string;
  businessCity: string;
  packageTier: string;
  packagePrice: number;
  serviceId?: string;
  serviceType: string;
  photos?: string[];
  notes?: string;
  website?: string; // honeypot
}

export interface BookingAuditLog {
  id: string;
  bookingId: string;
  bookingCode: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  reason?: string;
  actorUid: string;
  actorEmail: string;
  createdAt?: Timestamp | null;
}

export interface SurveyCampaign {
  id: string;
  title: string;
  description: string;
  questionPrompt: string;
  compensationAmount: number;
  eligibilityRule: string;
  isActive: boolean;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type RewardEligibleStatus =
  | 'pending_review'
  | 'revision_requested'
  | 'eligible'
  | 'not_eligible'
  | 'paid';

export const REWARD_STATUS_LABELS: Record<RewardEligibleStatus, string> = {
  pending_review: 'Menunggu Verifikasi',
  revision_requested: 'Perlu Perbaikan',
  eligible: 'Disetujui · Layak Rp1.500',
  not_eligible: 'Ditolak / Belum Memenuhi Syarat',
  paid: 'Apresiasi Disalurkan (Rp1.500)',
};

export interface SurveyResponse {
  id: string;
  participationCode?: string;
  lookupHash?: string;
  surveyId: string;
  surveyTitle: string;
  businessId?: string;
  businessName: string;
  respondentName: string;
  respondentEmail: string;
  respondentWhatsapp: string;
  visitDate: string;
  experienceFeedback: string;
  consentIndependentFromGoogle: boolean;
  rewardEligibleStatus: RewardEligibleStatus;
  adminNotes?: string;
  payoutReference?: string;
  paidAtLabel?: string;
  submittedAtLabel?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SurveySubmitPayload {
  surveyId: string;
  surveyTitle: string;
  businessId?: string;
  businessName: string;
  respondentName: string;
  respondentEmail: string;
  respondentWhatsapp: string;
  visitDate: string;
  experienceFeedback: string;
  consentIndependentFromGoogle: boolean;
  compensationAmount: number;
  website?: string;
}

export interface ParticipationStatusItem {
  participationCode: string;
  surveyTitle: string;
  businessName: string;
  visitDate: string;
  compensationAmount: number;
  rewardEligibleStatus: RewardEligibleStatus;
  adminNotes: string;
  payoutReference: string;
  submittedAtLabel: string;
  updatedAt: string | null;
}

export interface LocalParticipationRecord {
  participationCode: string;
  email: string;
  surveyTitle: string;
  businessName: string;
  submittedAtLabel: string;
}

export type EmailEventType =
  | 'new_booking_admin'
  | 'booking_approved'
  | 'booking_rejected'
  | 'booking_revision'
  | 'new_survey_admin'
  | 'survey_received'
  | 'survey_revision_requested'
  | 'survey_approved'
  | 'survey_rejected'
  | 'participant_help_admin';

export interface EmailLog {
  id: string;
  referenceId?: string;
  referenceCode?: string;
  bookingId?: string;
  bookingCode?: string;
  eventType: EmailEventType;
  recipientMasked: string;
  subject: string;
  deliveryStatus: 'sent' | 'pending_config' | 'failed';
  statusNote?: string;
  createdAt?: Timestamp | null;
}

export interface HelpRequest {
  id: string;
  ticketCode: string;
  participantName: string;
  participantEmail: string;
  topic: string;
  message: string;
  participationCode?: string;
  status: 'open' | 'resolved';
  createdAt?: Timestamp | null;
}

export interface HelpRequestSubmitPayload {
  participantName: string;
  participantEmail: string;
  topic: string;
  message: string;
  participationCode?: string;
  website?: string;
}

export interface PortalSettings {
  portalName: string;
  welcomeHeadline: string;
  welcomeSubheadline: string;
  reviewEthicsNote: string;
  bookingFormOpen?: boolean;
  bookingFormIntro?: string;
  requireNotesOnBooking?: boolean;
  surveyCompensationNote?: string;
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  addedBy: string;
  createdAt?: Timestamp | null;
}

export const LEGACY_DEFAULT_HEADLINES = [
  'Layanan Pengelolaan Profil Google Maps Terkurasi & Transparan',
];

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  portalName: 'Portal Partisipasi & Layanan Maps',
  welcomeHeadline: 'Berbagi Pengalaman, Berkontribusi, dan Dapatkan Apresiasi.',
  welcomeSubheadline:
    'Ikuti program survei pengalaman pelanggan, temukan informasi bisnis, dan berkontribusi melalui pengalaman nyata Anda.',
  reviewEthicsNote:
    'Program apresiasi survei sebesar Rp1.500 hanya berlaku untuk survei pengalaman pelanggan internal yang memenuhi ketentuan, dan tidak diberikan sebagai imbalan untuk ulasan atau rating Google Maps. Aktivitas ulasan Google Maps bersifat sukarela berdasarkan pengalaman nyata Anda.',
  bookingFormOpen: true,
  bookingFormIntro:
    'Layanan sekunder untuk pemilik usaha yang membutuhkan pendampingan pengelolaan profil Google Business Profile secara resmi dan terverifikasi admin.',
  requireNotesOnBooking: false,
  surveyCompensationNote:
    'Program apresiasi survei sebesar Rp1.500 diberikan untuk setiap pengisian survei pengalaman pelanggan yang memenuhi ketentuan verifikasi, dan tidak diberikan sebagai imbalan untuk ulasan Google.',
};

export const DEFAULT_SERVICE_CATALOG: Array<Omit<ServiceItem, 'id' | 'createdBy'>> = [
  {
    name: 'Audit profil bisnis',
    description:
      'Pemeriksaan menyeluruh kelengkapan data profil usaha, kesesuaian kategori, jam operasional, dan kejelasan informasi lokasi di Google Maps.',
    estimatedDuration: '1–2 Hari Kerja',
    deliverables: 'Laporan Audit Profil & Rekomendasi Perbaikan Data',
    order: 1,
    isActive: true,
  },
  {
    name: 'Optimasi informasi bisnis',
    description:
      'Penyelarasan deskripsi usaha, kategori layanan, atribut operasional, dan tautan profil agar mudah ditemukan dan dipahami pengunjung.',
    estimatedDuration: '2 Hari Kerja',
    deliverables: 'Pembaruan Struktur Informasi & Profil Bisnis Terkurasi',
    order: 2,
    isActive: true,
  },
  {
    name: 'Pembaruan foto bisnis',
    description:
      'Kurasi serta pembaruan foto sampul utama rasio 16:9 dan galeri dokumentasi resmi bisnis yang bersih dan representatif.',
    estimatedDuration: '1–2 Hari Kerja',
    deliverables: 'Foto Cover Utama 16:9 + Galeri Dokumentasi Bisnis',
    order: 3,
    isActive: true,
  },
  {
    name: 'Pengelolaan informasi lokasi',
    description:
      'Penerbitan halaman direktori lokasi resmi di portal, kode QR meja kasir siap cetak, dan panduan pengalaman netral untuk pengunjung.',
    estimatedDuration: '1–2 Hari Kerja',
    deliverables: 'Halaman Lokasi Portal + Kartu QR Code PNG + Panduan Netral',
    order: 4,
    isActive: true,
  },
  {
    name: 'Konsultasi Google Business Profile',
    description:
      'Sesi pendampingan dan konsultasi tata kelola profil bisnis yang patuh terhadap kebijakan resmi Google tanpa praktik manipulatif.',
    estimatedDuration: 'Sesuai Jadwal',
    deliverables: 'Sesi Konsultasi + Panduan Praktik Terbaik Pengelolaan',
    order: 5,
    isActive: true,
  },
];

export const DEFAULT_GUIDE_TEMPLATES: Omit<GuideDraft, 'id'>[] = [
  {
    title: 'Pengalaman pelayanan',
    question: 'Bagaimana keramahan, kejelasan informasi, dan kecepatan staf saat melayani Anda?',
    order: 1,
    isActive: true,
  },
  {
    title: 'Kualitas produk',
    question: 'Bagaimana kesan Anda terhadap rasa, mutu, atau hasil produk yang Anda terima?',
    order: 2,
    isActive: true,
  },
  {
    title: 'Kenyamanan lokasi',
    question: 'Apakah tempatnya mudah diakses, bersih, tertata rapi, dan nyaman selama Anda berada di sana?',
    order: 3,
    isActive: true,
  },
  {
    title: 'Suasana tempat',
    question: 'Seperti apa suasana di lokasi saat Anda berkunjung (tenang, ramai, ramah keluarga, atau cocok untuk bekerja)?',
    order: 4,
    isActive: true,
  },
  {
    title: 'Hal menarik selama berkunjung',
    question: 'Adakah momen, detail kecil, atau fasilitas tertentu yang paling berkesan bagi Anda?',
    order: 5,
    isActive: true,
  },
  {
    title: 'Pengalaman menggunakan layanan',
    question: 'Bagaimana kelancaran proses pemesanan, pembayaran, atau penggunaan layanan dari awal hingga selesai?',
    order: 6,
    isActive: true,
  },
  {
    title: 'Saran dan masukan',
    question: 'Apakah ada hal yang menurut Anda sudah baik untuk dipertahankan atau perlu ditingkatkan ke depannya?',
    order: 7,
    isActive: true,
  },
];
