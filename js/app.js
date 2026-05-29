/* ═══════════════════════════════════════════
   SHOLAT TRACKER — APP.JS (Extended)
   Features: Auth guard, Jamaah mode,
   Dhuha, Tahajud, Quran, Puasa tracking
═══════════════════════════════════════════ */

'use strict';

// ── Auth Guard ─────────────────────────────
const SESSION_KEY = 'sholat_session';
let currentUser = null;

function checkAuth() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session || !session.username) {
      window.location.href = 'index.html'; return false;
    }
    currentUser = session;
    // Populate user info in sidebar
    document.getElementById('sidebar-name').textContent = session.name || session.username;
    const initials = (session.name || session.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('sidebar-avatar').textContent = initials;
    // Show role badge
    const roleBadge = document.getElementById('sidebar-role');
    if (roleBadge) {
      roleBadge.textContent = session.role === 'admin' ? '👑 Admin' : '👤 User';
      roleBadge.className = `role-badge ${session.role}`;
    }
    // Show admin panel link only for admin
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.style.display = session.role === 'admin' ? 'flex' : 'none';
    return true;
  } catch {
    window.location.href = 'index.html'; return false;
  }
}

function logout() {
  if (confirm('Yakin ingin keluar?')) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }
}

// ── Constants ──────────────────────────────
const PRAYERS = [
  { key: 'subuh',   label: 'Subuh',   icon: '🌅' },
  { key: 'dzuhur',  label: 'Dzuhur',  icon: '☀️' },
  { key: 'ashar',   label: 'Ashar',   icon: '🌤️' },
  { key: 'maghrib', label: 'Maghrib', icon: '🌆' },
  { key: 'isya',    label: 'Isya',    icon: '🌙' },
];

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

const MOTIVASI_QUOTES = [
  '✨ Tetap semangat, istiqamah adalah kunci!',
  '🤲 Sholat adalah tiang agama. Jaga terus!',
  '🌟 Setiap sholat adalah investasi akhirat.',
  '💪 Hari ini lebih baik dari kemarin!',
  '🕌 Allah mencintai amalan yang dilakukan terus-menerus.',
  '⭐ Lengkapi sholatmu, lengkapi harimu.',
  '📖 Satu halaman Al-Qur\'an lebih berharga dari dunia.',
  '🌙 Tahajud adalah ciri orang sholeh.',
];

const TODAY = new Date();

// ── State ──────────────────────────────────
let currentYear  = TODAY.getFullYear();
let currentMonth = TODAY.getMonth();
let currentView  = 'dashboard';

// db[dateKey] = {
//   subuh: false|'sendiri'|'jamaah',
//   dzuhur: false|'sendiri'|'jamaah',
//   ashar: false|'sendiri'|'jamaah',
//   maghrib: false|'sendiri'|'jamaah',
//   isya: false|'sendiri'|'jamaah',
//   dhuha: bool,
//   tahajud: bool,
//   quran: number (pages),
//   puasa: bool,
//   note: string
// }
let db = {};
let settings = { name: '', target: 150, motivation: '' };

// ── Per-user storage key ───────────────────
function storageKey() {
  return `sholat_tracker_${currentUser ? currentUser.username : 'guest'}`;
}

// ── Storage ────────────────────────────────
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

function saveData() {
  localStorage.setItem(storageKey(), JSON.stringify({ db, settings }));
  // Also sync to admin pool
  syncToAdmin();
}

