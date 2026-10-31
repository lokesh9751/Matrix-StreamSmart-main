/**
 * scripts/initDatabase.js – StreamSmart Automatic MySQL Database Initializer
 *
 * Capabilities:
 *  1. Connects to the MySQL server without selecting a database.
 *  2. Creates the target database using `CREATE DATABASE IF NOT EXISTS`.
 *  3. Selects the database (`USE <dbName>`).
 *  4. Executes `schema.sql` to create all required tables, constraints, and indexes.
 *  5. Seeds default video samples, network profiles, and roles using `INSERT IGNORE`.
 *  6. Does NOT destroy or drop existing data.
 *  7. Can be safely executed multiple times.
 *
 * Usage:
 *  CLI: node scripts/initDatabase.js (or `npm run db:init`)
 *  Module: require('./scripts/initDatabase')()
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'streamsmart_db'
  };
}

async function initDatabase(options = { verbose: true }) {
  const { host, port, user, password, database } = getDbConfig();
  const verbose = options.verbose !== false;

  if (verbose) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 StreamSmart – MySQL Database Initialization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Connecting to MySQL server at: ${host}:${port}`);
    console.log(`👤 User: ${user} | Target Database: ${database}`);
    console.log(`🔑 Password: ${password ? '******** (configured)' : '(empty)'}`);
  }

  let connection;

  try {
    // Step 1: Connect to MySQL server without selecting a database
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      connectTimeout: 10000
    });

    if (verbose) {
      console.log('✅ Connected to MySQL server successfully.');
    }

    // Step 2: Create the database if it doesn't already exist
    if (verbose) {
      console.log(`📦 Creating database '${database}' if not exists...`);
    }
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );

    // Step 3: Switch to the database
    await connection.query(`USE \`${database}\`;`);
    if (verbose) {
      console.log(`📂 Switched to database '${database}'.`);
    }

    // Step 4: Read and execute schema.sql
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }

    let schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Remove any hardcoded database creation / use in schema.sql to respect .env DB_NAME
    schemaSql = schemaSql
      .replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/gi, '')
      .replace(/USE [^;]+;/gi, '');

    if (verbose) {
      console.log('📄 Executing schema DDL statements...');
    }
    await connection.query(schemaSql);
    if (verbose) {
      console.log('✅ All schema tables verified and ready.');
    }

    // Step 5: Seed essential lookup data safely (INSERT IGNORE preserves existing data)
    if (verbose) {
      console.log('🌱 Checking and seeding initial presets & samples...');
    }

    // Seed default users
    await connection.query(`
      INSERT IGNORE INTO users (user_id, username, role) VALUES
      (1, 'nitish_tester', 'tester'),
      (2, 'evaluator_admin', 'admin');
    `);

    // Seed default video samples (12 diverse multi-bitrate streams)
    await connection.query(`
      INSERT INTO video_samples (video_id, title, stream_url, available_tiers, duration_sec) VALUES
      (1, 'Big Buck Bunny (Mux 1080p 60fps)', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', '240p,360p,480p,720p,1080p', 596),
      (2, 'Sintel — Open Movie Project', 'https://d2zihajmogu5jn.cloudfront.net/sintel/master.m3u8', '240p,360p,480p,720p,1080p', 734),
      (3, 'Tears of Steel — Sci-Fi VFX', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', '360p,480p,720p,1080p,4K', 734),
      (4, 'Elephants Dream — 3D Cyberpunk', 'https://d2zihajmogu5jn.cloudfront.net/elephantsdream/hls/ed_hd.m3u8', '360p,540p,720p,1080p', 653),
      (5, 'Akamai Live Sports & Extreme Action', 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', '360p,540p,720p,1080p', 330),
      (6, 'Apple BipBop Advanced fMP4 Master', 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8', '240p,360p,540p,720p,1080p', 1800),
      (7, 'Apple BipBop 16x9 Cinematic Test', 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8', '240p,360p,540p,720p,1080p', 600),
      (8, 'CloudFront BipBop Advanced Multi-Rendition', 'https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8', '240p,360p,540p,720p,1080p', 600),
      (9, 'THEOplayer Elephants Dream Studio', 'https://cdn.theoplayer.com/video/elephants-dream/playlist.m3u8', '360p,480p,720p,1080p', 653),
      (10, 'THEOplayer Big Buck Bunny Ultra HD', 'https://cdn.theoplayer.com/video/big_buck_bunny/big_buck_bunny.m3u8', '240p,360p,480p,720p,1080p', 596),
      (11, 'Mux Multi-Rendition Adaptive Test 001', 'https://test-streams.mux.dev/test_001/stream.m3u8', '240p,360p,480p,720p,1080p', 150),
      (12, 'Mux High-Motion PTS Shift Stream', 'https://test-streams.mux.dev/pts_shift/master.m3u8', '360p,540p,720p,1080p', 225)
      ON DUPLICATE KEY UPDATE title = VALUES(title), stream_url = VALUES(stream_url), available_tiers = VALUES(available_tiers), duration_sec = VALUES(duration_sec), is_active = TRUE;
    `);

    // Seed official benchmark network profiles
    await connection.query(`
      INSERT IGNORE INTO network_profiles (profile_id, profile_name, bandwidth_kbps, latency_ms, packet_loss_pct, cache_hit_prob) VALUES
      (1, 'Rural 3G (Congested)', 850, 220, 2.50, 0.20),
      (2, 'Commuter Train Wi-Fi', 1800, 140, 1.20, 0.50),
      (3, 'Standard 4G LTE', 4500, 65, 0.20, 0.75),
      (4, 'High-Speed Fiber + Edge CDN', 15000, 15, 0.00, 0.95);
    `);

    // Seed initial historical demo sessions if test_sessions is empty
    const [existingSessions] = await connection.query(`SELECT COUNT(*) AS count FROM test_sessions;`);
    if (existingSessions[0].count === 0) {
      await connection.query(`
        INSERT INTO test_sessions
          (session_id, user_id, video_id, profile_id, sim_bandwidth_kbps, sim_latency_ms, sim_cache_hit_prob, measurement_mode, test_duration_sec, status, created_at)
        VALUES
          (1, 1, 1, 1, 850, 220, 0.20, 'SIMULATED', 60, 'completed', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
          (2, 1, 1, 3, 4500, 65, 0.75, 'SIMULATED', 60, 'completed', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
          (3, 2, 2, 2, 1800, 140, 0.50, 'SIMULATED', 60, 'completed', DATE_SUB(NOW(), INTERVAL 30 MINUTE));
      `);

      await connection.query(`
        INSERT INTO player_metrics
          (session_id, player_type, startup_delay_ms, stall_count, total_stall_duration_sec, avg_bitrate_kbps, quality_switches, cache_hits, cache_misses)
        VALUES
          (1, 'BASELINE', 3200, 7, 18.50, 5000, 0, 3, 12),
          (1, 'OPTIMIZED', 1100, 1, 2.30, 1200, 5, 9, 6),
          (2, 'BASELINE', 1800, 2, 4.20, 5000, 0, 10, 5),
          (2, 'OPTIMIZED', 800, 0, 0.00, 3800, 3, 14, 1),
          (3, 'BASELINE', 2400, 4, 9.80, 5000, 0, 6, 9),
          (3, 'OPTIMIZED', 950, 1, 1.50, 1800, 4, 10, 5);
      `);
    }

    // Step 6: Verify all tables exist
    const [tables] = await connection.query('SHOW TABLES;');
    const tableNames = tables.map(r => Object.values(r)[0]);

    if (verbose) {
      console.log(`📋 Verification: ${tableNames.length} tables found in '${database}':`);
      tableNames.forEach(t => console.log(`   - ${t}`));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 StreamSmart database initialization completed successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    return { success: true, database, tables: tableNames };
  } catch (error) {
    if (verbose) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ Database Initialization Failed');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`Error Code:    ${error.code || 'UNKNOWN'}`);
      console.error(`Error Message: ${error.message}`);
      console.error('\nTroubleshooting suggestions:');
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.error(`  1. Is MySQL server running on ${host}:${port}?`);
        console.error('     Windows: Open Services (services.msc) and ensure "MySQL" or "MySQL80" is Running.');
        console.error('     Command line: Run `net start MySQL` or `net start MySQL80` as administrator.');
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error(`  1. Access denied for user '${user}'. Please check DB_PASSWORD in your .env file.`);
      } else {
        console.error('  1. Check MySQL server status and credentials in your .env file.');
      }
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (_) {}
    }
  }
}

// If executed directly from command line (e.g. `npm run db:init`)
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initDatabase;

