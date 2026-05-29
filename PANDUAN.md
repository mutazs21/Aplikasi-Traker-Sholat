# 📖 Panduan Migrasi Sholat Tracker: localStorage → PHP/MySQL

---

## 📁 Struktur File yang Disediakan

```
sholat-tracker-php/
├── database.sql          ← Script buat tabel di MySQL
├── api-client.js         ← Library JS (pengganti localStorage)
├── config/
│   ├── db.php            ← Konfigurasi koneksi database
│   └── auth.php          ← Helper JWT & CORS
└── api/
    ├── auth.php          ← Login & Register
    ├── records.php       ← CRUD data sholat
    ├── settings.php      ← Pengaturan user
    └── admin.php         ← Panel admin
```

---

## ✅ Prasyarat

| Kebutuhan | Versi Minimum |
|-----------|---------------|
| PHP       | 7.4+          |
| MySQL     | 5.7+ / MariaDB 10.3+ |
| Web Server| Apache/Nginx (XAMPP/Laragon OK) |
| Browser   | Chrome/Firefox modern |

---

## 🚀 LANGKAH 1 — Setup Database

### A. Buka phpMyAdmin atau MySQL CLI

**Via phpMyAdmin:**
1. Buka `http://localhost/phpmyadmin`
2. Klik **"SQL"** di tab atas
3. Copy-paste isi file `database.sql`
4. Klik **"Go"**

**Via terminal:**
```bash
mysql -u root -p < database.sql
```

### B. Verifikasi tabel berhasil dibuat

Jalankan query berikut, harus muncul 3 tabel:
```sql
USE sholat_tracker;
SHOW TABLES;
-- Hasilnya: prayer_records | user_settings | users
```

---

## 🚀 LANGKAH 2 — Setup File PHP

### A. Salin file ke folder web server

Jika pakai **XAMPP**, salin ke:
```
C:/xampp/htdocs/sholat-tracker/
```

Jika pakai **Laragon**, salin ke:
```
C:/laragon/www/sholat-tracker/
```

Struktur akhir folder:
```
sholat-tracker/
├── index.html
├── login.html
├── admin.html
├── css/
├── js/
│   ├── app.js            ← file asli kamu (nanti dimodifikasi)
│   └── api-client.js     ← TAMBAHKAN file ini
├── config/
│   ├── db.php
│   └── auth.php
└── api/
    ├── auth.php
    ├── records.php
    ├── settings.php
    └── admin.php
```

### B. Edit konfigurasi database

Buka `config/db.php` dan sesuaikan:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'sholat_tracker');
define('DB_USER', 'root');        // username MySQL kamu
define('DB_PASS', '');            // password MySQL kamu (kosong di XAMPP default)
define('JWT_SECRET', 'ganti_ini_dengan_string_random_panjang_sekali_min32');
```

> ⚠️ **Penting:** Ganti `JWT_SECRET` dengan string acak yang panjang.
> Kamu bisa generate di: https://www.random.org/strings/

---

## 🚀 LANGKAH 3 — Modifikasi File HTML

### A. Tambahkan `api-client.js` ke semua halaman

Buka `index.html`, `login.html`, dan `admin.html`.
Tambahkan baris ini **SEBELUM** `<script src="js/app.js">`:

```html
<!-- Tambahkan baris ini -->
<script src="js/api-client.js"></script>

<!-- Baris yang sudah ada -->
<script src="js/app.js"></script>
```

### B. Set URL API yang benar

Buka `js/api-client.js`, ubah baris:
```js
const API_BASE_URL = 'http://localhost/sholat-tracker/api';
```
Sesuaikan dengan lokasi file PHP kamu.

---

## 🚀 LANGKAH 4 — Modifikasi `app.js`

Ini bagian terpenting. Kita ganti semua fungsi yang pakai `localStorage` dengan versi yang memanggil API.

### A. Ganti fungsi `loadData()`

**HAPUS** kode lama:
```js
function loadData() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      db       = parsed.db       || {};
      settings = { ...settings, ...(parsed.settings || {}) };
    }
  } catch { db = {}; }
}
```

**GANTI** dengan:
```js
async function loadData() {
  try {
    // Load settings dari server
    const s = await apiLoadSettings();
    settings = { ...settings, ...s };

    // Load data bulan ini
    const monthData = await apiLoadMonth(currentYear, currentMonth);
    db = { ...db, ...monthData };
  } catch(e) {
    console.error('Gagal load data:', e);
    db = {};
  }
}
```

### B. Ganti fungsi `saveData()`

**HAPUS** kode lama:
```js
function saveData() {
  localStorage.setItem(storageKey(), JSON.stringify({ db, settings }));
  syncToAdmin();
}
```

**GANTI** dengan:
```js
async function saveData(dateKey) {
  if (!dateKey) dateKey = todayKey();
  const dayData = db[dateKey];
  if (!dayData) return;
  try {
    await apiSaveDay(dateKey, dayData);
  } catch(e) {
    console.error('Gagal simpan:', e);
    showToast('⚠️ Gagal menyimpan ke server');
  }
}
```

### C. Ganti fungsi `syncToAdmin()`

**HAPUS** seluruh fungsi `syncToAdmin()` — tidak diperlukan lagi karena data langsung ke database.

### D. Update inisialisasi di bagian bawah `app.js`

Cari kode init (biasanya di paling bawah file), ubah jadi async:

```js
// Ubah ini:
if (checkAuth()) {
  loadData();
  renderAll();
  // ...
}

