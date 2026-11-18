# Spesifikasi Keamanan Firestore — Google Maps Service Portal

## 1. Data Invariants
1. Dokumen `businesses/{businessId}` dan `services/{serviceId}` hanya dapat dibuat, diubah, atau dihapus oleh admin terverifikasi (`email_verified == true` dan terdaftar di `/admins/{uid}` atau email admin utama). Customer tidak dapat membuat listing Google Maps sendiri.
2. Subkoleksi `guides` dan `gallery` di bawah `businesses/{businessId}` wajib memeriksa keberadaan dokumen induk `businesses/{businessId}` saat `create`, serta menjaga keutuhan field imutabel (`businessId`, `createdBy`, `createdAt`).
3. Dokumen `serviceBookings/{bookingId}` memuat PII customer (`customerName`, `customerEmail`, `customerWhatsapp`) sehingga `get`, `list`, `update`, dan `delete` **dikunci eksklusif untuk admin**. Publik hanya diperbolehkan melakukan `create` dengan status wajib `pending_approval`, pola `bookingCode` valid (`^BK-[A-Z0-9-]+$`), URL Google Maps valid, dan penulisan atomik (`existsAfter`) ke `bookingStatusIndex/{lookupHash}`.
4. Dokumen `bookingStatusIndex/{lookupHash}` tidak memuat PII dan memakai ID berupa hash SHA-256 64 karakter heksadesimal (`^[a-f0-9]{64}$`). `allow list: if false` mencegah enumerasi atau scraping data booking oleh pihak luar.
5. `bookingAuditLogs/{logId}` bersifat *append-only* (`update`/`delete` ditolak) dan hanya dapat dibuat/dibaca oleh admin terverifikasi dengan `actorUid == request.auth.uid`.
6. `surveys/{surveyId}` (aktif) dan `surveyResponses/{responseId}` memisahkan survei riset pengalaman internal dari ulasan Google Maps. Setiap respons baru wajib memiliki `consentIndependentFromGoogle == true` dan `rewardEligibleStatus == 'pending_review'`; hanya admin yang dapat membaca atau memverifikasi status kelayakan riset Rp1.500.
7. `emailLogs/{logId}` tidak pernah menyimpan kredensial maupun email mentah (hanya `recipientMasked`), bersifat *append-only*, dan hanya boleh dibuat admin atau saat terikat pada dokumen `serviceBookings/{bookingId}` yang valid.

## 2. "Dirty Dozen" Payloads (Harus Ditolak `PERMISSION_DENIED`)
1. Pengunjung anonim mencoba membuat dokumen di `businesses` atau `services` -> ditolak (bukan admin).
2. Pengunjung anonim mencoba `get` atau `list` pada `serviceBookings` atau `surveyResponses` -> ditolak (proteksi PII).
3. Penyerang mencoba `list` pada `bookingStatusIndex` untuk mengumpulkan data booking -> ditolak (`allow list: if false`).
4. Pengunjung mencoba membuat `serviceBookings` dengan status langsung `'approved'` (state shortcutting) -> ditolak (`status == 'pending_approval'`).
5. Pengunjung mencoba membuat `serviceBookings` dengan `googleMapsUrl` non-HTTP/bukan Google Maps atau field tambahan `isPaid: true` -> ditolak (`keys().hasOnly(...)` + regex URL).
6. Pengunjung mencoba membuat `serviceBookings` tanpa menulis `bookingStatusIndex/{lookupHash}` secara atomik -> ditolak (`existsAfter(...)`).
7. Pengunjung mencoba membuat `bookingStatusIndex` dengan ID pendek non-hash (`"BK-123"`) -> ditolak (`^[a-f0-9]{64}$`).
8. Pengguna login dengan `email_verified == false` mencoba menyetujui booking atau membuat `bookingAuditLogs` -> ditolak.
9. Admin mencoba mengubah atau menghapus `bookingAuditLogs` atau `emailLogs` -> ditolak (`allow update, delete: if false`).
10. Pengunjung mencoba mengirim `surveyResponses` dengan `rewardEligibleStatus: 'eligible'` atau `'paid'` langsung saat submit -> ditolak (`rewardEligibleStatus == 'pending_review'`).
11. Pengunjung mencoba mengirim `surveyResponses` tanpa `consentIndependentFromGoogle == true` -> ditolak.
12. Pengguna non-admin mencoba memodifikasi `admins/{uid}` atau `settings/portal` -> ditolak.
