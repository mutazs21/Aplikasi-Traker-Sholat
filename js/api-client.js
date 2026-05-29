/* ═══════════════════════════════════════════════
   api-client.js — Pengganti localStorage
   Hubungkan ke backend PHP/MySQL

   CARA PAKAI:
   1. Ganti nilai API_BASE_URL di bawah
   2. Tambahkan <script src="api-client.js"></script>
      SEBELUM app.js di semua halaman HTML
   3. Hapus/ganti fungsi loadData(), saveData(), syncToAdmin()
      di app.js dengan versi di bawah ini
═══════════════════════════════════════════════ */

'use strict';

// ── KONFIGURASI — ganti URL ini ───────────────
const API_BASE_URL = 'http://localhost/sholat-tracker/api';
// Contoh production: 'https://namadomain.com/sholat-tracker/api'

// ── Token Management ──────────────────────────
const TOKEN_KEY = 'sholat_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('sholat_session');
}

// ── Base fetch helper ─────────────────────────
async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    if (res.status === 401) {
      // Token kadaluarsa
      removeToken();
      window.location.href = 'index.html';
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Gagal terhubung ke server. Cek koneksi.' };
  }
}

// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════

async function apiLogin(username, password) {
  const res = await apiCall('auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.success) {
    setToken(res.token);
    // Simpan session agar kode app.js lama tetap jalan
    localStorage.setItem('sholat_session', JSON.stringify({
      username: res.user.username,
      name:     res.user.name,
      role:     res.user.role,
    }));
  }
  return res;
}

async function apiRegister(username, password, name) {
  return await apiCall('auth.php?action=register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name }),
  });
}

function apiLogout() {
  removeToken();
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════════
//  RECORDS (PENGGANTI loadData / saveData)
// ══════════════════════════════════════════════

// Ambil semua data satu bulan → kembalikan object {dateKey: data}
async function apiLoadMonth(year, month) {
  const res = await apiCall(`records.php?year=${year}&month=${month}`);
  return res.success ? res.data : {};
}

// Simpan/update satu hari
async function apiSaveDay(dateKey, dayData) {
  const payload = {
    date: dateKey,
    ...dayData,
    // pastikan quran_pages adalah angka
    quran_pages: parseInt(dayData.quran || dayData.quran_pages || 0),
  };
  // Normalisasi field boolean prayer jadi string
  ['subuh','dzuhur','ashar','maghrib','isya'].forEach(p => {
    if (payload[p] === true)  payload[p] = 'sendiri';
    if (payload[p] === false) payload[p] = 'false';
  });
  return await apiCall('records.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Hapus semua data
async function apiDeleteAll() {
  return await apiCall('records.php?all=1', { method: 'DELETE' });
}

// ══════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════

async function apiLoadSettings() {
  const res = await apiCall('settings.php');
  return res.success ? res.data : { name: '', target: 150, motivation: '' };
}

async function apiSaveSettings(settings) {
  return await apiCall('settings.php', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// ══════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════

async function apiAdminGetUsers() {
  const res = await apiCall('admin.php?action=users');
  return res.success ? res.data : [];
}

async function apiAdminDeleteUser(id) {
  return await apiCall('admin.php?action=delete_user', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

async function apiAdminChangeRole(id, role) {
  return await apiCall('admin.php?action=change_role', {
    method: 'POST',
    body: JSON.stringify({ id, role }),
  });
}
