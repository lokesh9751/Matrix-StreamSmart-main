/**
 * scripts/initDatabase.js – StreamSmart Automatic MongoDB Initializer & Seeder
 *
 * Capabilities:
 *  1. Verifies connection to MongoDB via Mongoose.
 *  2. Ensures all schemas, collections, and indexes are created.
 *  3. Seeds default users, benchmark network profiles, and video streams if empty.
 *  4. Preserves existing user documents and custom uploads.
 *  5. Can be safely executed multiple times.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const NetworkProfile = require('../models/NetworkProfile');
const Video = require('../models/Video');
const TestSession = require('../models/TestSession');
const PlayerMetric = require('../models/PlayerMetric');

const DEFAULT_USERS = [
  { user_id: 1, username: 'nitish_tester', role: 'tester' },
  { user_id: 2, username: 'evaluator_admin', role: 'admin' }
];

const DEFAULT_PROFILES = [
  { profile_id: 1, profile_name: 'Rural 3G (Congested)', bandwidth_kbps: 850, latency_ms: 220, packet_loss_pct: 2.50, cache_hit_prob: 0.20 },
  { profile_id: 2, profile_name: 'Commuter Train Wi-Fi', bandwidth_kbps: 1800, latency_ms: 140, packet_loss_pct: 1.20, cache_hit_prob: 0.50 },
  { profile_id: 3, profile_name: 'Standard 4G LTE', bandwidth_kbps: 4500, latency_ms: 65, packet_loss_pct: 0.20, cache_hit_prob: 0.75 },
  { profile_id: 4, profile_name: 'High-Speed Fiber + Edge CDN', bandwidth_kbps: 15000, latency_ms: 15, packet_loss_pct: 0.00, cache_hit_prob: 0.95 }
];

const DEFAULT_VIDEOS = [
  {
    video_id: 1,
    title: 'Big Buck Bunny (Mux 1080p 60fps)',
    cloudinaryPublicId: 'streamsmart_videos/big_buck_bunny',
    mp4Url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.mp4',
    hlsPlaylistUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration: 596,
    duration_sec: 596,
    status: 'ready',
    category: 'Animation',
    badge: '1080p HD',
    thumbnailUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80'
  },
  {
    video_id: 2,
    title: 'Sintel — Open Movie Project',
    cloudinaryPublicId: 'streamsmart_videos/sintel',
    mp4Url: 'https://d2zihajmogu5jn.cloudfront.net/sintel/sintel.mp4',
    hlsPlaylistUrl: 'https://d2zihajmogu5jn.cloudfront.net/sintel/master.m3u8',
    stream_url: 'https://d2zihajmogu5jn.cloudfront.net/sintel/master.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration: 734,
    duration_sec: 734,
    status: 'ready',
    category: 'Animation',
    badge: '1080p',
    thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&auto=format&fit=crop&q=80'
  },
  {
    video_id: 3,
    title: 'Tears of Steel — Sci-Fi VFX',
    cloudinaryPublicId: 'streamsmart_videos/tears_of_steel',
    mp4Url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/tears-of-steel.mp4',
    hlsPlaylistUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    stream_url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    available_tiers: '360p,480p,720p,1080p,4K',
    duration: 734,
    duration_sec: 734,
    status: 'ready',
    category: 'Sci-Fi',
    badge: '4K / 1080p',
    thumbnailUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=480&auto=format&fit=crop&q=80'
  },
  {
    video_id: 4,
    title: 'Akamai Live Sports & Extreme Action',
    cloudinaryPublicId: 'streamsmart_videos/akamai_sports',
    mp4Url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.mp4',
    hlsPlaylistUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    available_tiers: '360p,540p,720p,1080p',
    duration: 330,
    duration_sec: 330,
    status: 'ready',
    category: 'Sports',
    badge: 'High Motion',
    thumbnailUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=480&auto=format&fit=crop&q=80'
  },
  {
    video_id: 5,
    title: 'Mux Multi-Rendition Adaptive Test 001',
    cloudinaryPublicId: 'streamsmart_videos/mux_test_001',
    mp4Url: 'https://test-streams.mux.dev/test_001/stream.mp4',
    hlsPlaylistUrl: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    stream_url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration: 150,
    duration_sec: 150,
    status: 'ready',
    category: 'Benchmark',
    badge: 'Adaptive Test',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=480&auto=format&fit=crop&q=80'
  },
  {
    video_id: 6,
    title: 'Apple BipBop 16x9 Cinematic Test',
    cloudinaryPublicId: 'streamsmart_videos/apple_bipbop',
    mp4Url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.mp4',
    hlsPlaylistUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    available_tiers: '240p,360p,540p,720p,1080p',
    duration: 600,
    duration_sec: 600,
    status: 'ready',
    category: 'Benchmark',
    badge: 'Multi-Bitrate',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=480&auto=format&fit=crop&q=80'
  }
];

async function initDatabase(options = { verbose: true }) {
  const verbose = options.verbose !== false;

  if (mongoose.connection.readyState !== 1) {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsmart_db';
    if (verbose) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 StreamSmart – MongoDB Database Initialization');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Connecting to MongoDB at: ${MONGO_URI}`);
    }
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  }

  if (verbose) {
    console.log('✅ Connected to MongoDB successfully.');
    console.log('🌱 Checking and seeding initial presets & collections...');
  }

  // 1. Seed Users
  for (const u of DEFAULT_USERS) {
    await User.Model.updateOne({ user_id: u.user_id }, { $setOnInsert: u }, { upsert: true });
  }

  // 2. Seed Network Profiles
  for (const p of DEFAULT_PROFILES) {
    await NetworkProfile.Model.updateOne({ profile_id: p.profile_id }, { $setOnInsert: p }, { upsert: true });
  }

  // 3. Seed Video Samples
  for (const v of DEFAULT_VIDEOS) {
    await Video.updateOne({ video_id: v.video_id }, { $setOnInsert: v }, { upsert: true });
  }

  // 4. Seed Initial Sessions if empty
  const sessionCount = await TestSession.Model.countDocuments();
  if (sessionCount === 0) {
    await TestSession.Model.create([
      {
        session_id: 1,
        user_id: 1,
        video_id: 1,
        profile_id: 1,
        sim_bandwidth_kbps: 850,
        sim_latency_ms: 220,
        sim_cache_hit_prob: 0.20,
        measurement_mode: 'SIMULATED',
        test_duration_sec: 60,
        status: 'completed',
        video_title: 'Big Buck Bunny (Mux 1080p 60fps)',
        profile_name: 'Rural 3G (Congested)',
        username: 'nitish_tester'
      },
      {
        session_id: 2,
        user_id: 1,
        video_id: 1,
        profile_id: 3,
        sim_bandwidth_kbps: 4500,
        sim_latency_ms: 65,
        sim_cache_hit_prob: 0.75,
        measurement_mode: 'SIMULATED',
        test_duration_sec: 60,
        status: 'completed',
        video_title: 'Big Buck Bunny (Mux 1080p 60fps)',
        profile_name: 'Standard 4G LTE',
        username: 'nitish_tester'
      }
    ]);

    await PlayerMetric.Model.create([
      {
        metric_id: 1,
        session_id: 1,
        player_type: 'BASELINE',
        startup_delay_ms: 3200,
        stall_count: 7,
        total_stall_duration_sec: 18.5,
        avg_bitrate_kbps: 5000,
        quality_switches: 0,
        cache_hits: 3,
        cache_misses: 12
      },
      {
        metric_id: 2,
        session_id: 1,
        player_type: 'OPTIMIZED',
        startup_delay_ms: 1100,
        stall_count: 1,
        total_stall_duration_sec: 2.3,
        avg_bitrate_kbps: 1200,
        quality_switches: 5,
        cache_hits: 9,
        cache_misses: 6
      },
      {
        metric_id: 3,
        session_id: 2,
        player_type: 'BASELINE',
        startup_delay_ms: 1800,
        stall_count: 2,
        total_stall_duration_sec: 4.2,
        avg_bitrate_kbps: 5000,
        quality_switches: 0,
        cache_hits: 10,
        cache_misses: 5
      },
      {
        metric_id: 4,
        session_id: 2,
        player_type: 'OPTIMIZED',
        startup_delay_ms: 800,
        stall_count: 0,
        total_stall_duration_sec: 0.0,
        avg_bitrate_kbps: 3800,
        quality_switches: 3,
        cache_hits: 14,
        cache_misses: 1
      }
    ]);
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  if (verbose) {
    console.log(`📋 Verification: ${collectionNames.length} MongoDB collections found:`);
    collectionNames.forEach(name => console.log(`   - ${name}`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 StreamSmart MongoDB initialization completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  return { success: true, collections: collectionNames };
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Initialization failed:', err.message);
      process.exit(1);
    });
}

module.exports = initDatabase;