// Menjadi:
if (checkAuth()) {
  loadData().then(() => {
    renderAll();
    // ...
  });
}
```

### E. Update fungsi simpan sholat

Setiap kali ada `saveData()` yang dipanggil setelah edit data, tambahkan parameter tanggal:

```js
// Contoh: saat toggle sholat
function togglePrayer(dateKey, prayerKey) {
  // ... logika toggle ...
  db[dateKey][prayerKey] = newVal;
  saveData(dateKey);  // ← kirim dateKey
  renderTrackerTable();
}
```

### F. Ganti fungsi login di `login.html`

Cari fungsi `doLogin()` di dalam `<script>` di `login.html`:

**HAPUS:**
```js
function doLogin() {
  const users = getUsers();
  const u = users.find(u => u.username === username && u.password === password);
  if (!u) { showErr('login-err', 'Username atau password salah'); return; }
  localStorage.setItem(SESSION_KEY, JSON.stringify({...}));
  window.location.href = 'index.html';
}
```

**GANTI:**
```js
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) {
    showErr('login-err', 'Username dan password wajib diisi'); return;
  }
  const btn = document.querySelector('.btn-login');
  btn.textContent = 'Memuat...'; btn.disabled = true;

  const res = await apiLogin(username, password);

  btn.textContent = 'Masuk →'; btn.disabled = false;
  if (res.success) {
    window.location.href = 'index.html';
  } else {
    showErr('login-err', res.message || 'Login gagal');
  }
}
```

**GANTI juga `doRegister()`:**
```js
async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const name     = document.getElementById('reg-name').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !name || !password) {
    showErr('reg-err', 'Semua field wajib diisi'); return;
  }
  const res = await apiRegister(username, password, name);
  if (res.success) {
    showErr('reg-err', '✅ ' + res.message);
    setTimeout(() => switchTab('login'), 1500);
  } else {
    showErr('reg-err', res.message || 'Registrasi gagal');
  }
}
```

**GANTI `logout()`:**
```js
function logout() {
  if (confirm('Yakin ingin keluar?')) {
    apiLogout();
  }
}
```

---

## 🚀 LANGKAH 5 — Test Aplikasi

1. Buka browser → `http://localhost/sholat-tracker/login.html`
2. Klik "Daftar" → buat akun baru
3. Login → coba input data sholat
4. Buka phpMyAdmin → cek tabel `prayer_records` → data harus muncul ✅

---

## 🔐 Keamanan Tambahan (Opsional tapi Disarankan)

### Tambahkan file `.htaccess` di folder `config/`

Buat file baru: `config/.htaccess`
```apache
Deny from all
```
Ini mencegah folder config diakses langsung dari browser.

### Ganti password admin default

Login phpMyAdmin, jalankan:
```sql
UPDATE users
SET password = '$2y$10$HASH_BARU'
WHERE username = 'admin';
```
Generate hash baru dengan buat file `genhash.php`:
```php
<?php
echo password_hash('password_baru_kamu', PASSWORD_BCRYPT);
```
Akses di browser, copy hasilnya, paste ke query SQL di atas, lalu hapus file `genhash.php`.

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `Gagal terhubung ke server` | Pastikan XAMPP/Laragon menyala. Cek `API_BASE_URL` di `api-client.js` |
| `CORS error` di console | Pastikan URL di `api-client.js` sama persis dengan URL server |
| `404 Not Found` saat login | Cek path file `api/auth.php` sudah benar di folder htdocs |
| Data tidak tersimpan | Buka DevTools → Network → lihat response dari `/api/records.php` |
| `Koneksi database gagal` | Cek username/password di `config/db.php`, pastikan MySQL menyala |
| Token invalid setelah refresh | Pastikan `JWT_SECRET` tidak berubah setelah set pertama kali |

---

## 📌 Catatan Hosting (Production)

Jika upload ke hosting:
- Gunakan `https://` bukan `http://`
- Ganti `DB_USER`, `DB_PASS` sesuai konfigurasi hosting
- Ubah `Access-Control-Allow-Origin: *` di `config/auth.php` menjadi domain spesifik kamu
- Hapus file `genhash.php` jika pernah dibuat
