<?php
// ============================================
//  config/db.php — Koneksi Database
// ============================================
// Ganti nilai di bawah sesuai konfigurasi MySQL kamu

define('DB_HOST', 'localhost');
define('DB_NAME', 'sholat_tracker');
define('DB_USER', 'root');          // ganti dengan username MySQL kamu
define('DB_PASS', '');              // ganti dengan password MySQL kamu
define('DB_CHARSET', 'utf8mb4');

define('JWT_SECRET', 'ganti_dengan_string_random_panjang_min_32_karakter');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Koneksi database gagal: ' . $e->getMessage()]));
        }
    }
    return $pdo;
}