function syncToAdmin() {
  try {
    const key = 'sholat_admin_users';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex(u => u.username === currentUser?.username);
    const payload = {
      username: currentUser?.username || '',
      name: currentUser?.name || settings.name || 'Pengguna',
      lastSync: new Date().toISOString(),
      db, settings
    };
    if (idx >= 0) existing[idx] = payload;
    else existing.push(payload);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

// ── Key helpers ────────────────────────────
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function todayKey() {
  return dateKey(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
}
function getDayData(key) {
  return db[key] || { subuh:false, dzuhur:false, ashar:false, maghrib:false, isya:false, dhuha:false, tahajud:false, quran:0, puasa:false, note:'' };
}
function isPrayerDone(val) { return val === 'sendiri' || val === 'jamaah' || val === true; }
function countPrayers(data) {
  return PRAYERS.filter(p => isPrayerDone(data[p.key])).length;
}

// ── Streak ─────────────────────────────────
function calcStreak() {
  let streak = 0, d = new Date(TODAY);
  while (true) {
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const data = getDayData(key);
    if (countPrayers(data) === 5) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Month stats ────────────────────────────
function getMonthStats(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalPrayers = 0, fullDays = 0, jamaahCount = 0;
  let dhuhaCount = 0, tahajudCount = 0, puasaCount = 0, totalQuran = 0;
  const prayerCounts = { subuh:0, dzuhur:0, ashar:0, maghrib:0, isya:0 };
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d);
    const data = getDayData(key);
    const cnt = countPrayers(data);
    totalPrayers += cnt;
    if (cnt === 5) fullDays++;
    if (data.dhuha) dhuhaCount++;
    if (data.tahajud) tahajudCount++;
    if (data.puasa) puasaCount++;
    totalQuran += (data.quran || 0);
    PRAYERS.forEach(p => {
      if (isPrayerDone(data[p.key])) prayerCounts[p.key]++;
      if (data[p.key] === 'jamaah') jamaahCount++;
    });
  }
  const filledDays = Object.keys(db).filter(k => {
    const parts = k.split('-');
    return parseInt(parts[0]) === year && parseInt(parts[1]) === month + 1 && countPrayers(db[k]) > 0;
  }).length;
  const pct = daysInMonth > 0 ? Math.round((fullDays / daysInMonth) * 100) : 0;
  return { totalPrayers, fullDays, daysInMonth, pct, prayerCounts, filledDays, jamaahCount, dhuhaCount, tahajudCount, puasaCount, totalQuran };
}

// ── VIEW SWITCHING ─────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  const btn = document.querySelector(`[data-view="${name}"]`);
  if (btn) btn.classList.add('active');
  currentView = name;
  if (name === 'statistics') renderStatistics();
  closeSidebar();
}

// ── SIDEBAR ────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const ham = document.getElementById('hamburger');
  sidebar.classList.toggle('open');
  ham.classList.toggle('open');
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active', sidebar.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ── TOAST ──────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── RENDER: HEADER ─────────────────────────
function renderHeader() {
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('today-full-date').textContent = TODAY.toLocaleDateString('id-ID', opts);
  document.getElementById('mobile-date').textContent = TODAY.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
  document.getElementById('hijri-text').textContent = toHijri(TODAY);
}

function toHijri(date) {
  const hijriMonths = ['Muharram','Safar','Rabi\'ul Awwal','Rabi\'ul Akhir','Jumadil Awwal','Jumadil Akhir','Rajab','Sya\'ban','Ramadhan','Syawal','Dzulqaidah','Dzulhijjah'];
  const jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
  const l  = jd - 1948440 + 10632;
  const n  = Math.floor((l - 1) / 10631);
  const ll = l - 10631 * n + 354;
  const j  = Math.floor((10985-ll)/5316)*Math.floor(50*ll/17719)+Math.floor(ll/5670)*Math.floor(43*ll/15238);
  const lll = ll - Math.floor((30-j)/15)*Math.floor(17719*j/50)-Math.floor(j/16)*Math.floor(15238*j/43)+29;
  const month = Math.floor(24*lll/709);
  const day   = lll - Math.floor(709*month/24);
  const year  = 30*n+j-30;
  return `${day} ${hijriMonths[month-1]} ${year} H`;
}

// ── RENDER: TODAY PRAYERS ──────────────────
function renderTodayPrayers() {
  const key = todayKey();
  const data = getDayData(key);
  const total = countPrayers(data);
  const container = document.getElementById('today-prayers');
  container.innerHTML = '';

  PRAYERS.forEach(p => {
    const val = data[p.key]; // false | 'sendiri' | 'jamaah'
    const isDone = isPrayerDone(val);
    const item = document.createElement('div');
    item.className = 'prayer-item' + (isDone ? ' checked' : '');
    item.innerHTML = `
      <span class="prayer-icon">${p.icon}</span>
      <span class="prayer-name">${p.label}</span>
      <div class="prayer-check">${isDone ? '✓' : ''}</div>
      <div class="prayer-mode-wrap">
        <button class="mode-btn ${val==='sendiri'?'active-sendiri':''}" onclick="setPrayerMode(event,'${key}','${p.key}','sendiri')" title="Sholat Sendiri">🧍</button>
        <button class="mode-btn ${val==='jamaah'?'active-jamaah':''}" onclick="setPrayerMode(event,'${key}','${p.key}','jamaah')" title="Sholat Berjamaah">🕌</button>
      </div>`;
    item.querySelector('.prayer-check').onclick = () => togglePrayer(key, p.key);
    container.appendChild(item);
  });

  // Update ring
  const circumference = 175.9;
  const offset = circumference - (total / 5) * circumference;
  document.getElementById('progress-ring').style.strokeDashoffset = offset;
  document.getElementById('ring-count').textContent = `${total}/5`;
  const col = total===5?'#4ade80':total>=3?'#fbbf24':total>0?'#f87171':'rgba(255,255,255,0.2)';
  document.getElementById('progress-ring').style.stroke = col;

  // Extra ibadah today
  renderTodayExtras(key, data);
}

function setPrayerMode(event, key, prayerKey, mode) {
  event.stopPropagation();
  if (!db[key]) db[key] = { subuh:false, dzuhur:false, ashar:false, maghrib:false, isya:false, dhuha:false, tahajud:false, quran:0, puasa:false, note:'' };
  // Toggle: if already this mode, un-check
  if (db[key][prayerKey] === mode) {
    db[key][prayerKey] = false;
    showToast(`❌ ${PRAYERS.find(p=>p.key===prayerKey).label} dibatalkan`);
  } else {
    db[key][prayerKey] = mode;
    const modeLabel = mode === 'jamaah' ? 'berjamaah 🕌' : 'sendiri 🧍';
    showToast(`✅ ${PRAYERS.find(p=>p.key===prayerKey).label} — ${modeLabel}`);
  }
  saveData();
  renderAll();
}

function togglePrayer(key, prayerKey) {
  if (!db[key]) db[key] = { subuh:false, dzuhur:false, ashar:false, maghrib:false, isya:false, dhuha:false, tahajud:false, quran:0, puasa:false, note:'' };
  const cur = db[key][prayerKey];
  if (!cur || cur === false) {
    db[key][prayerKey] = 'sendiri'; // default to sendiri
    showToast(`✅ ${PRAYERS.find(p=>p.key===prayerKey).label} tercatat!`);
  } else {
    db[key][prayerKey] = false;
    showToast(`❌ ${PRAYERS.find(p=>p.key===prayerKey).label} dibatalkan`);
  }
  saveData();
  renderAll();
}

// ── RENDER: TODAY EXTRAS ───────────────────
function renderTodayExtras(key, data) {
  // Dhuha
  const dhuhaToggle = document.getElementById('today-dhuha');
  if (dhuhaToggle) {
    dhuhaToggle.className = 'toggle-extra' + (data.dhuha ? ' on' : '');
    dhuhaToggle.onclick = () => toggleExtra(key, 'dhuha');
  }
  // Tahajud
  const tahajudToggle = document.getElementById('today-tahajud');
  if (tahajudToggle) {
    tahajudToggle.className = 'toggle-extra' + (data.tahajud ? ' on' : '');
    tahajudToggle.onclick = () => toggleExtra(key, 'tahajud');
  }
  // Quran
  const quranInput = document.getElementById('today-quran');
  if (quranInput) {
    quranInput.value = data.quran || 0;
    quranInput.onchange = (e) => {
      if (!db[key]) db[key] = getDayData(key);
      db[key].quran = Math.max(0, parseInt(e.target.value) || 0);
      saveData();
      showToast(`📖 Quran: ${db[key].quran} halaman`);
    };
  }
  // Puasa
  const puasaToggle = document.getElementById('today-puasa');
  if (puasaToggle) {
    puasaToggle.className = 'toggle-extra' + (data.puasa ? ' on' : '');
    puasaToggle.onclick = () => toggleExtra(key, 'puasa');
  }
}

function toggleExtra(key, field) {
  if (!db[key]) db[key] = getDayData(key);
  db[key][field] = !db[key][field];
  saveData();
  const labels = { dhuha:'Sholat Dhuha', tahajud:'Sholat Tahajud', puasa:'Puasa' };
  showToast(db[key][field] ? `✅ ${labels[field]} tercatat!` : `❌ ${labels[field]} dibatalkan`);
  renderAll();
}

// ── RENDER: STATS CARDS ────────────────────
function renderStats() {
  const streak = calcStreak();
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('streak-display').textContent = streak;
  const ms = getMonthStats(currentYear, currentMonth);
  document.getElementById('stat-month-complete').textContent = ms.fullDays;
  document.getElementById('stat-total-prayer').textContent = ms.totalPrayers;
  document.getElementById('stat-percent').textContent = ms.pct + '%';
  // Target
  const goal = settings.target || 150;
  document.getElementById('target-current').textContent = ms.totalPrayers;
  document.getElementById('target-goal').textContent = goal;
  const pct = Math.min(100, Math.round((ms.totalPrayers / goal) * 100));
  document.getElementById('target-bar-fill').style.width = pct + '%';
  document.getElementById('target-motivation').textContent =
    settings.motivation || MOTIVASI_QUOTES[new Date().getDate() % MOTIVASI_QUOTES.length];
  // Extra stats
  const esDhuha   = document.getElementById('es-dhuha');
  const esTahajud = document.getElementById('es-tahajud');
  const esQuran   = document.getElementById('es-quran');
  const esPuasa   = document.getElementById('es-puasa');
  if (esDhuha)   esDhuha.textContent   = ms.dhuhaCount;
  if (esTahajud) esTahajud.textContent = ms.tahajudCount;
  if (esQuran)   esQuran.textContent   = ms.totalQuran + ' hal';
  if (esPuasa)   esPuasa.textContent   = ms.puasaCount;
}

// ── RENDER: MINI CALENDAR ──────────────────
function renderMiniCalendar() {
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${MONTHS_ID[currentMonth]} ${currentYear}`;
  const label2 = document.getElementById('tracker-month-label');
  if (label2) label2.textContent = `${MONTHS_ID[currentMonth]} ${currentYear}`;

  const container = document.getElementById('mini-calendar');
  if (!container) return;
  container.innerHTML = '';
  DAYS_SHORT.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-header'; el.textContent = d;
    container.appendChild(el);
  });
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty';
    container.appendChild(el);
  }
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div'); el.className = 'cal-day';
    el.textContent = d;
    const key = dateKey(currentYear, currentMonth, d);
    const data = getDayData(key);
    const cnt = countPrayers(data);
    const isToday = (d===TODAY.getDate()&&currentMonth===TODAY.getMonth()&&currentYear===TODAY.getFullYear());
    if (isToday) el.classList.add('today');
    if (cnt===5) el.classList.add('status-full');
    else if (cnt>=3) el.classList.add('status-partial');
    else if (cnt>0) el.classList.add('status-low');
    el.title = `${d} ${MONTHS_ID[currentMonth]}: ${cnt}/5 sholat`;
    el.onclick = () => { showView('tracker'); setTimeout(() => { const row = document.querySelector(`[data-day="${d}"]`); if(row) row.scrollIntoView({behavior:'smooth',block:'center'}); }, 100); };
    container.appendChild(el);
  }
}

// ── RENDER: TRACKER TABLE ──────────────────
function renderTrackerTable() {
  const tbody = document.getElementById('tracker-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(currentYear, currentMonth, d);
    const data = getDayData(key);
    const cnt  = countPrayers(data);
    const date = new Date(currentYear, currentMonth, d);
    const dayName = DAYS_ID[date.getDay()];
    const isToday  = (d===TODAY.getDate()&&currentMonth===TODAY.getMonth()&&currentYear===TODAY.getFullYear());
    const isFriday = (date.getDay()===5);

    const tr = document.createElement('tr');
    tr.dataset.day = d;
    if (isToday)  tr.classList.add('is-today');
    if (cnt===5)  tr.classList.add('status-full');
    else if (cnt>=3) tr.classList.add('status-partial');
    else if (cnt>0&&cnt<3) tr.classList.add('status-low');

    tr.innerHTML = `
      <td class="td-date">${d} ${MONTHS_ID[currentMonth].slice(0,3)}${isToday?' 📍':''}</td>
      <td class="td-day" style="${isFriday?'color:var(--gold-light);font-weight:700':''}">${dayName}${isFriday?' 🕌':''}</td>
    `;

    // Prayer cells with mode
    PRAYERS.forEach(p => {
      const td  = document.createElement('td');
      const val = data[p.key];
      const done = isPrayerDone(val);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

      const btn = document.createElement('button');
      btn.className = 'prayer-checkbox' + (done ? ' checked' : '');
      btn.innerHTML = done ? '✓' : '';
      btn.title = `${done?'Batalkan':'Centang'} ${p.label}`;
      btn.onclick = () => { togglePrayer(key, p.key); };
      wrap.appendChild(btn);

      // Mode badge
      if (done) {
        const badge = document.createElement('span');
        badge.className = `jamaah-badge ${val==='jamaah'?'jamaah':val==='sendiri'?'sendiri':'none'}`;
        badge.textContent = val==='jamaah'?'jamaah':val==='sendiri'?'sendiri':'';
        // Clicking badge cycles mode
        badge.style.cursor = 'pointer';
        badge.title = 'Klik untuk ganti mode';
        badge.onclick = () => {
          if (!db[key]) db[key] = getDayData(key);
          db[key][p.key] = db[key][p.key]==='sendiri'?'jamaah':'sendiri';
          saveData(); renderTrackerTable(); renderStats();
          showToast(`🔄 ${p.label} → ${db[key][p.key]==='jamaah'?'Berjamaah 🕌':'Sendiri 🧍'}`);
        };
        wrap.appendChild(badge);
      }
      td.appendChild(wrap);
      tr.appendChild(td);
    });

    // Dhuha
    const tdDhuha = document.createElement('td');
    const btnDhuha = document.createElement('button');
    btnDhuha.className = 'prayer-checkbox' + (data.dhuha ? ' checked' : '');
    btnDhuha.innerHTML = data.dhuha ? '✓' : '';
    btnDhuha.style.cssText = 'background:' + (data.dhuha ? 'rgba(245,158,11,0.3);border-color:#f59e0b' : '') + ';';
    btnDhuha.onclick = () => { toggleExtra(key, 'dhuha'); };
    tdDhuha.appendChild(btnDhuha);
    tr.appendChild(tdDhuha);

    // Tahajud
    const tdTahajud = document.createElement('td');
    const btnTahajud = document.createElement('button');
    btnTahajud.className = 'prayer-checkbox' + (data.tahajud ? ' checked' : '');
    btnTahajud.innerHTML = data.tahajud ? '✓' : '';
    btnTahajud.style.cssText = 'background:' + (data.tahajud ? 'rgba(147,51,234,0.3);border-color:#a855f7' : '') + ';';
    btnTahajud.onclick = () => { toggleExtra(key, 'tahajud'); };
    tdTahajud.appendChild(btnTahajud);
    tr.appendChild(tdTahajud);

    // Quran pages
    const tdQuran = document.createElement('td');
    const qInput = document.createElement('input');
    qInput.type = 'number'; qInput.min = '0'; qInput.max = '604';
    qInput.value = data.quran || 0;
    qInput.className = 'quran-input';
    qInput.style.cssText = 'width:52px;margin:0 auto;display:block;';
    qInput.onchange = (e) => {
      if (!db[key]) db[key] = getDayData(key);
      db[key].quran = Math.max(0, parseInt(e.target.value) || 0);
      saveData();
    };
    tdQuran.appendChild(qInput);
    tr.appendChild(tdQuran);

    // Puasa
    const tdPuasa = document.createElement('td');
    const btnPuasa = document.createElement('button');
    btnPuasa.className = 'prayer-checkbox' + (data.puasa ? ' checked' : '');
    btnPuasa.innerHTML = data.puasa ? '✓' : '';
    btnPuasa.style.cssText = 'background:' + (data.puasa ? 'rgba(239,68,68,0.2);border-color:#ef4444' : '') + ';';
    btnPuasa.onclick = () => { toggleExtra(key, 'puasa'); };
    tdPuasa.appendChild(btnPuasa);
    tr.appendChild(tdPuasa);

    // Total
    const tdTotal = document.createElement('td');
    const badge = document.createElement('div');
    badge.className = `total-badge ${cnt===5?'total-5':cnt>=3?'total-34':cnt>0?'total-low':'total-0'}`;
    badge.textContent = cnt;
    tdTotal.appendChild(badge);
    tr.appendChild(tdTotal);

    // Note
    const tdNote = document.createElement('td');
    tdNote.className = 'td-note';
    const input = document.createElement('input');
    input.type = 'text'; input.value = data.note || '';
    input.placeholder = 'Catatan...'; input.maxLength = 80;
    input.oninput = (e) => {
      if (!db[key]) db[key] = getDayData(key);
      db[key].note = e.target.value; saveData();
    };
    tdNote.appendChild(input);
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  }
}

// ── RENDER: STATISTICS ─────────────────────
function renderStatistics() {
  renderPrayerBars();
  renderWeeklyChart();
  renderHeatmap();
  renderSummaryGrid();
}

function renderPrayerBars() {
  const container = document.getElementById('prayer-bars');
  if (!container) return;
  container.innerHTML = '';
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const colors = ['#4ade80','#22c55e','#16a34a','#15803d','#4ade80'];
  PRAYERS.forEach((p, i) => {
    let cnt = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(currentYear, currentMonth, d);
      if (isPrayerDone(getDayData(key)[p.key])) cnt++;
    }
    const pct = Math.round((cnt / daysInMonth) * 100);
    const row = document.createElement('div');
    row.className = 'prayer-bar-row';
    row.innerHTML = `
      <div class="prayer-bar-label">${p.icon} ${p.label}</div>
      <div class="prayer-bar-track"><div class="prayer-bar-fill" style="width:${pct}%;background:${colors[i]};box-shadow:0 0 8px ${colors[i]}60"></div></div>
      <div class="prayer-bar-val">${pct}%</div>`;
    container.appendChild(row);
  });

  // Jamaah stats bar
  const ms = getMonthStats(currentYear, currentMonth);
  const jamaahPct = ms.totalPrayers > 0 ? Math.round((ms.jamaahCount / ms.totalPrayers) * 100) : 0;
  const jRow = document.createElement('div');
  jRow.className = 'prayer-bar-row';
  jRow.innerHTML = `
    <div class="prayer-bar-label">🕌 Jamaah</div>
    <div class="prayer-bar-track"><div class="prayer-bar-fill" style="width:${jamaahPct}%;background:#f59e0b;box-shadow:0 0 8px #f59e0b60"></div></div>
    <div class="prayer-bar-val" style="color:var(--gold-light)">${jamaahPct}%</div>`;
  container.appendChild(jRow);
}

function renderWeeklyChart() {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const weeks = [];
  for (let w = 0; w < 5; w++) {
    const start = w * 7 + 1, end = Math.min(start + 6, daysInMonth);
    if (start > daysInMonth) break;
    let total = 0;
    for (let d = start; d <= end; d++) {
      const key = dateKey(currentYear, currentMonth, d);
      total += countPrayers(getDayData(key));
    }
    weeks.push({ label: `Mg ${w+1}`, total, maxPossible: (end - start + 1) * 5 });
  }
  const W = canvas.parentElement.clientWidth || 500;
  canvas.width = W; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, 180);
  const barW = Math.floor((W - 60) / weeks.length) - 16, maxH = 130, baseY = 155;
  weeks.forEach((w, i) => {
    const x = 30 + i * ((W - 60) / weeks.length) + 8;
    const h = Math.round((w.total / w.maxPossible) * maxH);
    const pct = Math.round((w.total / w.maxPossible) * 100);
    const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    grad.addColorStop(0, '#4ade80'); grad.addColorStop(1, '#15803d');
    ctx.shadowColor = '#4ade8060'; ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, baseY - h, barW, h, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#86efac'; ctx.font = 'bold 11px "Plus Jakarta Sans",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.label, x + barW / 2, baseY + 16);
    ctx.fillStyle = '#bbf7d0'; ctx.font = 'bold 12px "JetBrains Mono",monospace';
    ctx.fillText(pct + '%', x + barW / 2, baseY - h - 6);
  });
  ctx.fillStyle = '#4b5563'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Keberhasilan', 2, 12);
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if (!container) return;
  container.innerHTML = '';
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  DAYS_SHORT.forEach(d => {
    const el = document.createElement('div');
    el.style.cssText = 'text-align:center;font-size:10px;color:var(--text-dim);font-weight:600;padding:3px 0';
    el.textContent = d; container.appendChild(el);
  });
  for (let i = 0; i < firstDay; i++) container.appendChild(document.createElement('div'));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(currentYear, currentMonth, d);
    const cnt = countPrayers(getDayData(key));
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell'; cell.dataset.level = cnt;
    cell.title = `${d} ${MONTHS_ID[currentMonth]}: ${cnt}/5 sholat`;
    container.appendChild(cell);
  }
}

function renderSummaryGrid() {
  const container = document.getElementById('summary-grid');
  if (!container) return;
  const ms = getMonthStats(currentYear, currentMonth);
  const streak = calcStreak();
  const items = [
    { label: 'Total Sholat',       value: ms.totalPrayers },
    { label: 'Hari Lengkap',       value: ms.fullDays },
    { label: 'Persen Keberhasilan',value: ms.pct + '%' },
    { label: 'Streak Saat Ini',    value: `🔥 ${streak} hari` },
    { label: 'Sholat Berjamaah',   value: `🕌 ${ms.jamaahCount}x` },
    { label: 'Sholat Dhuha',       value: `☀️ ${ms.dhuhaCount} hari` },
    { label: 'Sholat Tahajud',     value: `🌙 ${ms.tahajudCount} hari` },
    { label: 'Total Quran',        value: `📖 ${ms.totalQuran} hal` },
    { label: 'Hari Puasa',         value: `🍽️ ${ms.puasaCount} hari` },
    { label: 'Hari Diisi',         value: `${ms.filledDays} / ${ms.daysInMonth}` },
  ];
  container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'summary-item';
    div.innerHTML = `<div class="summary-item-label">${item.label}</div><div class="summary-item-value">${item.value}</div>`;
    container.appendChild(div);
  });
}

// ── MONTH NAV ──────────────────────────────
function prevMonth() {
  if (currentMonth===0){currentMonth=11;currentYear--;} else currentMonth--;
  renderAll();
}
function nextMonth() {
  if (currentMonth===11){currentMonth=0;currentYear++;} else currentMonth++;
  renderAll();
}

// ── TARGET EDIT ────────────────────────────
function editTarget() {
  const newTarget = prompt('Masukkan target sholat bulan ini:', settings.target || 150);
  if (newTarget!==null && !isNaN(parseInt(newTarget))) {
    settings.target = Math.max(1, Math.min(155, parseInt(newTarget)));
    const newMotiv = prompt('Masukkan motivasi kamu:', settings.motivation || '');
    if (newMotiv!==null) settings.motivation = newMotiv;
    saveData(); renderStats(); showToast('🎯 Target berhasil diperbarui!');
  }
}

// ── SETTINGS ──────────────────────────────
function loadSettingsForm() {
  const sn = document.getElementById('set-name');
  const st = document.getElementById('set-target');
  const sm = document.getElementById('set-motivation');
  if (sn) sn.value = settings.name || currentUser?.name || '';
  if (st) st.value = settings.target || 150;
  if (sm) sm.value = settings.motivation || '';
}

function saveSettings() {
  settings.name       = document.getElementById('set-name').value.trim();
  settings.target     = parseInt(document.getElementById('set-target').value) || 150;
  settings.motivation = document.getElementById('set-motivation').value.trim();
  saveData(); renderStats(); showToast('✅ Pengaturan tersimpan!');
}

// ── EXPORT / IMPORT / RESET ────────────────
function exportData() {
  const json = JSON.stringify({ db, settings }, null, 2);
  const blob = new Blob([json], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sholat-tracker-${currentUser?.username||'user'}-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); showToast('📤 Data berhasil diekspor!');
}

function importData(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      db = parsed.db || {}; settings = { ...settings, ...(parsed.settings || {}) };
      saveData(); loadSettingsForm(); renderAll(); showToast('📥 Data berhasil diimport!');
    } catch { showToast('❌ File tidak valid!'); }
  };
  reader.readAsText(file);
}

function resetData() {
  if (confirm('Yakin ingin menghapus SEMUA data? Tindakan ini tidak dapat dibatalkan.')) {
    db = {}; saveData(); renderAll(); showToast('🗑️ Semua data dihapus.');
  }
}

function shareToAdmin() {
  syncToAdmin(); showToast('📡 Data berhasil dikirim ke admin!');
}

// ── PRINT ──────────────────────────────────
function printView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('print-target'));
  document.getElementById('view-' + viewName).classList.add('print-target');
  const name = settings.name || currentUser?.name || 'Pengguna';
  const now  = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  ['dashboard','tracker','statistics'].forEach(v => {
    const pn = document.getElementById('print-name-' + v);
    const pd = document.getElementById('print-date-' + v);
    if (pn) pn.textContent = 'Nama: ' + name;
    if (pd) pd.textContent = 'Dicetak: ' + now;
  });
  window.print();
}

// ── RENDER ALL ─────────────────────────────
function renderAll() {
  renderHeader();
  renderTodayPrayers();
  renderStats();
  renderMiniCalendar();
  renderTrackerTable();
  loadSettingsForm();
  if (currentView==='statistics') renderStatistics();
}

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  loadData();
  // Sync name from user session if no settings name
  if (!settings.name && currentUser?.name) {
    settings.name = currentUser.name;
    saveData();
  }
  renderAll();
  window.addEventListener('resize', () => {
    if (currentView==='statistics') renderWeeklyChart();
  });
});
