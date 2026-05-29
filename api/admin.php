<?php
// ============================================
//  api/admin.php — Panel Admin
//  GET  /api/admin.php?action=users        → list semua user + ringkasan
//  GET  /api/admin.php?action=user_detail&id=1  → detail satu user
//  POST /api/admin.php?action=delete_user  → hapus user (body: {id})
//  POST /api/admin.php?action=change_role  → ubah role (body: {id, role})
// ============================================
require_once __DIR__ . '/../config/auth.php';
setCorsHeaders();

$admin  = requireAdmin();
$db     = getDB();
$action = $_GET['action'] ?? '';

// ── List semua user ───────────────────────────
if ($action === 'users') {
    $stmt = $db->query('
        SELECT u.id, u.username, u.name, u.role, u.created_at,
               COUNT(pr.id) AS total_records,
               MAX(pr.tanggal) AS last_activity
        FROM users u
        LEFT JOIN prayer_records pr ON pr.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ');
    $users = $stmt->fetchAll();

    // Tambahkan statistik per user
    foreach ($users as &$u) {
        $stmt2 = $db->prepare('
            SELECT
              SUM(subuh   != "false") AS subuh,
              SUM(dzuhur  != "false") AS dzuhur,
              SUM(ashar   != "false") AS ashar,
              SUM(maghrib != "false") AS maghrib,
              SUM(isya    != "false") AS isya
            FROM prayer_records WHERE user_id = ?
        ');
        $stmt2->execute([$u['id']]);
        $u['prayer_totals'] = $stmt2->fetch();
    }
    jsonResponse(['success' => true, 'data' => $users]);
}

// ── Detail satu user ──────────────────────────
if ($action === 'user_detail') {
    $id   = (int)($_GET['id'] ?? 0);
    $stmt = $db->prepare('SELECT id, username, name, role, created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['success' => false, 'message' => 'User tidak ditemukan'], 404);

    $stmt2 = $db->prepare('SELECT * FROM prayer_records WHERE user_id = ? ORDER BY tanggal DESC LIMIT 30');
    $stmt2->execute([$id]);
    $records = $stmt2->fetchAll();

    jsonResponse(['success' => true, 'data' => ['user' => $user, 'records' => $records]]);
}

// ── Hapus user ────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_user') {
    $body = getBody();
    $id   = (int)($body['id'] ?? 0);
    if ($id === (int)$admin['sub']) {
        jsonResponse(['success' => false, 'message' => 'Tidak bisa menghapus akun sendiri'], 400);
    }
    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true, 'message' => 'User dihapus']);
}

// ── Ubah role ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'change_role') {
    $body = getBody();
    $id   = (int)($body['id']   ?? 0);
    $role = $body['role'] ?? '';
    if (!in_array($role, ['admin','user'])) {
        jsonResponse(['success' => false, 'message' => 'Role tidak valid'], 400);
    }
    $db->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $id]);
    jsonResponse(['success' => true, 'message' => 'Role diperbarui']);
}

jsonResponse(['success' => false, 'message' => 'Action tidak dikenal'], 400);
