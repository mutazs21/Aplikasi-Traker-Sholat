<?php
// ============================================
//  api/auth.php — Login & Register
//  POST /api/auth.php?action=login
//  POST /api/auth.php?action=register
// ============================================
require_once __DIR__ . '/../config/auth.php';
setCorsHeaders();

$action = $_GET['action'] ?? '';
$body   = getBody();

// ── REGISTER ─────────────────────────────────
if ($action === 'register') {
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');
    $name     = trim($body['name']     ?? '');

    if (!$username || !$password || !$name) {
        jsonResponse(['success' => false, 'message' => 'Semua field wajib diisi'], 400);
    }
    if (strlen($username) < 3 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        jsonResponse(['success' => false, 'message' => 'Username minimal 3 karakter, hanya huruf/angka/underscore'], 400);
    }
    if (strlen($password) < 4) {
        jsonResponse(['success' => false, 'message' => 'Password minimal 4 karakter'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Username sudah dipakai'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, "user")');
    $stmt->execute([$username, $hash, $name]);
    $userId = (int)$db->lastInsertId();

    // Buat settings default
    $db->prepare('INSERT INTO user_settings (user_id) VALUES (?)')->execute([$userId]);

    jsonResponse(['success' => true, 'message' => 'Akun berhasil dibuat! Silakan login.']);
}

// ── LOGIN ─────────────────────────────────────
if ($action === 'login') {
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$username || !$password) {
        jsonResponse(['success' => false, 'message' => 'Username dan password wajib diisi'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT id, username, password, name, role FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonResponse(['success' => false, 'message' => 'Username atau password salah'], 401);
    }

    $token = createToken([
        'sub'      => $user['id'],
        'username' => $user['username'],
        'name'     => $user['name'],
        'role'     => $user['role'],
        'exp'      => time() + (7 * 24 * 3600), // token berlaku 7 hari
    ]);

    jsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'       => $user['id'],
            'username' => $user['username'],
            'name'     => $user['name'],
            'role'     => $user['role'],
        ],
    ]);
}

jsonResponse(['success' => false, 'message' => 'Action tidak dikenal'], 400);
