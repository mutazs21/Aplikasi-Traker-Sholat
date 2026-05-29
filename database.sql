-- ============================================
--  SHOLAT TRACKER — Database Schema (MySQL)
-- ============================================

CREATE DATABASE IF NOT EXISTS sholat_tracker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE sholat_tracker;

-- ── Tabel Users ──────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash
  name        VARCHAR(100) NOT NULL,
  role        ENUM('admin','user') DEFAULT 'user',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabel Prayer Records ──────────────────────
CREATE TABLE IF NOT EXISTS prayer_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  tanggal     DATE         NOT NULL,
  subuh       ENUM('false','sendiri','jamaah') DEFAULT 'false',
  dzuhur      ENUM('false','sendiri','jamaah') DEFAULT 'false',
  ashar       ENUM('false','sendiri','jamaah') DEFAULT 'false',
  maghrib     ENUM('false','sendiri','jamaah') DEFAULT 'false',
  isya        ENUM('false','sendiri','jamaah') DEFAULT 'false',
  dhuha       TINYINT(1)   DEFAULT 0,
  tahajud     TINYINT(1)   DEFAULT 0,
  quran_pages SMALLINT     DEFAULT 0,
  puasa       TINYINT(1)   DEFAULT 0,
  note        TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, tanggal),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Tabel User Settings ───────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     INT PRIMARY KEY,
  display_name VARCHAR(100) DEFAULT '',
  target      SMALLINT DEFAULT 150,
  motivation  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Default Admin Account ─────────────────────
-- Password: admin123  (ganti setelah login pertama!)
INSERT IGNORE INTO users (username, password, name, role)
VALUES ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin');
-- Note: hash di atas = 'password' untuk testing.
-- Jalankan hash_password.php untuk generate hash 'admin123' yang benar.
