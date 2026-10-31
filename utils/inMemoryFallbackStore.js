/**
 * utils/inMemoryFallbackStore.js
 *
 * Provides a robust, zero-dependency in-memory mock data store that activates
 * automatically whenever MySQL is offline or disconnected.
 * Ensures the StreamSmart backend remains 100% operational for testing, API exploration,
 * and frontend client connectivity even when MySQL service is unavailable.
 */

const FALLBACK_VIDEOS = [
  { video_id: 1, title: 'Big Buck Bunny (Mux 1080p 60fps)', stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', available_tiers: '240p,360p,480p,720p,1080p', duration_sec: 596, is_active: 1 },
  { video_id: 2, title: 'Tears of Steel — Sci-Fi VFX', stream_url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', available_tiers: '360p,480p,720p,1080p', duration_sec: 734, is_active: 1 },
  { video_id: 3, title: 'Akamai Live Sports & Extreme Action', stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', available_tiers: '360p,540p,720p,1080p', duration_sec: 330, is_active: 1 },
  { video_id: 4, title: 'Mux Multi-Rendition Adaptive Test 001', stream_url: 'https://test-streams.mux.dev/test_001/stream.m3u8', available_tiers: '240p,360p,480p,720p,1080p', duration_sec: 150, is_active: 1 },
  { video_id: 5, title: 'Mux High-Motion PTS Shift Stream', stream_url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', available_tiers: '360p,540p,720p,1080p', duration_sec: 225, is_active: 1 },
  { video_id: 6, title: 'Apple BipBop 16x9 Cinematic Test', stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8', available_tiers: '240p,360p,540p,720p,1080p', duration_sec: 600, is_active: 1 }
];

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
let nextVideoId = 20;
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
  getVideoById: (id) => FALLBACK_VIDEOS.find(v => v.video_id === Number(id)) || null,
  addVideo: ({ title, streamUrl, availableTiers, durationSec }) => {
    const item = {
      video_id: nextVideoId++,
      title,
      stream_url: streamUrl,
      available_tiers: availableTiers || '240p,360p,480p,720p,1080p',
      duration_sec: durationSec || 600,
      is_active: 1
    };
    FALLBACK_VIDEOS.push(item);
    return item;
  },
  updateVideo: (id, data) => {
    const v = FALLBACK_VIDEOS.find(x => x.video_id === Number(id));
    if (!v) return null;
    if (data.title !== undefined) v.title = data.title;
    if (data.streamUrl !== undefined) v.stream_url = data.streamUrl;
    if (data.availableTiers !== undefined) v.available_tiers = data.availableTiers;
    if (data.durationSec !== undefined) v.duration_sec = data.durationSec;
    if (data.isActive !== undefined) v.is_active = data.isActive ? 1 : 0;
    return { ...v };
  },
  deleteVideo: (id) => {
    const v = FALLBACK_VIDEOS.find(x => x.video_id === Number(id));
    if (v) v.is_active = 0;
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
    const video = FALLBACK_VIDEOS.find(v => v.video_id === Number(data.videoId)) || FALLBACK_VIDEOS[0];
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
      status: 'running',
      created_at: new Date().toISOString()
    };
    sessions.unshift(newSession);
    return newSession;
  },
  updateSessionStatus: (id, status) => {
    const s = sessions.find(x => x.session_id === Number(id));
    if (s) s.status = status;
  },

  // Metrics
  getAllMetrics: () => [...playerMetrics],
  getMetricsBySession: (sessionId) => playerMetrics.filter(m => m.session_id === Number(sessionId)),
  upsertMetric: (sessionId, playerType, metrics) => {
    const existingIdx = playerMetrics.findIndex(
      m => m.session_id === Number(sessionId) && m.player_type === playerType
    );
    const item = {
      metric_id: existingIdx >= 0 ? playerMetrics[existingIdx].metric_id : playerMetrics.length + 1,
      session_id: Number(sessionId),
      player_type: playerType,
      startup_delay_ms: metrics.startupDelayMs || 0,
      stall_count: metrics.stallCount || 0,
      total_stall_duration_sec: parseFloat(Number(metrics.totalStallDurationSec || 0).toFixed(2)),
      avg_bitrate_kbps: Math.round(Number(metrics.avgBitrateKbps || 0)),
      quality_switches: metrics.qualitySwitches || 0,
      cache_hits: metrics.cacheHits || 0,
      cache_misses: metrics.cacheMisses || 0
    };
    if (existingIdx >= 0) {
      playerMetrics[existingIdx] = item;
    } else {
      playerMetrics.push(item);
    }
    return item;
  },

  // Playback Events
  getAllPlaybackEvents: () => [...playbackEvents],
  getEventsBySession: (sessionId, playerType) => {
    return playbackEvents.filter(e => {
      if (e.session_id !== Number(sessionId)) return false;
      if (playerType && e.player_type !== playerType) return false;
      return true;
    });
  },
  addPlaybackEvent: (event) => {
    const item = {
      event_id: playbackEvents.length + 1,
      ...event,
      session_id: Number(event.sessionId || event.session_id),
      player_type: event.playerType || event.player_type,
      event_type: event.eventType || event.event_type,
      elapsed_sec: parseFloat(Number(event.elapsedSec || event.elapsed_sec || event.playbackTimeSec || 0).toFixed(1)),
      buffer_level_sec: parseFloat(Number(event.bufferSec || event.buffer_level_sec || 0).toFixed(2)),
      resolution_label: event.resolution || event.resolutionLabel || event.resolution_label || 'unknown',
      simulated_delay_ms: parseInt(event.delayMs || event.simulatedDelayMs || event.simulated_delay_ms || 0, 10),
      is_cache_hit: Boolean(event.isCacheHit || event.is_cache_hit),
      timestamp: event.timestamp || new Date().toISOString()
    };
    playbackEvents.push(item);
    return item.event_id;
  }
};
