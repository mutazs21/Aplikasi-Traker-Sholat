<?php
// ============================================
//  api/records.php — CRUD Prayer Records
//
//  GET    /api/records.php?year=2025&month=6   → data 1 bulan
//  GET    /api/records.php?date=2025-06-01     → data 1 hari
//  POST   /api/records.php                     → simpan/update 1 hari
//  DELETE /api/records.php?date=2025-06-01     → hapus 1 hari
//  DELETE /api/records.php?all=1               → hapus semua data user
// ============================================
require_once __DIR__ . '/../config/auth.php';
setCorsHeaders();

$user   = requireAuth();
$userId = (int)$user['sub'];
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Ambil data ───────────────────────────
if ($method === 'GET') {
    if (isset($_GET['date'])) {
        // Satu hari
        $stmt = $db->prepare('SELECT * FROM prayer_records WHERE user_id = ? AND tanggal = ?');
        $stmt->execute([$userId, $_GET['date']]);
        $row = $stmt->fetch();
        jsonResponse(['success' => true, 'data' => $row ?: null]);
    }

    if (isset($_GET['year']) && isset($_GET['month'])) {
        // Satu bulan
        $year  = (int)$_GET['year'];
        $month = (int)$_GET['month'];
        $from  = sprintf('%04d-%02d-01', $year, $month);
        $to    = sprintf('%04d-%02d-%02d', $year, $month, cal_days_in_month(CAL_GREGORIAN, $month, $year));
        $stmt  = $db->prepare('SELECT * FROM prayer_records WHERE user_id = ? AND tanggal BETWEEN ? AND ?');
        $stmt->execute([$userId, $from, $to]);
        $rows  = $stmt->fetchAll();
        // Ubah ke format {dateKey: data} seperti di localStorage
        $result = [];
        foreach ($rows as $r) {
            $result[$r['tanggal']] = formatRecord($r);
        }
        jsonResponse(['success' => true, 'data' => $result]);
    }

    // Seluruh data (untuk export/settings)
    $stmt = $db->prepare('SELECT * FROM prayer_records WHERE user_id = ? ORDER BY tanggal');
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $r) {
        $result[$r['tanggal']] = formatRecord($r);
    }
    jsonResponse(['success' => true, 'data' => $result]);
}

// ── POST: Simpan/Update data ──────────────────
if ($method === 'POST') {
    $body = getBody();
    $date = $body['date'] ?? '';
    if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        jsonResponse(['success' => false, 'message' => 'Format tanggal tidak valid (YYYY-MM-DD)'], 400);
    }

    $allowed = ['subuh','dzuhur','ashar','maghrib','isya'];
    $validEnum = ['false','sendiri','jamaah'];

    $cols = [];
    $vals = [];
    foreach ($allowed as $p) {
        $v = $body[$p] ?? 'false';
        $cols[] = $p;
        $vals[] = in_array($v, $validEnum) ? $v : 'false';
    }
    $boolFields = ['dhuha','tahajud','puasa'];
    foreach ($boolFields as $f) {
        $cols[] = $f;
        $vals[] = !empty($body[$f]) ? 1 : 0;
    }
    $cols[] = 'quran_pages'; $vals[] = max(0, (int)($body['quran_pages'] ?? 0));
    $cols[] = 'note';        $vals[] = substr($body['note'] ?? '', 0, 1000);

    $setClauses = implode(', ', array_map(fn($c) => "$c = ?", $cols));
    $colNames   = implode(', ', $cols);
    $placeholders = implode(', ', array_fill(0, count($cols), '?'));

    $sql = "INSERT INTO prayer_records (user_id, tanggal, $colNames)
            VALUES (?, ?, $placeholders)
            ON DUPLICATE KEY UPDATE $setClauses";

    $params = array_merge([$userId, $date], $vals, $vals);
    $db->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Data tersimpan']);
}

// ── DELETE ────────────────────────────────────
if ($method === 'DELETE') {
    if (isset($_GET['all'])) {
        $db->prepare('DELETE FROM prayer_records WHERE user_id = ?')->execute([$userId]);
        jsonResponse(['success' => true, 'message' => 'Semua data dihapus']);
    }
    if (isset($_GET['date'])) {
        $db->prepare('DELETE FROM prayer_records WHERE user_id = ? AND tanggal = ?')
           ->execute([$userId, $_GET['date']]);
        jsonResponse(['success' => true, 'message' => 'Data dihapus']);
    }
    jsonResponse(['success' => false, 'message' => 'Parameter tidak lengkap'], 400);
}

jsonResponse(['success' => false, 'message' => 'Method tidak dikenal'], 405);

// ── Helper ────────────────────────────────────
function formatRecord(array $r): array {
    return [
        'subuh'       => $r['subuh']   === 'false' ? false : $r['subuh'],
        'dzuhur'      => $r['dzuhur']  === 'false' ? false : $r['dzuhur'],
        'ashar'       => $r['ashar']   === 'false' ? false : $r['ashar'],
        'maghrib'     => $r['maghrib'] === 'false' ? false : $r['maghrib'],
        'isya'        => $r['isya']    === 'false' ? false : $r['isya'],
        'dhuha'       => (bool)$r['dhuha'],
        'tahajud'     => (bool)$r['tahajud'],
        'quran_pages' => (int)$r['quran_pages'],
        'puasa'       => (bool)$r['puasa'],
        'note'        => $r['note'] ?? '',
    ];
}
