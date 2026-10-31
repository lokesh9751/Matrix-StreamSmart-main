import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import BaselinePlayer from '../components/players/BaselinePlayer';
import OptimizedPlayer from '../components/players/OptimizedPlayer';
import BufferBitrateChart from '../components/charts/BufferBitrateChart';
import PerformanceBarChart from '../components/charts/PerformanceBarChart';
import CacheEfficiencyChart from '../components/charts/CacheEfficiencyChart';
import YouTubeVideoRail from '../components/workbench/YouTubeVideoRail';
import useTelemetry from '../hooks/useTelemetry';
import api from '../services/api';
import {
  Activity,
  Zap,
  PauseCircle,
  CheckCircle2,
  Play,
  Square,
  RotateCcw,
  Sliders,
  SlidersHorizontal,
  Film,
  ArrowRight,
  Clock,
  AlertTriangle,
  Radio,
  BarChart3,
  Layers,
  Pause
} from 'lucide-react';
import { saveStoredSession } from '../services/sessionStore';

// ── Default presets ────────────────────────────────────────────────────────
const NETWORK_PRESETS = [
  { id: 1, profile_name: 'Rural 3G (Congested)',      bandwidth_kbps: 850,   latency_ms: 220, packet_loss_pct: 2.50, cache_hit_prob: 0.20 },
  { id: 2, profile_name: 'Commuter Train Wi-Fi',      bandwidth_kbps: 1800,  latency_ms: 140, packet_loss_pct: 1.20, cache_hit_prob: 0.50 },
  { id: 3, profile_name: 'Standard 4G LTE',           bandwidth_kbps: 4500,  latency_ms: 65,  packet_loss_pct: 0.20, cache_hit_prob: 0.75 },
  { id: 4, profile_name: 'High-Speed Fiber + Edge CDN',bandwidth_kbps: 15000, latency_ms: 15,  packet_loss_pct: 0.00, cache_hit_prob: 0.95 },
];

const DEFAULT_VIDEOS = [
  {
    video_id: 1,
    title: 'Big Buck Bunny (Mux 1080p 60fps)',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 596,
    duration_formatted: '09:56',
    category: 'Animation',
    badge: '1080p HD',
    thumbnail_url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 2,
    title: 'Sintel — Open Movie Project',
    stream_url: 'https://d2zihajmogu5jn.cloudfront.net/sintel/master.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 734,
    duration_formatted: '12:14',
    category: 'Fantasy / CGI',
    badge: '1080p HD',
    thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 3,
    title: 'Tears of Steel — Sci-Fi VFX',
    stream_url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    available_tiers: '360p,480p,720p,1080p,4K',
    duration_sec: 734,
    duration_formatted: '12:14',
    category: 'Sci-Fi',
    badge: '4K / 1080p',
    thumbnail_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 4,
    title: 'Elephants Dream — 3D Cyberpunk',
    stream_url: 'https://d2zihajmogu5jn.cloudfront.net/elephantsdream/hls/ed_hd.m3u8',
    available_tiers: '360p,540p,720p,1080p',
    duration_sec: 653,
    duration_formatted: '10:53',
    category: 'Sci-Fi',
    badge: '1080p HD',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 5,
    title: 'Akamai Live Sports & Extreme Action',
    stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    available_tiers: '360p,540p,720p,1080p',
    duration_sec: 330,
    duration_formatted: '05:30',
    category: 'Sports',
    badge: 'High Motion',
    thumbnail_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 6,
    title: 'Apple BipBop Advanced fMP4 Master',
    stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    available_tiers: '240p,360p,540p,720p,1080p',
    duration_sec: 1800,
    duration_formatted: '30:00',
    category: 'Apple HLS',
    badge: 'fMP4 Master',
    thumbnail_url: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 7,
    title: 'Apple BipBop 16x9 Cinematic Test',
    stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    available_tiers: '240p,360p,540p,720p,1080p',
    duration_sec: 600,
    duration_formatted: '10:00',
    category: 'Apple HLS',
    badge: '16:9 Widescreen',
    thumbnail_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 8,
    title: 'CloudFront BipBop Advanced Multi-Rendition',
    stream_url: 'https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
    available_tiers: '240p,360p,540p,720p,1080p',
    duration_sec: 600,
    duration_formatted: '10:00',
    category: 'Benchmark',
    badge: 'CDN Fast',
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 9,
    title: 'THEOplayer Elephants Dream Studio',
    stream_url: 'https://cdn.theoplayer.com/video/elephants-dream/playlist.m3u8',
    available_tiers: '360p,480p,720p,1080p',
    duration_sec: 653,
    duration_formatted: '10:53',
    category: 'Animation',
    badge: '1080p Studio',
    thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 10,
    title: 'THEOplayer Big Buck Bunny Ultra HD',
    stream_url: 'https://cdn.theoplayer.com/video/big_buck_bunny/big_buck_bunny.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 596,
    duration_formatted: '09:56',
    category: 'Animation',
    badge: 'Multi-Bitrate',
    thumbnail_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 11,
    title: 'Mux Multi-Rendition Adaptive Test 001',
    stream_url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    available_tiers: '240p,360p,480p,720p,1080p',
    duration_sec: 150,
    duration_formatted: '02:30',
    category: 'Benchmark',
    badge: 'Adaptive Test',
    thumbnail_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=480&auto=format&fit=crop&q=80',
  },
  {
    video_id: 12,
    title: 'Mux High-Motion PTS Shift Stream',
    stream_url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    available_tiers: '360p,540p,720p,1080p',
    duration_sec: 225,
    duration_formatted: '03:45',
    category: 'Action',
    badge: '60 FPS',
    thumbnail_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=480&auto=format&fit=crop&q=80',
  }
];

