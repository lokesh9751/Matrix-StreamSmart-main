/**
 * utils/inMemoryFallbackStore.js
 *
 * Provides a robust, zero-dependency data store that persists uploaded video metadata
 * to disk (data/uploaded_videos.json) and memory.
 * Ensures StreamSmart remains 100% operational with persistent video records across server restarts
 * whether MongoDB is connected, offline, or in fallback mode.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const PERSISTENT_VIDEOS_FILE = path.join(DATA_DIR, 'uploaded_videos.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[FallbackStore] Could not create data directory:', err.message);
  }
}

const FALLBACK_VIDEOS = [
  {
    video_id: 1,
    title: 'Big Buck Bunny (Mux 1080p 60fps)',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    hlsPlaylistUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 596,
    category: 'Short Film',
    badge: '1080p 60fps',
    is_active: 1,
    is_uploaded: false
  },
  {
    video_id: 2,
    title: 'Tears of Steel — Sci-Fi VFX',
    stream_url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    hlsPlaylistUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&auto=format&fit=crop&q=80',
    available_tiers: '360p,480p,720p,1080p',
    duration_sec: 734,
    category: 'Sci-Fi',
    badge: 'Cinema 4K',
    is_active: 1,
    is_uploaded: false
  },
  {
    video_id: 3,
    title: 'Akamai Live Sports & Extreme Action',
    stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    hlsPlaylistUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=480&auto=format&fit=crop&q=80',
    available_tiers: '360p,540p,720p,1080p',
    duration_sec: 330,
    category: 'Sports',
    badge: 'Live HLS',
    is_active: 1,
    is_uploaded: false
  },
  {
    video_id: 4,
    title: 'Mux Multi-Rendition Adaptive Test 001',
    stream_url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    hlsPlaylistUrl: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=480&auto=format&fit=crop&q=80',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 150,
    category: 'Demo',
    badge: 'ABR Ladder',
    is_active: 1,
    is_uploaded: false
  },
  {
    video_id: 5,
    title: 'Mux High-Motion PTS Shift Stream',
    stream_url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    hlsPlaylistUrl: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=480&auto=format&fit=crop&q=80',
    available_tiers: '360p,540p,720p,1080p',
    duration_sec: 225,
    category: 'Motion Test',
    badge: 'Stress Test',
    is_active: 1,
    is_uploaded: false
  },
  {
    video_id: 6,
    title: 'Apple BipBop 16x9 Cinematic Test',
    stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    hlsPlaylistUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    mp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=480&auto=format&fit=crop&q=80',
    available_tiers: '240p,360p,540p,720p,1080p',
    duration_sec: 600,
    category: 'Apple Reference',
    badge: 'Standard HLS',
    is_active: 1,
    is_uploaded: false
  }
];

// Load persisted videos from disk on initialization
function loadPersistedVideos() {
  if (fs.existsSync(PERSISTENT_VIDEOS_FILE)) {
    try {
      const raw = fs.readFileSync(PERSISTENT_VIDEOS_FILE, 'utf8');
      const savedVideos = JSON.parse(raw);
      if (Array.isArray(savedVideos)) {
        savedVideos.forEach(sv => {
          if (!FALLBACK_VIDEOS.some(v => String(v.video_id) === String(sv.video_id))) {
            FALLBACK_VIDEOS.unshift(sv);
          }
        });
      }
    } catch (err) {
      console.warn('[FallbackStore] Error loading persistent videos:', err.message);
    }
  }
}

// Save uploaded videos array to disk
function savePersistedVideos() {
  try {
    const uploadedOnly = FALLBACK_VIDEOS.filter(v => v.is_uploaded);
    fs.writeFileSync(PERSISTENT_VIDEOS_FILE, JSON.stringify(uploadedOnly, null, 2), 'utf8');
  } catch (err) {
    console.warn('[FallbackStore] Could not persist videos to disk:', err.message);
  }
}

// Initial load from disk
loadPersistedVideos();

const FALLBACK_PROFILES = [
  { profile_id: 1, profile_name: 'Rural 3G (Congested)', bandwidth_kbps: 850, latency_ms: 220, packet_loss_pct: 2.50, cache_hit_prob: 0.20 },
  { profile_id: 2, profile_name: 'Commuter Train Wi-Fi', bandwidth_kbps: 1800, latency_ms: 140, packet_loss_pct: 1.20, cache_hit_prob: 0.50 },
  { profile_id: 3, profile_name: 'Standard 4G LTE', bandwidth_kbps: 4500, latency_ms: 65, packet_loss_pct: 0.20, cache_hit_prob: 0.75 },
  { profile_id: 4, profile_name: 'High-Speed Fiber + Edge CDN', bandwidth_kbps: 15000, latency_ms: 15, packet_loss_pct: 0.00, cache_hit_prob: 0.95 }
];

const FALLBACK_USERS = [
  { user_id: 1, username: 'nitish_tester', role: 'tester', created_at: new Date().toISOString() },
  { user_id: 2, username: 'evaluator_admin', role: 'admin', created_at: new Date().toISOString() }
];

let nextSessionId = 100;
let nextVideoId = 50;
let nextProfileId = 10;

const sessions = [
  {
    session_id: 1,
    user_id: 1,
    video_id: 1,
    profile_id: 1,
    video_title: 'Big Buck Bunny (Mux 1080p 60fps)',
    profile_name: 'Rural 3G (Congested)',
    username: 'nitish_tester',
    sim_bandwidth_kbps: 850,
    sim_latency_ms: 220,
    sim_cache_hit_prob: 0.20,
    measurement_mode: 'SIMULATED',
    test_duration_sec: 30,
    status: 'completed',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    session_id: 2,
    user_id: 1,
    video_id: 1,
    profile_id: 3,
    video_title: 'Big Buck Bunny (Mux 1080p 60fps)',
    profile_name: 'Standard 4G LTE',
    username: 'nitish_tester',
    sim_bandwidth_kbps: 4500,
    sim_latency_ms: 65,
    sim_cache_hit_prob: 0.75,
    measurement_mode: 'SIMULATED',
    test_duration_sec: 30,
    status: 'completed',
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

const playerMetrics = [
  {
    metric_id: 1,
    session_id: 1,
    player_type: 'BASELINE',
    startup_delay_ms: 3400,
    stall_count: 5,
    total_stall_duration_sec: 14.2,
    avg_bitrate_kbps: 5000,
    quality_switches: 0,
    cache_hits: 2,
    cache_misses: 10
  },
  {
    metric_id: 2,
    session_id: 1,
    player_type: 'OPTIMIZED',
    startup_delay_ms: 950,
    stall_count: 0,
    total_stall_duration_sec: 0.0,
    avg_bitrate_kbps: 1200,
    quality_switches: 4,
    cache_hits: 8,
    cache_misses: 4
  }
];

const playbackEvents = [];

module.exports = {
  // Videos
  getVideos: () => [...FALLBACK_VIDEOS],
  getVideoById: (id) => FALLBACK_VIDEOS.find(v => String(v.video_id) === String(id) || String(v.id) === String(id)) || null,
  addVideo: ({ videoId, title, streamUrl, mp4Url, thumbnailUrl, availableTiers, durationSec, category, badge, isUploaded, cloudinaryPublicId }) => {
    const finalId = videoId || nextVideoId++;
    const resolvedStreamUrl = streamUrl || mp4Url || '';
    const resolvedHlsUrl = resolvedStreamUrl.includes('.m3u8') ? resolvedStreamUrl : (mp4Url ? mp4Url.replace(/\.mp4$/, '.m3u8') : resolvedStreamUrl);
    const resolvedThumbnail = thumbnailUrl || (mp4Url ? mp4Url.replace(/\.mp4$/, '.jpg') : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80');

    const item = {
      video_id: finalId,
      id: finalId,
      title: title || 'Untitled Stream',
      stream_url: resolvedHlsUrl,
      hlsPlaylistUrl: resolvedHlsUrl,
      mp4Url: mp4Url || resolvedStreamUrl,
      thumbnail_url: resolvedThumbnail,
      thumbnailUrl: resolvedThumbnail,
      available_tiers: availableTiers || '240p,360p,480p,720p,1080p',
      duration_sec: durationSec || 60,
      duration: durationSec || 60,
      category: category || 'Uploaded Streams',
      badge: badge || 'Cloudinary HLS',
      is_active: 1,
      is_uploaded: isUploaded !== undefined ? isUploaded : true,
      cloudinaryPublicId: cloudinaryPublicId || '',
      created_at: new Date().toISOString()
    };

    // Remove any previous record with the same ID or same cloudinaryPublicId
    const existingIndex = FALLBACK_VIDEOS.findIndex(v =>
      String(v.video_id) === String(finalId) ||
      (cloudinaryPublicId && v.cloudinaryPublicId === cloudinaryPublicId)
    );
    if (existingIndex >= 0) {
      FALLBACK_VIDEOS[existingIndex] = item;
    } else {
      FALLBACK_VIDEOS.unshift(item); // Put newest uploaded video at the top
    }
    savePersistedVideos();
    return item;
  },
  updateVideo: (id, data) => {
    const v = FALLBACK_VIDEOS.find(x => String(x.video_id) === String(id));
    if (!v) return null;
    if (data.title !== undefined) v.title = data.title;
    if (data.streamUrl !== undefined) {
      v.stream_url = data.streamUrl;
      v.hlsPlaylistUrl = data.streamUrl;
    }
    if (data.availableTiers !== undefined) v.available_tiers = data.availableTiers;
    if (data.durationSec !== undefined) {
      v.duration_sec = data.durationSec;
      v.duration = data.durationSec;
    }
    if (data.isActive !== undefined) v.is_active = data.isActive ? 1 : 0;
    savePersistedVideos();
    return { ...v };
  },
  deleteVideo: (id) => {
    const v = FALLBACK_VIDEOS.find(x => String(x.video_id) === String(id));
    if (v) {
      v.is_active = 0;
      savePersistedVideos();
    }
  },
  deleteVideoByCloudinaryPublicId: (publicId) => {
    if (!publicId) return false;
    let changed = false;
    FALLBACK_VIDEOS.forEach(v => {
      if (v.cloudinaryPublicId === publicId || (v.stream_url && v.stream_url.includes(publicId))) {
        v.is_active = 0;
        changed = true;
      }
    });
    if (changed) savePersistedVideos();
    return changed;
  },

  // Profiles
  getProfiles: () => [...FALLBACK_PROFILES],
  getProfileById: (id) => FALLBACK_PROFILES.find(p => p.profile_id === Number(id)) || null,
  addProfile: ({ profileName, bandwidthKbps, latencyMs, packetLossPct = 0, cacheHitProb = 0.5 }) => {
    const p = {
      profile_id: nextProfileId++,
      profile_name: profileName,
      bandwidth_kbps: parseInt(bandwidthKbps, 10),
      latency_ms: parseInt(latencyMs, 10),
      packet_loss_pct: parseFloat(packetLossPct),
      cache_hit_prob: parseFloat(cacheHitProb)
    };
    FALLBACK_PROFILES.push(p);
    return p;
  },
  updateProfile: (id, data) => {
    const p = FALLBACK_PROFILES.find(x => x.profile_id === Number(id));
    if (!p) return null;
    if (data.profileName !== undefined) p.profile_name = data.profileName;
    if (data.bandwidthKbps !== undefined) p.bandwidth_kbps = parseInt(data.bandwidthKbps, 10);
    if (data.latencyMs !== undefined) p.latency_ms = parseInt(data.latencyMs, 10);
    if (data.packetLossPct !== undefined) p.packet_loss_pct = parseFloat(data.packetLossPct);
    if (data.cacheHitProb !== undefined) p.cache_hit_prob = parseFloat(data.cacheHitProb);
    return { ...p };
  },
  deleteProfile: (id) => {
    const idx = FALLBACK_PROFILES.findIndex(x => x.profile_id === Number(id));
    if (idx >= 0) FALLBACK_PROFILES.splice(idx, 1);
  },

  // Users
  getUsers: () => [...FALLBACK_USERS],
  getUserById: (id) => FALLBACK_USERS.find(u => u.user_id === Number(id)) || null,
  getUserByUsername: (name) => FALLBACK_USERS.find(u => u.username === name) || null,

  // Sessions
  getSessions: () => [...sessions],
  getSessionById: (id) => sessions.find(s => s.session_id === Number(id)) || null,
  createSession: (data) => {
    const video = FALLBACK_VIDEOS.find(v => String(v.video_id) === String(data.videoId)) || FALLBACK_VIDEOS[0];
    const profile = FALLBACK_PROFILES.find(p => p.profile_id === Number(data.profileId)) || FALLBACK_PROFILES[0];
    const newSession = {
      session_id: nextSessionId++,
      user_id: data.userId || 1,
      video_id: data.videoId || video.video_id,
      profile_id: data.profileId || profile.profile_id,
      video_title: video.title,
      profile_name: profile.profile_name,
      username: 'nitish_tester',
      sim_bandwidth_kbps: data.simBandwidthKbps || profile.bandwidth_kbps,
      sim_latency_ms: data.simLatencyMs || profile.latency_ms,
      sim_cache_hit_prob: data.simCacheHitProb !== undefined ? data.simCacheHitProb : profile.cache_hit_prob,
      measurement_mode: data.measurementMode || 'SIMULATED',
      test_duration_sec: data.testDurationSec || 30,
      status: 'active',
      created_at: new Date().toISOString()
    };
    sessions.unshift(newSession);
    return newSession;
  },
  updateSessionStatus: (id, status) => {
    const s = sessions.find(x => x.session_id === Number(id));
    if (s) s.status = status;
    return s;
  },

  // Metrics
  getAllMetrics: () => [...playerMetrics],
  getPlayerMetrics: (sessionId) => playerMetrics.filter(m => m.session_id === Number(sessionId)),
  getMetricsBySession: (sessionId) => playerMetrics.filter(m => m.session_id === Number(sessionId)),
  upsertMetric: (sessionId, playerType, metrics) => {
    return module.exports.savePlayerMetrics({ sessionId, playerType, metrics });
  },
  savePlayerMetrics: ({ sessionId, playerType, metrics }) => {
    const existing = playerMetrics.find(m => m.session_id === Number(sessionId) && m.player_type === playerType);
    if (existing) {
      Object.assign(existing, {
        startup_delay_ms: metrics.startupDelayMs !== undefined ? metrics.startupDelayMs : existing.startup_delay_ms,
        stall_count: metrics.stallCount !== undefined ? metrics.stallCount : existing.stall_count,
        total_stall_duration_sec: metrics.totalStallDurationSec !== undefined ? metrics.totalStallDurationSec : existing.total_stall_duration_sec,
        avg_bitrate_kbps: metrics.currentBitrateKbps !== undefined ? metrics.currentBitrateKbps : existing.avg_bitrate_kbps,
        quality_switches: metrics.qualitySwitches !== undefined ? metrics.qualitySwitches : existing.quality_switches,
        cache_hits: metrics.cacheHits !== undefined ? metrics.cacheHits : existing.cache_hits,
        cache_misses: metrics.cacheMisses !== undefined ? metrics.cacheMisses : existing.cache_misses
      });
      return existing;
    }
    const newMetric = {
      metric_id: playerMetrics.length + 1,
      session_id: Number(sessionId),
      player_type: playerType,
      startup_delay_ms: metrics.startupDelayMs || 0,
      stall_count: metrics.stallCount || 0,
      total_stall_duration_sec: metrics.totalStallDurationSec || 0,
      avg_bitrate_kbps: metrics.currentBitrateKbps || 0,
      quality_switches: metrics.qualitySwitches || 0,
      cache_hits: metrics.cacheHits || 0,
      cache_misses: metrics.cacheMisses || 0
    };
    playerMetrics.push(newMetric);
    return newMetric;
  },

  // Events
  getPlaybackEvents: (sessionId, playerType) => {
    return playbackEvents.filter(e => {
      const matchSession = e.session_id === Number(sessionId);
      const matchType = playerType ? e.player_type === playerType : true;
      return matchSession && matchType;
    });
  },
  getEventsBySession: (sessionId, playerType) => {
    return module.exports.getPlaybackEvents(sessionId, playerType);
  },
  addPlaybackEvent: (evt) => {
    return module.exports.logPlaybackEvent(evt);
  },
  logPlaybackEvent: (evt) => {
    const eventRecord = {
      event_id: playbackEvents.length + 1,
      session_id: Number(evt.sessionId),
      player_type: evt.playerType,
      event_type: evt.eventType,
      elapsed_sec: evt.elapsedSec || 0,
      bitrate_kbps: evt.bitrateKbps || null,
      resolution_label: evt.resolutionLabel || null,
      buffer_sec: evt.bufferSec || null,
      metadata: evt.metadata ? (typeof evt.metadata === 'string' ? evt.metadata : JSON.stringify(evt.metadata)) : null,
      created_at: new Date().toISOString()
    };
    playbackEvents.push(eventRecord);
    return eventRecord;
  }
};
