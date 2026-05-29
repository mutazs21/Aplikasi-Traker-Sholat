<?php
// ============================================
//  api/settings.php — User Settings
//  GET  /api/settings.php   → ambil settings
//  POST /api/settings.php   → simpan settings
// ============================================
require_once __DIR__ . '/../config/auth.php';
setCorsHeaders();

$user   = requireAuth();
$userId = (int)$user['sub'];
$db     = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('SELECT * FROM user_settings WHERE user_id = ?');
    $stmt->execute([$userId]);
    $s = $stmt->fetch();
    if (!$s) {
        // Buat default jika belum ada
        $db->prepare('INSERT INTO user_settings (user_id) VALUES (?)')->execute([$userId]);
        $s = ['user_id' => $userId, 'display_name' => '', 'target' => 150, 'motivation' => ''];
    }
    jsonResponse(['success' => true, 'data' => [
        'name'       => $s['display_name'],
        'target'     => (int)$s['target'],
        'motivation' => $s['motivation'] ?? '',
    ]]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = getBody();
    $db->prepare('INSERT INTO user_settings (user_id, display_name, target, motivation)
                  VALUES (?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    display_name = VALUES(display_name),
                    target = VALUES(target),
                    motivation = VALUES(motivation)')
       ->execute([
           $userId,
           substr($body['name'] ?? '', 0, 100),
           max(1, (int)($body['target'] ?? 150)),
           substr($body['motivation'] ?? '', 0, 500),
       ]);
    jsonResponse(['success' => true, 'message' => 'Pengaturan tersimpan']);
}

jsonResponse(['success' => false, 'message' => 'Method tidak dikenal'], 405);