export default function Dashboard() {
  // ── State ────────────────────────────────────────────────────────────────
  const [videos,         setVideos]         = useState(DEFAULT_VIDEOS);
  const [profiles,       setProfiles]       = useState(NETWORK_PRESETS);
  const [selectedVideo,  setSelectedVideo]  = useState(DEFAULT_VIDEOS[0]);
  const [selectedProfile,setSelectedProfile]= useState(null);
  const [summaryData,    setSummaryData]    = useState(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [config, setConfig] = useState({
    bandwidthKbps:  4500,
    latencyMs:      65,
    packetLossPct:  0.20,
    cacheHitProb:   0.75,
    testDurationSec: 60,
  });

  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [sessionId,      setSessionId]      = useState(null);
  const [activeStreamSrc,setActiveStreamSrc]= useState(null);
  const [benchmarkTimer, setBenchmarkTimer] = useState(0);
  const [errors,         setErrors]         = useState([]);
  const [apiOnline,      setApiOnline]      = useState(false);

  // Player refs
  const baselineRef  = useRef(null);
  const optimizedRef = useRef(null);

  // Telemetry
  const {
    baselineMetrics, optimizedMetrics,
    baselineSeries,  optimizedSeries,
    handleBaselineMetrics, handleOptimizedMetrics,
    syncTimeSeries, persistMetrics,
    baselineTrackerRef, optimizedTrackerRef,
  } = useTelemetry(sessionId);

  const timerRef   = useRef(null);
  const syncRef    = useRef(null);

  // ── Helper to load summary metrics from MySQL ────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const summary = await api.getSummary();
      if (summary) setSummaryData(summary);
    } catch (err) {
      console.warn('[Dashboard] Summary fetch failed:', err.message);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // ── Load data from API on mount ──────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [hRes, vRes, pRes, sRes] = await Promise.allSettled([
          api.health(),
          api.getVideos(),
          api.getProfiles(),
          api.getSummary()
        ]);

        if (!isMounted) return;

        if (hRes.status === 'fulfilled' || vRes.status === 'fulfilled' || pRes.status === 'fulfilled') {
          setApiOnline(true);
        }

        if (vRes.status === 'fulfilled' && vRes.value?.videos?.length) {
          const mergedVideos = vRes.value.videos.map(dbVid => {
            const fallback = DEFAULT_VIDEOS.find(d => d.video_id === dbVid.video_id || d.stream_url === dbVid.stream_url) || {};
            return {
              ...fallback,
              ...dbVid,
              thumbnail_url: dbVid.thumbnail_url || fallback.thumbnail_url || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80',
              category: dbVid.category || fallback.category || 'Benchmark',
              badge: dbVid.badge || fallback.badge || 'HD',
              duration_formatted: dbVid.duration_formatted || fallback.duration_formatted || (dbVid.duration_sec ? `${Math.floor(dbVid.duration_sec / 60).toString().padStart(2, '0')}:${(dbVid.duration_sec % 60).toString().padStart(2, '0')}` : '10:00'),
            };
          });
          setVideos(mergedVideos);
          setSelectedVideo(prev => mergedVideos.find(v => v.video_id === prev?.video_id) || mergedVideos[0]);
        }

        if (pRes.status === 'fulfilled' && pRes.value?.profiles?.length) {
          const loadedProfiles = pRes.value.profiles;
          setProfiles(loadedProfiles);
          // Auto-select the first real profile from the database
          const initial = loadedProfiles[0];
          setSelectedProfile(initial);
          setConfig(prev => ({
            ...prev,
            bandwidthKbps:  initial.bandwidth_kbps,
            latencyMs:      initial.latency_ms,
            packetLossPct:  parseFloat(initial.packet_loss_pct || 0),
            cacheHitProb:   parseFloat(initial.cache_hit_prob  || 0.5),
          }));
        }

        if (sRes.status === 'fulfilled' && sRes.value) {
          setSummaryData(sRes.value);
        }
      } catch (err) {
        console.warn('[Dashboard] Initial connection failed:', err.message);
      } finally {
        if (isMounted) setIsLoadingSummary(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Profile selection auto-fill ──────────────────────────────────────────
  const handleProfileChange = (e) => {
    const profileId = parseInt(e.target.value);
    if (!profileId) { setSelectedProfile(null); return; }
    const p = profiles.find(pr => pr.profile_id === profileId);
    if (p) {
      setSelectedProfile(p);
      setConfig({
        bandwidthKbps:  p.bandwidth_kbps,
        latencyMs:      p.latency_ms,
        packetLossPct:  parseFloat(p.packet_loss_pct || 0),
        cacheHitProb:   parseFloat(p.cache_hit_prob  || 0.5),
        testDurationSec: config.testDurationSec,
      });
    }
  };

  const handleVideoChange = (e) => {
    const vid = videos.find(v => v.video_id === parseInt(e.target.value));
    if (vid) setSelectedVideo(vid);
  };

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  // ── Validation ───────────────────────────────────────────────────────────
  function validate() {
    const errs = [];
    if (!selectedVideo?.stream_url) errs.push('Please select a video source.');
    if (config.bandwidthKbps < 100 || config.bandwidthKbps > 100000) errs.push('Bandwidth must be 100–100,000 Kbps.');
    if (config.latencyMs < 0 || config.latencyMs > 5000) errs.push('Latency must be 0–5,000 ms.');
    if (config.cacheHitProb < 0 || config.cacheHitProb > 1) errs.push('Cache hit probability must be 0.00–1.00.');
    return errs;
  }

  // ── Start Benchmark ──────────────────────────────────────────────────────
  const startBenchmark = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);

    let sid = null;
    try {
      const res = await api.createSession({
        videoId:        selectedVideo.video_id || null,
        profileId:      selectedProfile?.profile_id || null,
        bandwidthKbps:  config.bandwidthKbps,
        latencyMs:      config.latencyMs,
        cacheHitProb:   config.cacheHitProb,
        streamUrl:      selectedVideo.stream_url,
        testDurationSec: config.testDurationSec,
        measurementMode: 'SIMULATED',
      });
      sid = res.sessionId;
      setSessionId(sid);
    } catch (err) {
      // Continue without DB if API offline
      console.warn('[Dashboard] Session creation failed (API offline?):', err.message);
    }

    setActiveStreamSrc(selectedVideo.stream_url);
    setIsBenchmarking(true);
    setBenchmarkTimer(0);

    // Synchronously start playback on both players
    setTimeout(() => {
      baselineRef.current?.play();
      optimizedRef.current?.play();
    }, 150);

    // Timer tick
    timerRef.current = setInterval(() => {
      setBenchmarkTimer(t => {
        const next = t + 1;
        if (next >= config.testDurationSec) {
          stopBenchmark(sid);
        }
        return next;
      });
    }, 1000);

    // Time-series sync every 2 seconds
    syncRef.current = setInterval(syncTimeSeries, 2000);
  };

  // ── Stop Benchmark ───────────────────────────────────────────────────────
  const stopBenchmark = useCallback(async (sid) => {
    const id = sid || sessionId;
    clearInterval(timerRef.current);
    clearInterval(syncRef.current);
    setIsBenchmarking(false);

    // Pause both players synchronously
    baselineRef.current?.pause();
    optimizedRef.current?.pause();

    const hits = (baselineMetrics?.cacheHits || 0) + (optimizedMetrics?.cacheHits || 0);
    const misses = (baselineMetrics?.cacheMisses || 0) + (optimizedMetrics?.cacheMisses || 0);

    // Persist to client store for instant local and offline access
    saveStoredSession({
      session_id: id || `sess-${Date.now()}`,
      created_at: new Date().toISOString(),
      video_title: selectedVideo?.title || 'Benchmark Stream',
      profile_name: selectedProfile?.profile_name || 'Custom Preset',
      status: 'COMPLETED',
      duration_sec: config.testDurationSec,
      baseline_stalls: baselineMetrics?.stallCount || 0,
      baseline_rebuffer_sec: baselineMetrics?.totalStallDurationSec || 0,
      baseline_startup_ms: baselineMetrics?.startupDelayMs || 0,
      baseline_resolution: baselineMetrics?.currentResolution || '1080p',
      optimized_stalls: optimizedMetrics?.stallCount || 0,
      optimized_rebuffer_sec: optimizedMetrics?.totalStallDurationSec || 0,
      optimized_startup_ms: optimizedMetrics?.startupDelayMs || 0,
      optimized_resolution: optimizedMetrics?.currentResolution || '720p',
      stalls_avoided: Math.max(0, (baselineMetrics?.stallCount || 0) - (optimizedMetrics?.stallCount || 0)),
      rebuffer_saved_sec: Math.max(0, parseFloat(((baselineMetrics?.totalStallDurationSec || 0) - (optimizedMetrics?.totalStallDurationSec || 0)).toFixed(1))),
      cache_hit_rate: hits + misses > 0 ? parseFloat(((hits / (hits + misses)) * 100).toFixed(1)) : 0,
      total_cache_hits: hits,
      total_cache_misses: misses,
      switches: optimizedMetrics?.qualitySwitches || 0
    });

    if (id) {
      try {
        await persistMetrics(id);
        await api.stopSession(id, 'completed');
        await fetchSummary();
      } catch (err) {
        console.warn('[Dashboard] Could not persist session:', err.message);
      }
    }
  }, [sessionId, persistMetrics, fetchSummary, baselineMetrics, optimizedMetrics, selectedVideo, selectedProfile, config.testDurationSec]);

  // Attach tracker refs for persistence
  useEffect(() => {
    if (baselineRef.current?.getTracker) {
      baselineTrackerRef.current = baselineRef.current.getTracker();
    }
  }, [activeStreamSrc]);
  useEffect(() => {
    if (optimizedRef.current?.getTracker) {
      optimizedTrackerRef.current = optimizedRef.current.getTracker();
    }
  }, [activeStreamSrc]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetConfig = () => {
    setSelectedProfile(null);
    setConfig({ bandwidthKbps: 4500, latencyMs: 65, packetLossPct: 0.2, cacheHitProb: 0.75, testDurationSec: 60 });
    setErrors([]);
  };

  // ── Synchronized Dual-Player Controls ─────────────────────────────────────
  const handlePlayBoth = useCallback(() => {
    baselineRef.current?.play();
    optimizedRef.current?.play();
  }, []);

  const handlePauseBoth = useCallback(() => {
    baselineRef.current?.pause();
    optimizedRef.current?.pause();
  }, []);

  const handleRestartBoth = useCallback(() => {
    baselineRef.current?.seek(0);
    optimizedRef.current?.seek(0);
    baselineRef.current?.play();
    optimizedRef.current?.play();
  }, []);

  const handleSyncPlayheads = useCallback(() => {
    const baseTime = baselineRef.current?.getCurrentTime();
    if (typeof baseTime === 'number' && !isNaN(baseTime)) {
      optimizedRef.current?.seek(baseTime);
    }
  }, []);


  const networkConfig = {
    enabled:       isBenchmarking,
    bandwidthKbps: config.bandwidthKbps,
    latencyMs:     config.latencyMs,
    packetLossPct: config.packetLossPct,
    cacheHitProb:  config.cacheHitProb,
    sessionId,
  };

  // Combined cache stats
  const totalCacheHits   = (baselineMetrics?.cacheHits   || 0) + (optimizedMetrics?.cacheHits   || 0);
  const totalCacheMisses = (baselineMetrics?.cacheMisses  || 0) + (optimizedMetrics?.cacheMisses || 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Streaming Workbench & Studio</h2>
          <div className="page-subtitle">
            Controlled dual-player benchmarking engine: Compare Fixed-Quality Baseline vs. Adaptive Bitrate (ABR) under real-time network and edge-cache simulation.
          </div>
        </div>
      </div>

      {isBenchmarking && <div className="benchmark-running-bar" style={{ marginBottom: '20px' }} />}

      {errors.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Configuration errors:</strong>
            <ul style={{ marginTop: '4px', paddingLeft: '16px' }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {!apiOnline && (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            Backend API offline – running in resilient browser simulation mode. Start the Express server for MySQL persistence.
          </div>
        </div>
      )}

      {/* ── Top KPI Stat Cards (Platform Analytics) ────────────────── */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        {/* Total Sessions */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Test Sessions</span>
            <div className="stat-icon-wrap">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summaryData ? summaryData.totalSessions : (isLoadingSummary ? '...' : 0)}
            <span className="stat-unit">runs</span>
          </div>
          <div className="stat-sub">
            {summaryData
              ? `${summaryData.completedSessions} completed (${summaryData.runningSessions || 0} active)`
              : 'Syncing with MySQL database...'}
          </div>
        </div>

        {/* Avg Startup Delay */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Average Startup Time</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <Zap size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summaryData && summaryData.totalSessions > 0
              ? (summaryData.avgStartupDelayMs / 1000).toFixed(2)
              : '0.00'}
            <span className="stat-unit">sec</span>
          </div>
          <div className="stat-sub">
            Time to first decoded video frame
          </div>
        </div>

        {/* Buffering Events */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Buffering Stalls</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
              <PauseCircle size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summaryData && summaryData.totalSessions > 0 ? summaryData.totalStallCount : 0}
            <span className="stat-unit">stalls</span>
          </div>
          <div className="stat-sub">
            {summaryData && summaryData.totalSessions > 0
              ? `${summaryData.totalRebufferSec}s total starvation duration`
              : 'No buffer starvation recorded'}
          </div>
        </div>

        {/* Cache Hit Rate */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Cache Hit Ratio</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summaryData && summaryData.totalSessions > 0 ? `${summaryData.cacheHitRate}%` : '0%'}
          </div>
          <div className="stat-sub">
            {summaryData && summaryData.totalSessions > 0
              ? `${summaryData.totalCacheHits} hits / ${summaryData.totalCacheMisses} misses`
              : 'Simulated edge CDN caching'}
          </div>
        </div>
      </div>

      {/* ── YouTube-Style Video Carousel Rail (12 Multi-Bitrate Streams) ── */}
      <YouTubeVideoRail
        videos={videos}
        selectedVideo={selectedVideo}
        onSelectVideo={(vid) => setSelectedVideo(vid)}
        disabled={isBenchmarking}
      />

      <div className="dashboard-grid">
        {/* ── LEFT: Control Panel ─────────────────────────────────────── */}
        <div className="control-panel">

          {/* Video Selection */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Video Source</div>
              <span className="badge badge-info">{videos.length} Streams</span>
            </div>

            {selectedVideo && (
              <div style={{
                display: 'flex',
                gap: '10px',
                padding: '10px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '14px',
                border: '1px solid var(--border)',
                alignItems: 'center'
              }}>
                <img
                  src={selectedVideo.thumbnail_url || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80'}
                  alt={selectedVideo.title}
                  style={{ width: '84px', height: '48px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {selectedVideo.title}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span className="chip chip-blue" style={{ fontSize: '9.5px', padding: '0 4px' }}>{selectedVideo.category || 'HLS'}</span>
                    <span>•</span>
                    <span>{selectedVideo.duration_formatted || '10:00'}</span>
                    <span>•</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary-purple)' }}>{selectedVideo.badge || 'HD'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Video Stream</label>
              <select
                className="form-control"
                value={selectedVideo?.video_id || ''}
                onChange={handleVideoChange}
                disabled={isBenchmarking}
              >
                {videos.map(v => (
                  <option key={v.video_id} value={v.video_id}>{v.title}</option>
                ))}
              </select>
            </div>
            {selectedVideo?.stream_url && (
              <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--text-muted)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Film size={11} color="var(--primary-purple)" />
                <span>{selectedVideo.stream_url}</span>
              </div>
            )}
          </div>

          {/* Network Profile */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SlidersHorizontal size={15} color="var(--primary-purple)" />
                <span>Network Profile</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Simulation Preset</label>
              <select
                className="form-control"
                value={selectedProfile?.profile_id || ''}
                onChange={handleProfileChange}
                disabled={isBenchmarking}
              >
                <option value="">— Custom Parameter Configuration —</option>
                {profiles.map(p => (
                  <option key={p.profile_id} value={p.profile_id}>{p.profile_name}</option>
                ))}
              </select>
            </div>

            {selectedProfile && (
              <div style={{
                background: 'var(--info-bg)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '11.5px',
                lineHeight: '1.6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ color: 'var(--primary-purple)' }}>{selectedProfile.profile_name}</strong>
                  <span className="chip chip-blue" style={{ fontSize: '10px' }}>Active Preset</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Bandwidth: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedProfile.bandwidth_kbps} Kbps</span> ({(selectedProfile.bandwidth_kbps / 1000).toFixed(1)} Mbps)
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  RTT Latency: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedProfile.latency_ms} ms</span> | Loss: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedProfile.packet_loss_pct || 0}%</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Cache Hit Probability: <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(selectedProfile.cache_hit_prob * 100)}%</span> (Edge CDN)
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
              Channel Parameters
            </div>

            {/* Bandwidth */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Bandwidth (Kbps)</label>
              <div className="range-row">
                <input
                  type="range" className="form-range"
                  min="100" max="20000" step="50"
                  value={config.bandwidthKbps}
                  onChange={e => handleConfigChange('bandwidthKbps', e.target.value)}
                  disabled={isBenchmarking}
                />
                <span className="range-value">{config.bandwidthKbps} Kbps</span>
              </div>
            </div>

            {/* Latency */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">RTT Latency (ms)</label>
              <div className="range-row">
                <input
                  type="range" className="form-range"
                  min="0" max="500" step="5"
                  value={config.latencyMs}
                  onChange={e => handleConfigChange('latencyMs', e.target.value)}
                  disabled={isBenchmarking}
                />
                <span className="range-value">{config.latencyMs} ms</span>
              </div>
            </div>

            {/* Packet Loss */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Packet Loss (%)</label>
              <div className="range-row">
                <input
                  type="range" className="form-range"
                  min="0" max="10" step="0.1"
                  value={config.packetLossPct}
                  onChange={e => handleConfigChange('packetLossPct', e.target.value)}
                  disabled={isBenchmarking}
                />
                <span className="range-value">{parseFloat(config.packetLossPct).toFixed(1)}%</span>
              </div>
            </div>

            {/* Cache Hit Probability */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Edge Cache Hit Ratio</label>
              <div className="range-row">
                <input
                  type="range" className="form-range"
                  min="0" max="1" step="0.05"
                  value={config.cacheHitProb}
                  onChange={e => handleConfigChange('cacheHitProb', e.target.value)}
                  disabled={isBenchmarking}
                />
                <span className="range-value">{Math.round(config.cacheHitProb * 100)}%</span>
              </div>
            </div>

            {/* Test Duration */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label">Benchmark Duration</label>
              <div className="range-row">
                <input
                  type="range" className="form-range"
                  min="10" max="120" step="5"
                  value={config.testDurationSec}
                  onChange={e => handleConfigChange('testDurationSec', e.target.value)}
                  disabled={isBenchmarking}
                />
                <span className="range-value">{config.testDurationSec} s</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!isBenchmarking ? (
                <>
                  <button className="btn btn-primary btn-lg w-full" onClick={startBenchmark}>
                    <Play size={16} fill="currentColor" />
                    <span>Start Benchmark</span>
                  </button>
                  <button className="btn btn-secondary w-full" onClick={resetConfig}>
                    <RotateCcw size={14} />
                    <span>Reset Parameters</span>
                  </button>
                </>
              ) : (
                <button className="btn btn-danger btn-lg w-full" onClick={() => stopBenchmark()}>
                  <Square size={16} fill="currentColor" />
                  <span>Stop Benchmark</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Card */}
          {(baselineMetrics || optimizedMetrics) && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Quick Comparison</div>
              </div>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left', padding:'4px 0', color:'var(--text-muted)', fontSize:'10px'}}>Metric</th>
                    <th style={{textAlign:'right', color:'var(--text-secondary)', fontSize:'10px'}}>Baseline</th>
                    <th style={{textAlign:'right', color:'var(--primary-purple)', fontSize:'10px'}}>Optimized</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Strategy', b: 'Fixed Rendition', o: 'Adaptive ABR' },
                    { label: 'Resolution', b: baselineMetrics?.currentResolution || '--', o: optimizedMetrics?.currentResolution || '--' },
                    { label: 'Startup', b: baselineMetrics?.startupDelayMs ? (baselineMetrics.startupDelayMs/1000).toFixed(2)+'s' : '--', o: optimizedMetrics?.startupDelayMs ? (optimizedMetrics.startupDelayMs/1000).toFixed(2)+'s' : '--' },
                    { label: 'Buffer', b: baselineMetrics?.currentBufferSec?.toFixed(1)+'s'||'--', o: optimizedMetrics?.currentBufferSec?.toFixed(1)+'s'||'--' },
                    { label: 'Stalls', b: baselineMetrics?.stallCount ?? '--', o: optimizedMetrics?.stallCount ?? '--' },
                    { label: 'Switches', b: '0 (Locked)', o: optimizedMetrics?.qualitySwitches ?? '0' },
                    { label: 'Bitrate', b: baselineMetrics?.currentBitrateKbps ? baselineMetrics.currentBitrateKbps+'K' : '--', o: optimizedMetrics?.currentBitrateKbps ? optimizedMetrics.currentBitrateKbps+'K' : '--' },
                  ].map(row => (
                    <tr key={row.label} style={{borderTop:'1px solid var(--border)'}}>
                      <td style={{padding:'6px 0', color:'var(--text-muted)'}}>{row.label}</td>
                      <td style={{textAlign:'right', color:'var(--text-secondary)', fontFamily:'var(--font-mono)'}}>{row.b}</td>
                      <td style={{textAlign:'right', color:'var(--text-secondary)', fontFamily:'var(--font-mono)'}}>{row.o}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT: Players + Charts ─────────────────────────────────── */}
        <div className="players-panel">

          {/* Synchronized Playback Control Toolbar */}
          <div className="card card-sm" style={{ marginBottom: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={14} color="var(--primary-purple)" />
                  Synchronized Controls:
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePlayBoth}
                  title="Play both video streams simultaneously"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Play Both</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePauseBoth}
                  title="Pause both video streams simultaneously"
                >
                  <Pause size={13} />
                  <span>Pause Both</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRestartBoth}
                  title="Rewind both players to 0:00"
                >
                  <RotateCcw size={13} />
                  <span>Restart (0:00)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSyncPlayheads}
                  title="Align Optimized player playhead to Baseline player"
                >
                  <SlidersHorizontal size={13} />
                  <span>Sync Playheads</span>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                  Baseline: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>Locked 1080p</strong>
                </span>
                <span>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-purple)' }}></span>
                  Optimized: <strong style={{ color: 'var(--primary-purple)', fontFamily: 'var(--font-mono)' }}>Custom ABR</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Live Progress Card (moved from sidebar) */}
          {isBenchmarking && (
            <div className="card" style={{ marginBottom: '14px' }}>
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} color="var(--primary-purple)" />
                  <span>Live Progress</span>
                </div>
                <span className="chip chip-green">Active Run</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Elapsed Time</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-purple)' }}>
                    {benchmarkTimer}s / {config.testDurationSec}s
                  </span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{
                    width: `${Math.min(100, (benchmarkTimer / config.testDurationSec) * 100)}%`,
                    background: 'var(--primary-purple)'
                  }} />
                </div>
                {sessionId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Session Record</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>#{sessionId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dual player grid */}
          <div className="dual-player-grid">
            <BaselinePlayer
              ref={baselineRef}
              src={activeStreamSrc}
              networkConfig={networkConfig}
              onMetrics={handleBaselineMetrics}
              sessionId={sessionId}
            />
            <OptimizedPlayer
              ref={optimizedRef}
              src={activeStreamSrc}
              networkConfig={networkConfig}
              onMetrics={handleOptimizedMetrics}
              sessionId={sessionId}
            />
          </div>

          {/* No stream selected placeholder */}
          {!activeStreamSrc && (
            <div className="card" style={{padding:'32px'}}>
              <div className="empty-state">
                <div className="empty-state-icon">🎬</div>
                <div className="empty-state-text">Select a video and network profile, then click Start Benchmark</div>
                <div className="empty-state-sub">Both players will start simultaneously under identical conditions</div>
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="charts-row">
            <BufferBitrateChart
              baselineSeries={baselineSeries}
              optimizedSeries={optimizedSeries}
            />
            <PerformanceBarChart
              baselineMetrics={baselineMetrics}
              optimizedMetrics={optimizedMetrics}
            />
            <CacheEfficiencyChart
              hits={totalCacheHits}
              misses={totalCacheMisses}
            />
          </div>

          {/* ABR explanation */}
          <div className="card card-sm" style={{ background: 'var(--info-bg)', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--primary-purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--border-accent)'
              }}>
                <Layers size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Custom Adaptive Bitrate (ABR) Decision Heuristic
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <strong style={{ color: 'var(--error)' }}>Emergency Downshift:</strong> Buffer &lt; 3.5 s → step down 1 level &nbsp;|&nbsp;
                  <strong style={{ color: 'var(--success)' }}>Conservative Upshift:</strong> Buffer &gt; 10.0 s AND candidate bitrate ≤ 75% safe bandwidth → step up 1 level &nbsp;|&nbsp;
                  <strong style={{ color: 'var(--primary-purple)' }}>Steady State:</strong> 3.5 s – 10.0 s → maintain current rendition.
                  &nbsp; Decision cycle: 1500 ms.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Recent Benchmarks & Platform Status ─────── */}
      <div style={{ marginTop: '28px' }}>
        {summaryData?.recentSessions && summaryData.recentSessions.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div className="card-title">Recent Benchmark Runs</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Comparative trials persisted in MySQL database
                </div>
              </div>
              <Link to="/history" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>View Complete History</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Video Source</th>
                    <th>Network Scenario</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Recorded</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.recentSessions.map(s => (
                    <tr key={s.session_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-purple)' }}>
                        #{s.session_id}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {s.video_title || 'Mux Multi-Bitrate'}
                      </td>
                      <td>
                        <span className="chip chip-blue">
                          {s.profile_name || `${s.sim_bandwidth_kbps} Kbps`}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {s.test_duration_sec}s
                      </td>
                      <td>
                        <span className={`chip ${s.status === 'completed' ? 'chip-green' : s.status === 'running' ? 'chip-blue' : 'chip-amber'}`}>
                          ● {s.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/report/${s.session_id}`} className="btn btn-outline-blue btn-sm" style={{ padding: '4px 10px', fontSize: '11.5px' }}>
                          <span>Report</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--info-bg)',
                color: 'var(--primary-purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BarChart3 size={24} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                No Benchmark Sessions Recorded Yet
              </div>
              <div style={{ maxWidth: '520px', margin: '0 auto', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Select a video stream and network scenario above, then click <strong>"Start Benchmark"</strong> to execute your first comparative trial.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

