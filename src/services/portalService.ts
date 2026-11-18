import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from '../firebase';
import {
  type AdminUser,
  type BookingAuditLog,
  type BookingStatus,
  type BookingSubmitPayload,
  BOOTSTRAPPED_ADMIN_EMAIL,
  type Business,
  type BusinessInput,
  DEFAULT_GUIDE_TEMPLATES,
  DEFAULT_PORTAL_SETTINGS,
  DEFAULT_SERVICE_CATALOG,
  type EmailLog,
  type ExperienceGuide,
  type GalleryItem,
  type GuideDraft,
  LEGACY_DEFAULT_HEADLINES,
  LIMITS,
  type LocalParticipationRecord,
  type ParticipationStatusItem,
  type PortalSettings,
  type RewardEligibleStatus,
  type ServiceBooking,
  type ServiceItem,
  type ServiceItemInput,
  type SurveyCampaign,
  type SurveyResponse,
  type SurveySubmitPayload,
  type VisitEvent,
  type VisitEventType,
  type VisitSource,
} from '../types';

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

export function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, LIMITS.BUSINESS_URL_MAX);
  return `https://${trimmed}`.slice(0, LIMITS.BUSINESS_URL_MAX);
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidGoogleMapsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'maps.app.goo.gl' ||
      host === 'g.page' ||
      host === 'maps.google.com' ||
      host === 'business.google.com'
    ) {
      return true;
    }
    if (host === 'goo.gl') {
      return parsed.pathname.toLowerCase().startsWith('/maps');
    }
    if (
      host === 'google.com' ||
      host === 'www.google.com' ||
      host === 'google.co.id' ||
      host === 'www.google.co.id'
    ) {
      return (
        parsed.pathname.toLowerCase().startsWith('/maps') ||
        parsed.searchParams.has('cid') ||
        parsed.searchParams.has('q')
      );
    }
    return false;
  } catch {
    return false;
  }
}

// --- Admin Authorization ---

