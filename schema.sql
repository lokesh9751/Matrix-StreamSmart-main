-- StreamSmart Database Schema
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS streamsmart_db;
USE streamsmart_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    role ENUM('tester', 'admin') NOT NULL DEFAULT 'tester',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sample Videos & Quality Variants
CREATE TABLE IF NOT EXISTS video_samples (
    video_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    stream_url VARCHAR(512) NOT NULL,
    available_tiers VARCHAR(100) NOT NULL DEFAULT '240p,360p,480p,720p,1080p',
    duration_sec INT NOT NULL DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Network Scenario Presets
CREATE TABLE IF NOT EXISTS network_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    profile_name VARCHAR(60) NOT NULL,
    bandwidth_kbps INT NOT NULL,
    latency_ms INT NOT NULL,
    packet_loss_pct DECIMAL(4,2) DEFAULT 0.00,
    cache_hit_prob DECIMAL(3,2) DEFAULT 0.50
);

-- 4. Benchmark Test Sessions
CREATE TABLE IF NOT EXISTS test_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    video_id INT NULL,
    profile_id INT NULL,
    sim_bandwidth_kbps INT NOT NULL,
    sim_latency_ms INT NOT NULL,
    sim_cache_hit_prob DECIMAL(3,2) NOT NULL,
    measurement_mode ENUM('SIMULATED', 'REAL_BROWSER') DEFAULT 'SIMULATED',
    test_duration_sec INT NOT NULL DEFAULT 30,
    status ENUM('running', 'completed', 'stopped') DEFAULT 'running',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (video_id) REFERENCES video_samples(video_id) ON DELETE SET NULL,
    FOREIGN KEY (profile_id) REFERENCES network_profiles(profile_id) ON DELETE SET NULL
);

-- 5. Aggregated Player Results (2 rows per session: BASELINE vs OPTIMIZED)
CREATE TABLE IF NOT EXISTS player_metrics (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    player_type ENUM('BASELINE', 'OPTIMIZED') NOT NULL,
    startup_delay_ms INT NOT NULL DEFAULT 0,
    stall_count INT NOT NULL DEFAULT 0,
    total_stall_duration_sec DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    avg_bitrate_kbps INT NOT NULL DEFAULT 0,
    quality_switches INT NOT NULL DEFAULT 0,
    cache_hits INT NOT NULL DEFAULT 0,
    cache_misses INT NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES test_sessions(session_id) ON DELETE CASCADE
);

-- 6. Granular Playback Event Log
CREATE TABLE IF NOT EXISTS playback_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    player_type ENUM('BASELINE', 'OPTIMIZED') NOT NULL,
    event_type ENUM('STARTUP', 'QUALITY_SWITCH', 'BUFFER_STALL', 'BUFFER_RESUME', 'SEGMENT_FETCH') NOT NULL,
    elapsed_sec DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    resolution_label VARCHAR(20) NOT NULL DEFAULT 'unknown',
    buffer_level_sec DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    simulated_delay_ms INT DEFAULT 0,
    is_cache_hit BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (session_id) REFERENCES test_sessions(session_id) ON DELETE CASCADE
);