export async function checkIsAdmin(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified) return false;
  if (email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function listAdmins(): Promise<AdminUser[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({
      uid: d.id,
      ...(d.data() as Omit<AdminUser, 'uid'>),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function addAdminUser(
  targetUid: string,
  email: string,
  displayName: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sesi masuk admin tidak ditemukan.');
  const cleanUid = targetUid.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
    throw new Error('ID Pengguna (UID) hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah.');
  }
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      email: clampStr(email, 160),
      displayName: clampStr(displayName, 100),
      addedBy: uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeAdminUser(targetUid: string): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Portal Settings ---

export function subscribePortalSettings(
  onData: (settings: PortalSettings) => void
): Unsubscribe {
  const path = 'settings/portal';
  return onSnapshot(
    doc(db, 'settings', 'portal'),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data() as Partial<PortalSettings>;
        const usesLegacyHeadline = Boolean(
          d.welcomeHeadline && LEGACY_DEFAULT_HEADLINES.includes(d.welcomeHeadline)
        );
        onData({
          portalName:
            usesLegacyHeadline || !d.portalName || d.portalName === 'Google Maps Service Portal'
              ? DEFAULT_PORTAL_SETTINGS.portalName
              : d.portalName,
          welcomeHeadline:
            usesLegacyHeadline || !d.welcomeHeadline
              ? DEFAULT_PORTAL_SETTINGS.welcomeHeadline
              : d.welcomeHeadline,
          welcomeSubheadline:
            usesLegacyHeadline || !d.welcomeSubheadline
              ? DEFAULT_PORTAL_SETTINGS.welcomeSubheadline
              : d.welcomeSubheadline,
          reviewEthicsNote:
            usesLegacyHeadline || !d.reviewEthicsNote
              ? DEFAULT_PORTAL_SETTINGS.reviewEthicsNote
              : d.reviewEthicsNote,
          bookingFormOpen: d.bookingFormOpen ?? DEFAULT_PORTAL_SETTINGS.bookingFormOpen,
          bookingFormIntro:
            usesLegacyHeadline || !d.bookingFormIntro
              ? DEFAULT_PORTAL_SETTINGS.bookingFormIntro
              : d.bookingFormIntro,
          requireNotesOnBooking:
            d.requireNotesOnBooking ?? DEFAULT_PORTAL_SETTINGS.requireNotesOnBooking,
          surveyCompensationNote:
            usesLegacyHeadline || !d.surveyCompensationNote
              ? DEFAULT_PORTAL_SETTINGS.surveyCompensationNote
              : d.surveyCompensationNote,
          updatedBy: d.updatedBy,
          updatedAt: d.updatedAt,
        });
      } else {
        onData(DEFAULT_PORTAL_SETTINGS);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function savePortalSettings(settings: {
  portalName: string;
  welcomeHeadline: string;
  welcomeSubheadline: string;
  reviewEthicsNote: string;
  bookingFormOpen?: boolean;
  bookingFormIntro?: string;
  requireNotesOnBooking?: boolean;
  surveyCompensationNote?: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');
  const path = 'settings/portal';
  try {
    await setDoc(doc(db, 'settings', 'portal'), {
      portalName: clampStr(settings.portalName, LIMITS.PORTAL_NAME_MAX) || DEFAULT_PORTAL_SETTINGS.portalName,
      welcomeHeadline:
        clampStr(settings.welcomeHeadline, LIMITS.PORTAL_HEADLINE_MAX) ||
        DEFAULT_PORTAL_SETTINGS.welcomeHeadline,
      welcomeSubheadline:
        clampStr(settings.welcomeSubheadline, LIMITS.PORTAL_SUBHEADLINE_MAX) ||
        DEFAULT_PORTAL_SETTINGS.welcomeSubheadline,
      reviewEthicsNote:
        clampStr(settings.reviewEthicsNote, LIMITS.PORTAL_ETHICS_MAX) ||
        DEFAULT_PORTAL_SETTINGS.reviewEthicsNote,
      bookingFormOpen: settings.bookingFormOpen ?? true,
      bookingFormIntro:
        clampStr(settings.bookingFormIntro, 400) ||
        DEFAULT_PORTAL_SETTINGS.bookingFormIntro,
      requireNotesOnBooking: Boolean(settings.requireNotesOnBooking),
      surveyCompensationNote:
        clampStr(settings.surveyCompensationNote, 500) ||
        DEFAULT_PORTAL_SETTINGS.surveyCompensationNote,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Businesses ---

export function subscribeActiveBusinesses(
  onData: (businesses: Business[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'businesses';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Business, 'id'>),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminBusinesses(
  uid: string,
  email: string | null | undefined,
  onData: (businesses: Business[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'businesses';
  const q =
    email === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(collection(db, path))
      : query(collection(db, path), where('createdBy', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Business, 'id'>),
        }))
        .sort((a, b) => {
          const ta = a.updatedAt?.toMillis?.() ?? 0;
          const tb = b.updatedAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function getBusinessById(businessId: string): Promise<Business | null> {
  const path = `businesses/${businessId}`;
  try {
    const snap = await getDoc(doc(db, 'businesses', businessId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<Business, 'id'>),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createBusiness(
  input: BusinessInput,
  initialGuides?: GuideDraft[]
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');

  const normalizedUrl = normalizeHttpUrl(input.googleReviewUrl);
  if (!isValidHttpUrl(normalizedUrl)) {
    throw new Error('Tautan Google Review harus berupa alamat web yang valid (diawali https://).');
  }

  const businessRef = doc(collection(db, 'businesses'));
  const path = `businesses/${businessRef.id}`;

  try {
    await setDoc(businessRef, {
      name: clampStr(input.name, LIMITS.BUSINESS_NAME_MAX),
      category: clampStr(input.category, LIMITS.BUSINESS_CATEGORY_MAX) || 'Lainnya',
      address: clampStr(input.address, LIMITS.BUSINESS_ADDRESS_MAX),
      city: clampStr(input.city, LIMITS.BUSINESS_CITY_MAX),
      phone: clampStr(input.phone, LIMITS.BUSINESS_PHONE_MAX),
      openingHours: clampStr(input.openingHours, LIMITS.BUSINESS_HOURS_MAX),
      description: clampStr(input.description, LIMITS.BUSINESS_DESC_MAX),
      googleReviewUrl: normalizedUrl,
      coverImageUrl: clampStr(input.coverImageUrl, LIMITS.COVER_URL_MAX),
      isActive: Boolean(input.isActive),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const guidesToSave =
      initialGuides && initialGuides.length >= LIMITS.MIN_GUIDES
        ? initialGuides.slice(0, LIMITS.MAX_GUIDES)
        : DEFAULT_GUIDE_TEMPLATES;

    const batch = writeBatch(db);
    guidesToSave.forEach((guide, idx) => {
      const guideRef = doc(collection(db, 'businesses', businessRef.id, 'guides'));
      batch.set(guideRef, {
        businessId: businessRef.id,
        title: clampStr(guide.title, LIMITS.GUIDE_TITLE_MAX),
        question: clampStr(guide.question, LIMITS.GUIDE_QUESTION_MAX),
        order: idx + 1,
        isActive: guide.isActive,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();

    return businessRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateBusiness(
  businessId: string,
  input: BusinessInput
): Promise<void> {
  const normalizedUrl = normalizeHttpUrl(input.googleReviewUrl);
  if (!isValidHttpUrl(normalizedUrl)) {
    throw new Error('Tautan Google Review harus berupa alamat web yang valid (diawali https://).');
  }
  const path = `businesses/${businessId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId), {
      name: clampStr(input.name, LIMITS.BUSINESS_NAME_MAX),
      category: clampStr(input.category, LIMITS.BUSINESS_CATEGORY_MAX) || 'Lainnya',
      address: clampStr(input.address, LIMITS.BUSINESS_ADDRESS_MAX),
      city: clampStr(input.city, LIMITS.BUSINESS_CITY_MAX),
      phone: clampStr(input.phone, LIMITS.BUSINESS_PHONE_MAX),
      openingHours: clampStr(input.openingHours, LIMITS.BUSINESS_HOURS_MAX),
      description: clampStr(input.description, LIMITS.BUSINESS_DESC_MAX),
      googleReviewUrl: normalizedUrl,
      coverImageUrl: clampStr(input.coverImageUrl, LIMITS.COVER_URL_MAX),
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteBusiness(businessId: string): Promise<void> {
  const path = `businesses/${businessId}`;
  try {
    const guidesSnap = await getDocs(collection(db, 'businesses', businessId, 'guides'));
    const gallerySnap = await getDocs(collection(db, 'businesses', businessId, 'gallery'));
    const batch = writeBatch(db);
    guidesSnap.forEach((d) => batch.delete(d.ref));
    gallerySnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'businesses', businessId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Experience Guides (5-7 per Business) ---

export function subscribeActiveGuides(
  businessId: string,
  onData: (guides: ExperienceGuide[]) => void
): Unsubscribe {
  const path = `businesses/${businessId}/guides`;
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExperienceGuide, 'id'>),
        }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminGuides(
  businessId: string,
  uid: string,
  email: string | null | undefined,
  onData: (guides: ExperienceGuide[]) => void
): Unsubscribe {
  const path = `businesses/${businessId}/guides`;
  const q =
    email === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(collection(db, path))
      : query(collection(db, path), where('createdBy', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExperienceGuide, 'id'>),
        }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function saveBusinessGuides(
  businessId: string,
  drafts: GuideDraft[]
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');

  if (drafts.length < LIMITS.MIN_GUIDES || drafts.length > LIMITS.MAX_GUIDES) {
    throw new Error(
      `Panduan Menulis Pengalaman harus berjumlah antara ${LIMITS.MIN_GUIDES} hingga ${LIMITS.MAX_GUIDES} pilihan.`
    );
  }

  for (let i = 0; i < drafts.length; i++) {
    if (!drafts[i].title.trim() || !drafts[i].question.trim()) {
      throw new Error(`Panduan nomor ${i + 1} wajib memiliki judul dan pertanyaan panduan.`);
    }
  }

  const path = `businesses/${businessId}/guides`;
  try {
    const existingSnap = await getDocs(collection(db, path));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const keptIds = new Set(drafts.map((d) => d.id).filter(Boolean) as string[]);

    const batch = writeBatch(db);

    existingIds.forEach((id) => {
      if (!keptIds.has(id)) {
        batch.delete(doc(db, path, id));
      }
    });

    drafts.forEach((draft, idx) => {
      const orderNum = idx + 1;
      if (draft.id && existingIds.has(draft.id)) {
        batch.update(doc(db, path, draft.id), {
          title: clampStr(draft.title, LIMITS.GUIDE_TITLE_MAX),
          question: clampStr(draft.question, LIMITS.GUIDE_QUESTION_MAX),
          order: orderNum,
          isActive: Boolean(draft.isActive),
          updatedAt: serverTimestamp(),
        });
      } else {
        const newRef = doc(collection(db, path));
        batch.set(newRef, {
          businessId,
          title: clampStr(draft.title, LIMITS.GUIDE_TITLE_MAX),
          question: clampStr(draft.question, LIMITS.GUIDE_QUESTION_MAX),
          order: orderNum,
          isActive: Boolean(draft.isActive),
          createdBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Gallery Images (Promotional Photos Only) ---

export function subscribeGallery(
  businessId: string,
  onData: (items: GalleryItem[]) => void
): Unsubscribe {
  const path = `businesses/${businessId}/gallery`;
  const q = query(collection(db, path), where('imageType', '==', 'promo'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GalleryItem, 'id'>),
        }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

async function compressImageIfNeeded(file: File): Promise<Blob> {
  if (file.size <= 450 * 1024 || !file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob ?? file);
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function uploadImageToStorage(
  businessId: string,
  file: File
): Promise<{ imageUrl: string; storagePath: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `businesses/${businessId}/gallery/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const preparedBlob = await compressImageIfNeeded(file);

  try {
    await uploadBytes(storageRef, preparedBlob, {
      contentType: file.type || 'image/jpeg',
    });
    const imageUrl = await getDownloadURL(storageRef);
    return { imageUrl, storagePath };
  } catch (err) {
    console.error('Firebase Storage upload error:', err);
    throw new Error(
      'Gagal mengunggah foto ke Firebase Storage. Pastikan layanan Storage aktif atau gunakan tautan gambar HTTPS.'
    );
  }
}

export async function uploadCoverImageToStorage(
  businessKey: string,
  file: File
): Promise<{ imageUrl: string; storagePath: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const safeKey = businessKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'draft';
  const storagePath = `businesses/${safeKey}/cover/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const preparedBlob = await compressImageIfNeeded(file);

  try {
    await uploadBytes(storageRef, preparedBlob, {
      contentType: file.type || 'image/jpeg',
    });
    const imageUrl = await getDownloadURL(storageRef);
    return { imageUrl, storagePath };
  } catch (err) {
    console.error('Firebase Storage cover upload error:', err);
    throw new Error(
      'Gagal mengunggah foto cover ke Firebase Storage. Pastikan layanan Storage aktif atau masukkan URL gambar secara langsung.'
    );
  }
}

export async function uploadBookingPhotoToStorage(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `bookings/photos/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const preparedBlob = await compressImageIfNeeded(file);

  try {
    await uploadBytes(storageRef, preparedBlob, {
      contentType: file.type || 'image/jpeg',
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error('Booking photo upload error:', err);
    throw new Error('Gagal mengunggah foto pendukung booking.');
  }
}

export async function deleteStorageByUrl(url: string): Promise<void> {
  if (!url || !url.includes('firebasestorage.googleapis.com')) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // Abaikan jika file sudah terhapus atau berasal dari URL eksternal
  }
}

export async function createGalleryItem(
  businessId: string,
  item: {
    title: string;
    description: string;
    imageUrl: string;
    storagePath?: string;
    order: number;
  }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');
  const path = `businesses/${businessId}/gallery`;
  const newRef = doc(collection(db, path));
  try {
    await setDoc(newRef, {
      businessId,
      title: clampStr(item.title, LIMITS.GALLERY_TITLE_MAX),
      description: clampStr(item.description, LIMITS.GALLERY_DESC_MAX),
      imageUrl: clampStr(item.imageUrl, LIMITS.GALLERY_URL_MAX),
      storagePath: clampStr(item.storagePath, 500),
      imageType: 'promo',
      order: Math.max(1, Math.min(100, item.order || 1)),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${newRef.id}`);
  }
}

export async function updateGalleryItem(
  businessId: string,
  imageId: string,
  updates: {
    title: string;
    description: string;
    order: number;
  }
): Promise<void> {
  const path = `businesses/${businessId}/gallery/${imageId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'gallery', imageId), {
      title: clampStr(updates.title, LIMITS.GALLERY_TITLE_MAX),
      description: clampStr(updates.description, LIMITS.GALLERY_DESC_MAX),
      order: Math.max(1, Math.min(100, updates.order || 1)),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteGalleryItem(
  businessId: string,
  imageId: string,
  storagePath?: string
): Promise<void> {
  const path = `businesses/${businessId}/gallery/${imageId}`;
  try {
    await deleteDoc(doc(db, 'businesses', businessId, 'gallery', imageId));
    if (storagePath && storagePath.startsWith('businesses/')) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch {
        // Abaikan jika file sudah terhapus dari Storage
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Visit Statistics (Anonymous Public Logging, Admin Read) ---

export async function recordVisitEvent(
  businessId: string,
  businessOwnerId: string,
  eventType: VisitEventType,
  source: VisitSource
): Promise<void> {
  if (!businessId || !businessOwnerId) return;
  try {
    const eventRef = doc(collection(db, 'visitEvents'));
    await setDoc(eventRef, {
      businessId,
      businessOwnerId,
      eventType,
      source,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Jangan ganggu alur pengunjung publik jika pencatatan statistik gagal
    console.warn('Pencatatan statistik dilewati:', err);
  }
}

export function subscribeVisitEvents(
  uid: string,
  email: string | null | undefined,
  onData: (events: VisitEvent[]) => void
): Unsubscribe {
  const path = 'visitEvents';
  const q =
    email === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(collection(db, path), orderBy('createdAt', 'desc'), limit(500))
      : query(
          collection(db, path),
          where('businessOwnerId', '==', uid),
          limit(500)
        );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VisitEvent, 'id'>),
        }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

// --- Admin Starter Data Seeder (Optional One-Click Helper) ---

export async function seedStarterBusinesses(): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');

  const samples: Array<{
    business: BusinessInput;
    gallery: Array<{ title: string; description: string; imageUrl: string }>;
  }> = [
    {
      business: {
        name: 'Kopi Ruang Hati — Kemang',
        category: 'Kuliner & Kafe',
        address: 'Jl. Kemang Selatan VIII No. 14, Jakarta Selatan',
        phone: '0812-8899-4410',
        openingHours: 'Setiap hari, 07.30 – 22.00 WIB',
        description:
          'Kedai kopi spesialti dan roti panggang hangat dengan area duduk kayu yang tenang, cocok untuk bersantai maupun bekerja.',
        googleReviewUrl: 'https://www.google.com/maps/search/?api=1&query=Kopi+Kemang+Jakarta+Selatan',
        coverImageUrl: '/src/assets/images/sample_cafe_interior_1795007854039.jpg',
        isActive: true,
      },
      gallery: [
        {
          title: 'Suasana Area Dalam Kedai',
          description: 'Foto resmi interior ruang utama dan bar seduh manual di cabang Kemang.',
          imageUrl: '/src/assets/images/sample_cafe_interior_1795007854039.jpg',
        },
        {
          title: 'Sajian Kopi Seduh & Croissant',
          description: 'Foto promosi menu kopi pilihan dan pastry segar harian.',
          imageUrl: '/src/assets/images/sample_kuliner_produk_1795007854275.jpg',
        },
      ],
    },
    {
      business: {
        name: 'Klinik Sehat Sentosa',
        category: 'Klinik & Kesehatan',
        address: 'Jl. Diponegoro No. 42, Bandung',
        phone: '(022) 420-9912',
        openingHours: 'Senin – Sabtu, 08.00 – 20.00 WIB',
        description:
          'Layanan konsultasi kesehatan keluarga dan perawatan gigi modern dengan ruang tunggu yang bersih dan nyaman.',
        googleReviewUrl: 'https://www.google.com/maps/search/?api=1&query=Klinik+Kesehatan+Bandung',
        coverImageUrl: '/src/assets/images/sample_klinik_ruang_1795007855605.jpg',
        isActive: true,
      },
      gallery: [
        {
          title: 'Ruang Penerimaan & Tunggu Pasien',
          description: 'Foto resmi area resepsionis dan ruang tunggu utama Klinik Sehat Sentosa.',
          imageUrl: '/src/assets/images/sample_klinik_ruang_1795007855605.jpg',
        },
      ],
    },
  ];

  let createdCount = 0;
  for (const item of samples) {
    const bizId = await createBusiness(item.business);
    for (let i = 0; i < item.gallery.length; i++) {
      await createGalleryItem(bizId, {
        title: item.gallery[i].title,
        description: item.gallery[i].description,
        imageUrl: item.gallery[i].imageUrl,
        order: i + 1,
      });
    }
    createdCount++;
  }
  return createdCount;
}

// --- Server-Side Admin PIN Security API ---

export interface AdminServerSessionStatus {
  authenticated: boolean;
  authorized: boolean;
  pinVerified: boolean;
  expiresAt?: number | null;
}

export async function checkAdminServerSession(
  idToken: string
): Promise<AdminServerSessionStatus> {
  const res = await fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    return {
      authenticated: res.status !== 401,
      authorized: false,
      pinVerified: false,
    };
  }
  return (await res.json()) as AdminServerSessionStatus;
}

export async function verifyAdminPinOnServer(
  idToken: string,
  pin: string
): Promise<{
  ok: boolean;
  error?: string;
  locked?: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
  expiresAt?: number;
}> {
  const res = await fetch('/api/admin/verify-pin', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ pin }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    expiresAt?: number;
    error?: string;
    locked?: boolean;
    retryAfterSeconds?: number;
    remainingAttempts?: number;
  };

  if (!res.ok || !data.verified) {
    return {
      ok: false,
      error: data.error || 'Verifikasi keamanan gagal.',
      locked: data.locked,
      retryAfterSeconds: data.retryAfterSeconds,
      remainingAttempts: data.remainingAttempts,
    };
  }

  return {
    ok: true,
    expiresAt: data.expiresAt,
  };
}

export async function logoutAdminOnServer(): Promise<void> {
  await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}

export async function fetchAdminSecuritySummary(idToken: string): Promise<{
  status: string;
  adminEmail: string;
  sessionExpiresAt: number;
  pinConfigured: boolean;
}> {
  const res = await fetch('/api/admin/security-summary', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    throw new Error('Sesi keamanan admin tidak valid atau sudah berakhir.');
  }
  return (await res.json()) as {
    status: string;
    adminEmail: string;
    sessionExpiresAt: number;
    pinConfigured: boolean;
  };
}

// --- Katalog Layanan (Admin-Controlled) ---

export function subscribeActiveServices(
  onData: (services: ServiceItem[]) => void
): Unsubscribe {
  const path = 'services';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ServiceItem, 'id'>),
        }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminServices(
  uid: string,
  email: string | null | undefined,
  onData: (services: ServiceItem[]) => void
): Unsubscribe {
  const path = 'services';
  const q =
    email === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(collection(db, path))
      : query(collection(db, path), where('createdBy', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ServiceItem, 'id'>),
        }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createServiceItem(input: ServiceItemInput): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');
  const refDoc = doc(collection(db, 'services'));
  const path = `services/${refDoc.id}`;
  try {
    await setDoc(refDoc, {
      name: clampStr(input.name, LIMITS.SERVICE_NAME_MAX),
      description: clampStr(input.description, LIMITS.SERVICE_DESC_MAX),
      estimatedDuration: clampStr(input.estimatedDuration, LIMITS.SERVICE_DURATION_MAX),
      deliverables: clampStr(input.deliverables, LIMITS.SERVICE_DELIVERABLES_MAX),
      order: Math.max(1, Math.min(100, input.order || 1)),
      isActive: Boolean(input.isActive),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return refDoc.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateServiceItem(
  serviceId: string,
  input: ServiceItemInput
): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await updateDoc(doc(db, 'services', serviceId), {
      name: clampStr(input.name, LIMITS.SERVICE_NAME_MAX),
      description: clampStr(input.description, LIMITS.SERVICE_DESC_MAX),
      estimatedDuration: clampStr(input.estimatedDuration, LIMITS.SERVICE_DURATION_MAX),
      deliverables: clampStr(input.deliverables, LIMITS.SERVICE_DELIVERABLES_MAX),
      order: Math.max(1, Math.min(100, input.order || 1)),
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteServiceItem(serviceId: string): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedDefaultServices(): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');
  const batch = writeBatch(db);
  DEFAULT_SERVICE_CATALOG.forEach((srv) => {
    const refDoc = doc(collection(db, 'services'));
    batch.set(refDoc, {
      ...srv,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  try {
    await batch.commit();
    return DEFAULT_SERVICE_CATALOG.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'services');
  }
}

// --- Booking Jasa Customer & Cek Status ---

export interface SubmitBookingResult {
  bookingId: string;
  bookingCode: string;
  submittedAtLabel: string;
  status: BookingStatus;
  emailDeliveryStatus: 'sent' | 'pending_config' | 'failed';
  emailStatusNote: string;
}

export async function submitServiceBooking(
  payload: BookingSubmitPayload
): Promise<SubmitBookingResult> {
  // 1. Validasi di server, rate-limiting, anti-spam, & kirim email SMTP ke admin
  const res = await fetch('/api/bookings/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const apiData = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    bookingCode?: string;
    lookupHash?: string;
    submittedAtLabel?: string;
    emailNotification?: {
      eventType: 'new_booking_admin';
      recipientMasked: string;
      subject: string;
      deliveryStatus: 'sent' | 'pending_config' | 'failed';
      statusNote: string;
    };
  };

  if (!res.ok || !apiData.ok || !apiData.bookingCode || !apiData.lookupHash) {
    throw new Error(apiData.error || 'Gagal mengajukan permohonan booking.');
  }

  const bookingRef = doc(collection(db, 'serviceBookings'));
  const indexRef = doc(db, 'bookingStatusIndex', apiData.lookupHash);
  const submittedAtLabel = apiData.submittedAtLabel || new Date().toLocaleString('id-ID');

  // 2. Simpan dokumen booking & indeks status bebas PII secara atomik
  try {
    const batch = writeBatch(db);
    batch.set(bookingRef, {
      bookingCode: apiData.bookingCode,
      lookupHash: apiData.lookupHash,
      customerName: clampStr(payload.customerName, LIMITS.BOOKING_CUSTOMER_NAME_MAX),
      customerEmail: clampStr(payload.customerEmail.toLowerCase(), LIMITS.BOOKING_EMAIL_MAX),
      customerWhatsapp: clampStr(payload.customerWhatsapp, LIMITS.BOOKING_WHATSAPP_MAX),
      businessName: clampStr(payload.businessName, LIMITS.BUSINESS_NAME_MAX),
      googleMapsUrl: clampStr(payload.googleMapsUrl, LIMITS.BUSINESS_URL_MAX),
      businessCategory: clampStr(payload.businessCategory, LIMITS.BUSINESS_CATEGORY_MAX),
      businessAddress: clampStr(payload.businessAddress, LIMITS.BUSINESS_ADDRESS_MAX),
      businessCity: clampStr(payload.businessCity, LIMITS.BUSINESS_CITY_MAX),
      packageTier: clampStr(payload.packageTier, 60),
      packagePrice: Number(payload.packagePrice) || 0,
      serviceId: clampStr(payload.serviceId, 128),
      serviceType: clampStr(payload.serviceType, LIMITS.SERVICE_NAME_MAX),
      photos: Array.isArray(payload.photos) ? payload.photos.slice(0, 5) : [],
      notes: clampStr(payload.notes, LIMITS.BOOKING_NOTES_MAX),
      status: 'pending_approval',
      submittedAtLabel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(indexRef, {
      bookingCode: apiData.bookingCode,
      businessName: clampStr(payload.businessName, LIMITS.BUSINESS_NAME_MAX),
      businessCategory: clampStr(payload.businessCategory, LIMITS.BUSINESS_CATEGORY_MAX),
      businessCity: clampStr(payload.businessCity, LIMITS.BUSINESS_CITY_MAX),
      serviceType: clampStr(payload.serviceType, LIMITS.SERVICE_NAME_MAX),
      status: 'pending_approval',
      statusMessage: 'Permohonan telah diterima dan sedang menunggu pemeriksaan admin.',
      submittedAtLabel,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `serviceBookings/${bookingRef.id}`);
  }

  // 3. Catat status log pengiriman email ke admin (non-blocking jika log gagal)
  if (apiData.emailNotification) {
    try {
      const logRef = doc(collection(db, 'emailLogs'));
      await setDoc(logRef, {
        bookingId: bookingRef.id,
        bookingCode: apiData.bookingCode,
        eventType: apiData.emailNotification.eventType,
        recipientMasked: apiData.emailNotification.recipientMasked,
        subject: clampStr(apiData.emailNotification.subject, 200),
        deliveryStatus: apiData.emailNotification.deliveryStatus,
        statusNote: clampStr(apiData.emailNotification.statusNote, 300),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Jangan batalkan konfirmasi booking jika penulisan log email tertunda
    }
  }

  return {
    bookingId: bookingRef.id,
    bookingCode: apiData.bookingCode,
    submittedAtLabel,
    status: 'pending_approval',
    emailDeliveryStatus: apiData.emailNotification?.deliveryStatus ?? 'pending_config',
    emailStatusNote:
      apiData.emailNotification?.statusNote ??
      'Notifikasi dicatat untuk pemeriksaan admin.',
  };
}

export interface BookingStatusLookupResult {
  found: boolean;
  bookingCode: string;
  businessName: string;
  businessCategory: string;
  businessCity: string;
  serviceType: string;
  status: BookingStatus;
  statusMessage: string;
  submittedAtLabel: string;
  updatedAt: string | null;
}

export async function checkBookingStatus(
  bookingCode: string,
  email: string
): Promise<BookingStatusLookupResult> {
  const res = await fetch('/api/bookings/check-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingCode, email }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<BookingStatusLookupResult> & {
    error?: string;
  };
  if (!res.ok || !data.found) {
    throw new Error(data.error || 'Data booking tidak ditemukan.');
  }
  return data as BookingStatusLookupResult;
}

// --- Manajemen Booking Masuk & Audit Log (Admin Only) ---

export function subscribeAdminBookings(
  onData: (bookings: ServiceBooking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'serviceBookings';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ServiceBooking, 'id'>),
      }));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeBookingAuditLogs(
  onData: (logs: BookingAuditLog[]) => void
): Unsubscribe {
  const path = 'bookingAuditLogs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BookingAuditLog, 'id'>),
      }));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeEmailLogs(
  onData: (logs: EmailLog[]) => void
): Unsubscribe {
  const path = 'emailLogs';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmailLog, 'id'>),
      }));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function fetchAdminEmailStatus(idToken: string): Promise<{
  configured: boolean;
  host: string | null;
  port: number | null;
  from: string | null;
  adminRecipientMasked: string;
}> {
  const res = await fetch('/api/admin/email-status', {
    method: 'GET',
    credentials: 'include',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error('Gagal memeriksa status layanan email SMTP.');
  }
  return (await res.json()) as {
    configured: boolean;
    host: string | null;
    port: number | null;
    from: string | null;
    adminRecipientMasked: string;
  };
}

export async function processAdminBookingStatus(params: {
  booking: ServiceBooking;
  nextStatus: BookingStatus;
  reason?: string;
  adminNotes?: string;
  linkedBusinessId?: string;
}): Promise<{
  emailDeliveryStatus?: 'sent' | 'pending_config' | 'failed';
  emailStatusNote?: string;
}> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Anda harus masuk sebagai admin terverifikasi.');
  }

  const { booking, nextStatus, reason = '', adminNotes = '', linkedBusinessId } = params;
  const cleanReason = clampStr(reason, LIMITS.BOOKING_REASON_MAX);
  const cleanAdminNotes = clampStr(adminNotes || reason, LIMITS.BOOKING_NOTES_MAX);

  let statusMessage = '';
  if (nextStatus === 'pending_approval') {
    statusMessage = 'Permohonan sedang dalam antrean pemeriksaan admin.';
  } else if (nextStatus === 'approved') {
    statusMessage =
      cleanReason ||
      'Permohonan booking jasa Anda telah disetujui dan siap diproses tim kami.';
  } else if (nextStatus === 'in_progress') {
    statusMessage = cleanReason || 'Tim kami sedang mengerjakan layanan optimasi Google Business Profile Anda.';
  } else if (nextStatus === 'waiting_for_customer') {
    statusMessage = cleanReason || 'Admin memerlukan informasi atau konfirmasi tambahan dari Anda.';
  } else if (nextStatus === 'completed') {
    statusMessage = cleanReason || 'Layanan pengelolaan Google Business Profile Anda telah selesai.';
  } else if (nextStatus === 'rejected') {
    statusMessage = `Permohonan ditolak: ${cleanReason || 'Belum memenuhi ketentuan layanan.'}`;
  } else if (nextStatus === 'revision_requested') {
    statusMessage = `Diminta revisi data: ${cleanReason || 'Mohon periksa kelengkapan data bisnis/tautan Maps.'}`;
  }

  try {
    const batch = writeBatch(db);
    const bookingRef = doc(db, 'serviceBookings', booking.id);
    const indexRef = doc(db, 'bookingStatusIndex', booking.lookupHash);
    const auditRef = doc(collection(db, 'bookingAuditLogs'));

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      adminNotes: cleanAdminNotes,
      rejectionReason: nextStatus === 'rejected' ? cleanReason : booking.rejectionReason ?? '',
      updatedAt: serverTimestamp(),
    };
    if (linkedBusinessId !== undefined) {
      updatePayload.linkedBusinessId = linkedBusinessId;
    }

    batch.update(bookingRef, updatePayload);
    batch.update(indexRef, {
      status: nextStatus,
      statusMessage: clampStr(statusMessage, 1000),
      updatedAt: serverTimestamp(),
    });
    batch.set(auditRef, {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      fromStatus: booking.status,
      toStatus: nextStatus,
      reason: cleanReason || cleanAdminNotes,
      actorUid: user.uid,
      actorEmail: user.email,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `serviceBookings/${booking.id}`);
  }

  // Kirim email notifikasi status untuk semua perubahan status aktif
  if (
    nextStatus === 'approved' ||
    nextStatus === 'in_progress' ||
    nextStatus === 'waiting_for_customer' ||
    nextStatus === 'completed' ||
    nextStatus === 'rejected' ||
    nextStatus === 'revision_requested'
  ) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/bookings/notify-status', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          customerEmail: booking.customerEmail,
          customerName: booking.customerName,
          businessName: booking.businessName,
          bookingCode: booking.bookingCode,
          serviceType: booking.serviceType,
          newStatus: nextStatus,
          reason: cleanReason || cleanAdminNotes,
        }),
      });
      const emailRes = (await res.json().catch(() => ({}))) as {
        eventType?: EmailLog['eventType'];
        recipientMasked?: string;
        subject?: string;
        deliveryStatus?: 'sent' | 'pending_config' | 'failed';
        statusNote?: string;
      };

      if (res.ok && emailRes.eventType && emailRes.deliveryStatus) {
        const logRef = doc(collection(db, 'emailLogs'));
        await setDoc(logRef, {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          eventType: emailRes.eventType,
          recipientMasked: emailRes.recipientMasked || '***',
          subject: clampStr(emailRes.subject, 200),
          deliveryStatus: emailRes.deliveryStatus,
          statusNote: clampStr(emailRes.statusNote, 300),
          createdAt: serverTimestamp(),
        });
        return {
          emailDeliveryStatus: emailRes.deliveryStatus,
          emailStatusNote: emailRes.statusNote,
        };
      }
    } catch {
      // Perubahan status tetap sukses meski pengiriman email gagal
    }
  }

  return {};
}

export async function createBusinessFromBooking(
  booking: ServiceBooking
): Promise<string> {
  const newBusinessId = await createBusiness({
    name: booking.businessName,
    category: booking.businessCategory || 'Lainnya',
    address: `${booking.businessAddress}${booking.businessCity ? `, ${booking.businessCity}` : ''}`,
    city: booking.businessCity,
    phone: booking.customerWhatsapp,
    googleReviewUrl: booking.googleMapsUrl,
    description: booking.notes || '',
    isActive: true,
  });

  await updateDoc(doc(db, 'serviceBookings', booking.id), {
    linkedBusinessId: newBusinessId,
    updatedAt: serverTimestamp(),
  });

  return newBusinessId;
}

// --- Survei Pengalaman Pelanggan Internal (Terpisah dari Ulasan Google) ---

export function subscribeActiveSurveys(
  onData: (surveys: SurveyCampaign[]) => void
): Unsubscribe {
  const path = 'surveys';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SurveyCampaign, 'id'>),
        }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminSurveys(
  uid: string,
  email: string | null | undefined,
  onData: (surveys: SurveyCampaign[]) => void
): Unsubscribe {
  const path = 'surveys';
  const q =
    email === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(collection(db, path))
      : query(collection(db, path), where('createdBy', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SurveyCampaign, 'id'>),
        }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createSurveyCampaign(input: {
  title: string;
  description: string;
  questionPrompt: string;
  compensationAmount: number;
  eligibilityRule: string;
  isActive: boolean;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Anda harus masuk sebagai admin terlebih dahulu.');
  const docRef = doc(collection(db, 'surveys'));
  const path = `surveys/${docRef.id}`;
  try {
    await setDoc(docRef, {
      title: clampStr(input.title, LIMITS.SURVEY_TITLE_MAX),
      description: clampStr(input.description, LIMITS.SURVEY_DESC_MAX),
      questionPrompt: clampStr(input.questionPrompt, LIMITS.SURVEY_PROMPT_MAX),
      compensationAmount: Math.max(0, Math.min(1500, Number(input.compensationAmount) || 0)),
      eligibilityRule: clampStr(input.eligibilityRule, LIMITS.SURVEY_RULE_MAX),
      isActive: Boolean(input.isActive),
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateSurveyCampaign(
  surveyId: string,
  input: {
    title: string;
    description: string;
    questionPrompt: string;
    compensationAmount: number;
    eligibilityRule: string;
    isActive: boolean;
  }
): Promise<void> {
  const path = `surveys/${surveyId}`;
  try {
    await updateDoc(doc(db, 'surveys', surveyId), {
      title: clampStr(input.title, LIMITS.SURVEY_TITLE_MAX),
      description: clampStr(input.description, LIMITS.SURVEY_DESC_MAX),
      questionPrompt: clampStr(input.questionPrompt, LIMITS.SURVEY_PROMPT_MAX),
      compensationAmount: Math.max(0, Math.min(1500, Number(input.compensationAmount) || 0)),
      eligibilityRule: clampStr(input.eligibilityRule, LIMITS.SURVEY_RULE_MAX),
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSurveyCampaign(surveyId: string): Promise<void> {
  const path = `surveys/${surveyId}`;
  try {
    await deleteDoc(doc(db, 'surveys', surveyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedDefaultSurvey(): Promise<string> {
  return createSurveyCampaign({
    title: 'Survei Riset Pengalaman Layanan Pelanggan (Internal)',
    description:
      'Masukan jujur Anda membantu mitra bisnis meningkatkan kualitas pelayanan, kebersihan, dan kenyamanan tempat. Survei ini murni untuk riset internal dan tidak berkaitan dengan ulasan Google Maps.',
    questionPrompt:
      'Ceritakan pengalaman kunjungan Anda (pelayanan staf, ketepatan informasi, kebersihan lokasi, serta saran perbaikan nyata untuk pengelola).',
    compensationAmount: 1500,
    eligibilityRule:
      'Kompensasi riset Rp1.500 diberikan hanya untuk masukan pengalaman nyata yang lengkap dan terverifikasi memenuhi syarat oleh admin—tidak bergantung pada rating atau ulasan Google.',
    isActive: true,
  });
}

const LOCAL_PARTICIPATION_STORAGE_KEY = 'portal_participation_history_v1';

export function getLocalParticipationHistory(): LocalParticipationRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_PARTICIPATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalParticipationRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveLocalParticipationRecord(record: LocalParticipationRecord): void {
  try {
    const existing = getLocalParticipationHistory().filter(
      (item) => item.participationCode !== record.participationCode
    );
    const next = [record, ...existing].slice(0, 20);
    window.localStorage.setItem(LOCAL_PARTICIPATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Abaikan jika penyimpanan lokal dibatasi browser
  }
}

export interface SubmitSurveyResult {
  responseId: string;
  participationCode: string;
  submittedAtLabel: string;
}

export async function submitSurveyResponse(
  input: SurveySubmitPayload
): Promise<SubmitSurveyResult> {
  if (!input.consentIndependentFromGoogle) {
    throw new Error(
      'Anda harus menyetujui bahwa survei ini terpisah dari ulasan Google Maps.'
    );
  }
  if (input.experienceFeedback.trim().length < 20) {
    throw new Error('Ceritakan pengalaman Anda minimal 20 karakter.');
  }

  // 1. Validasi server, anti-spam, dan pembangkitan Kode Partisipasi + Hash SHA-256
  const apiRes = await fetch('/api/participation/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const apiData = (await apiRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    participationCode?: string;
    lookupHash?: string;
    submittedAtLabel?: string;
  };

  if (
    !apiRes.ok ||
    !apiData.ok ||
    !apiData.participationCode ||
    !apiData.lookupHash
  ) {
    throw new Error(apiData.error || 'Gagal mengirimkan jawaban survei.');
  }

  const refDoc = doc(collection(db, 'surveyResponses'));
  const indexRef = doc(db, 'surveyStatusIndex', apiData.lookupHash);
  const submittedAtLabel =
    apiData.submittedAtLabel || new Date().toLocaleString('id-ID');
  const cleanEmail = clampStr(
    input.respondentEmail.toLowerCase(),
    LIMITS.BOOKING_EMAIL_MAX
  );
  const cleanBusinessName = clampStr(input.businessName, LIMITS.BUSINESS_NAME_MAX);
  const cleanSurveyTitle = clampStr(input.surveyTitle, LIMITS.SURVEY_TITLE_MAX);

  try {
    const batch = writeBatch(db);
    batch.set(refDoc, {
      participationCode: apiData.participationCode,
      lookupHash: apiData.lookupHash,
      surveyId: clampStr(input.surveyId, 128),
      surveyTitle: cleanSurveyTitle,
      businessId: clampStr(input.businessId, 128),
      businessName: cleanBusinessName,
      respondentName: clampStr(input.respondentName, LIMITS.BOOKING_CUSTOMER_NAME_MAX),
      respondentEmail: cleanEmail,
      respondentWhatsapp: clampStr(input.respondentWhatsapp, LIMITS.BOOKING_WHATSAPP_MAX),
      visitDate: clampStr(input.visitDate, 40),
      experienceFeedback: clampStr(input.experienceFeedback, LIMITS.SURVEY_FEEDBACK_MAX),
      consentIndependentFromGoogle: true,
      rewardEligibleStatus: 'pending_review',
      submittedAtLabel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(indexRef, {
      participationCode: apiData.participationCode,
      surveyTitle: cleanSurveyTitle,
      businessName: cleanBusinessName,
      visitDate: clampStr(input.visitDate, 40),
      compensationAmount: Math.max(
        0,
        Math.min(1500, Number(input.compensationAmount) || 0)
      ),
      rewardEligibleStatus: 'pending_review',
      submittedAtLabel,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `surveyResponses/${refDoc.id}`);
  }

  saveLocalParticipationRecord({
    participationCode: apiData.participationCode,
    email: cleanEmail,
    surveyTitle: cleanSurveyTitle,
    businessName: cleanBusinessName,
    submittedAtLabel,
  });

  return {
    responseId: refDoc.id,
    participationCode: apiData.participationCode,
    submittedAtLabel,
  };
}

export async function lookupParticipationStatusAndHistory(params: {
  email: string;
  participationCode?: string;
  additionalCodes?: string[];
}): Promise<ParticipationStatusItem[]> {
  const res = await fetch('/api/participation/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    items?: ParticipationStatusItem[];
    error?: string;
  };
  if (!res.ok || !Array.isArray(data.items)) {
    throw new Error(data.error || 'Data partisipasi tidak ditemukan.');
  }
  return data.items;
}

export function subscribeAdminSurveyResponses(
  onData: (responses: SurveyResponse[]) => void
): Unsubscribe {
  const path = 'surveyResponses';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SurveyResponse, 'id'>),
      }));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function updateSurveyResponseStatus(params: {
  response: SurveyResponse;
  rewardEligibleStatus: RewardEligibleStatus;
  adminNotes: string;
  payoutReference?: string;
}): Promise<void> {
  const { response, rewardEligibleStatus, adminNotes, payoutReference = '' } = params;
  const path = `surveyResponses/${response.id}`;
  const cleanNotes = clampStr(adminNotes, 500);
  const cleanPayoutRef = clampStr(payoutReference, 160);
  const paidAtLabel =
    rewardEligibleStatus === 'paid'
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date())
      : response.paidAtLabel || '';

  try {
    const batch = writeBatch(db);
    const respRef = doc(db, 'surveyResponses', response.id);
    batch.update(respRef, {
      rewardEligibleStatus,
      adminNotes: cleanNotes,
      payoutReference: cleanPayoutRef,
      paidAtLabel,
      updatedAt: serverTimestamp(),
    });

    if (response.lookupHash && /^[a-f0-9]{64}$/.test(response.lookupHash)) {
      const indexRef = doc(db, 'surveyStatusIndex', response.lookupHash);
      batch.update(indexRef, {
        rewardEligibleStatus,
        adminNotes: cleanNotes,
        payoutReference: cleanPayoutRef,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

