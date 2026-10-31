import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Hls from 'hls.js';
import {
  Wifi,
  Database,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sliders,
  TrendingUp,
  Activity,
  Layers,
  HardDrive,
  Cpu,
  ChevronRight,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { VERIFIED_HLS_STREAMS, NETWORK_PROFILES } from '../utils/streamConstants';
import {
  getStoredEvents,
  getStoredTimeline,
  logAppEvent,
  logTimelineEvent
} from '../services/sessionStore';

export default function Overview() {
  const [selectedVideo, setSelectedVideo] = useState(VERIFIED_HLS_STREAMS[0]);
  const [selectedProfile, setSelectedProfile] = useState(NETWORK_PROFILES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('idle'); // idle | loading | playing | stalled | error
  const [errorMessage, setErrorMessage] = useState(null);

  // Live telemetry measurements
  const [telemetry, setTelemetry] = useState({
    bufferSec: 0,
    bitrateKbps: 0,
    resolution: '--',
    startupDelayMs: 0,
    rebufferSec: 0,
    stallCount: 0,
  });

  const [recentEvents, setRecentEvents] = useState(() => getStoredEvents());
  const [timelineEvents, setTimelineEvents] = useState(() => getStoredTimeline());

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const pollTimerRef = useRef(null);
  const stallStartRef = useRef(null);
  const playStartTimeRef = useRef(null);

  // Sync with application event bus
  useEffect(() => {
    const handleEventAdded = () => setRecentEvents(getStoredEvents());
    const handleTimelineAdded = () => setTimelineEvents(getStoredTimeline());

    window.addEventListener('streamsmart:app_event', handleEventAdded);
    window.addEventListener('streamsmart:timeline_event', handleTimelineAdded);

    return () => {
      window.removeEventListener('streamsmart:app_event', handleEventAdded);
      window.removeEventListener('streamsmart:timeline_event', handleTimelineAdded);
    };
  }, []);

  // Initialize and attach HLS to the preview player
  const initStream = () => {
    if (!videoRef.current || !selectedVideo) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setPlayerStatus('loading');
    setErrorMessage(null);
    playStartTimeRef.current = Date.now();

    if (!Hls.isSupported()) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = selectedVideo.stream_url;
        setPlayerStatus('playing');
      } else {
        setPlayerStatus('error');
        setErrorMessage('HLS playback is not supported in this browser.');
      }
      return;
    }

    const hls = new Hls({
      startLevel: -1,
      autoStartLoad: true,
      maxBufferLength: 30,
    });

    hls.on(Hls.Events.MANIFEST_PARSED, (evt, data) => {
      setPlayerStatus('playing');
      setIsPlaying(true);
      setHasStarted(true);

      const delay = Date.now() - (playStartTimeRef.current || Date.now());
      setTelemetry(prev => ({
        ...prev,
        startupDelayMs: delay,
        resolution: data.levels[hls.currentLevel]?.name || `${data.levels[hls.currentLevel]?.height}p` || 'Auto'
      }));

      logAppEvent({
        title: 'Video playback started',
        desc: `Decoding ${selectedVideo.title} (${data.levels?.length || 0} renditions parsed)`,
        type: 'success'
      });
      let host = 'CDN';
      try { host = new URL(selectedVideo.stream_url).hostname; } catch (_) {}
      logTimelineEvent({
        title: 'Video Stream Loaded',
        description: `Parsed manifest from ${host} with ${data.levels?.length || 5} quality tiers`,
        type: 'video'
      });

      videoRef.current?.play().catch(() => {});
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (evt, data) => {
      const lvl = hls.levels[data.level];
      if (lvl) {
        setTelemetry(prev => ({
          ...prev,
          resolution: `${lvl.height}p`,
          bitrateKbps: Math.round(lvl.bitrate / 1000)
        }));
      }
    });

    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (data.fatal) {
        setPlayerStatus('error');
        const detail = data.details || 'Network or CORS policy rejected the video manifest';
        setErrorMessage(detail);

        logAppEvent({
          title: 'Video loading failed',
          desc: `Failed to load stream: ${detail}`,
          type: 'error'
        });
        logTimelineEvent({
          title: 'Video Loading Failed',
          description: `Network request rejected: ${detail}`,
          status: 'error',
          type: 'error'
        });
      }
    });

    hls.loadSource(selectedVideo.stream_url);
    hls.attachMedia(videoRef.current);
    hlsRef.current = hls;
  };

  useEffect(() => {
    initStream();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedVideo]);

  // Buffer telemetry polling loop
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      if (!videoRef.current) return;
      const v = videoRef.current;

      // Calculate buffer ahead of playhead
      let currentBuf = 0;
      if (v.buffered && v.buffered.length > 0) {
        const cur = v.currentTime;
        for (let i = 0; i < v.buffered.length; i++) {
          if (cur >= v.buffered.start(i) && cur <= v.buffered.end(i)) {
            currentBuf = v.buffered.end(i) - cur;
            break;
          }
        }
      }

      setTelemetry(prev => ({
        ...prev,
        bufferSec: parseFloat(currentBuf.toFixed(1))
      }));
    }, 1000);

    return () => clearInterval(pollTimerRef.current);
  }, []);

  // Keep custom Play/Pause state in sync with actual playback events
  // (HLS.js auto-play, native pause, ended, and stalled states).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlaying = () => {
      setIsPlaying(true);
      setPlayerStatus('playing');
    };
    const onPause = () => {
      setIsPlaying(false);
      setPlayerStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    };
    const onEnded = () => {
      setIsPlaying(false);
      setPlayerStatus('idle');
    };
    const onWaiting = () => {
      if (!v.paused) setPlayerStatus('stalled');
    };

    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    v.addEventListener('waiting', onWaiting);

    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('waiting', onWaiting);
    };
  }, []);

  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
    logAppEvent({
      title: 'Video selected',
      desc: `Selected "${video.title}" (${video.available_tiers})`,
      type: 'info'
    });
  };

  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile);
    logAppEvent({
      title: 'Network profile changed',
      desc: `Switched network preset to ${profile.profile_name} (${profile.bandwidth_kbps} Kbps)`,
      type: 'info'
    });
    logTimelineEvent({
      title: 'Network Profile Changed',
      description: `Preset switched to ${profile.profile_name} (${profile.bandwidth_kbps} Kbps, ${profile.latency_ms}ms)`,
      type: 'network'
    });
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setPlayerStatus('idle');
      logAppEvent({ title: 'Playback paused', desc: 'User paused playback on primary monitor', type: 'info' });
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setPlayerStatus('playing');
        logAppEvent({ title: 'Playback resumed', desc: 'User resumed playback', type: 'info' });
      }).catch(err => {
        console.warn('Play interrupted:', err);
      });
    }
  };

  // Signal Quality Heuristic
  const getSignalQuality = () => {
    const bw = selectedProfile.bandwidth_kbps;
    const loss = selectedProfile.packet_loss_pct;
    if (bw >= 10000 && loss === 0) return { label: 'Excellent', color: 'var(--success)' };
    if (bw >= 4000 && loss <= 0.2) return { label: 'Good', color: 'var(--primary-purple)' };
    if (bw >= 1500 && loss <= 1.5) return { label: 'Fair', color: 'var(--warning)' };
    return { label: 'Poor', color: 'var(--error)' };
  };

  // Buffering Risk Heuristic
  const getBufferingRisk = () => {
    if (!hasStarted) {
      return {
        level: 'Idle',
        pct: 0,
        explanation: 'Start playback or launch a benchmark to calculate real-time buffer risk.'
      };
    }
    const buf = telemetry.bufferSec;
    const bw = selectedProfile.bandwidth_kbps;
    const bitrate = telemetry.bitrateKbps || 2800;

    if (buf < 3.5 || bw < bitrate * 0.8) {
      return {
        level: 'High Risk',
        pct: 88,
        color: 'var(--error)',
        explanation: `Buffer is low (${buf.toFixed(1)}s) and bandwidth is near capacity. Immediate starvation risk.`
      };
    }
    if (buf < 8.0) {
      return {
        level: 'Moderate Risk',
        pct: 45,
        color: 'var(--warning)',
        explanation: `Buffer depth (${buf.toFixed(1)}s) is below optimal threshold (10.0s). Upshifts paused.`
      };
    }
    return {
      level: 'Low Risk',
      pct: 12,
      color: 'var(--success)',
      explanation: `Buffer occupancy (${buf.toFixed(1)}s) exceeds safe threshold (10.0s); bandwidth adequate.`
    };
  };

  // Quality recommendation
  const getQualityRecommendation = () => {
    if (!hasStarted) return 'Awaiting playback initialization';
    const buf = telemetry.bufferSec;
    const bw = selectedProfile.bandwidth_kbps;
    if (buf < 3.5) return 'Emergency downshift to 360p / 240p recommended';
    if (buf > 10.0 && bw >= 3700) return 'Safe to upshift to 1080p (Headroom > 75%)';
    return `Maintain current tier (${telemetry.resolution || '720p'}) for visual stability`;
  };

  const signal = getSignalQuality();
  const risk = getBufferingRisk();
  const recommendation = getQualityRecommendation();

  return (
    <div>
      {/* ── Top Overview Header ─────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>Overview</h2>
            <div className="page-subtitle" style={{ fontSize: '13px' }}>
              Primary telemetry dashboard & live streaming health monitor
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="live-beacon">
              <span className="beacon-dot" />
              <span>{hasStarted ? 'Live Session Active' : 'Ready / Idle'}</span>
            </div>
            <Link to="/workbench" className="btn btn-primary btn-sm">
              <Play size={13} fill="currentColor" />
              <span>Open Benchmarking Studio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Metric Cards Row 1 (4 Cards) ────────────────────────────── */}
      <div className="overview-metric-grid-4" style={{ marginBottom: '16px' }}>
        {/* Card 1: Network Status */}
        <div className="metric-card-detailed">
          <div className="metric-card-header">
            <span className="metric-card-title">Network Status</span>
            <Wifi size={16} color="var(--primary-purple)" />
          </div>
          <div>
            <div className="metric-card-primary-value" style={{ fontSize: '20px' }}>
              {selectedProfile.type}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Signal Quality:</span>
              <span style={{ color: signal.color, fontWeight: 700 }}>{signal.label}</span>
            </div>
          </div>
          <div className="metric-sub-items">
            <div className="metric-sub-item">
              <span className="metric-sub-label">BW:</span>
              <span className="metric-sub-val">{selectedProfile.bandwidth_kbps.toLocaleString()}k</span>
            </div>
            <div className="metric-sub-item">
              <span className="metric-sub-label">RTT:</span>
              <span className="metric-sub-val">{selectedProfile.latency_ms}ms</span>
            </div>
            <div className="metric-sub-item">
              <span className="metric-sub-label">Loss:</span>
              <span className="metric-sub-val">{selectedProfile.packet_loss_pct}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Buffer Health */}
        <div className="metric-card-detailed">
          <div className="metric-card-header">
            <span className="metric-card-title">Buffer Health</span>
            <Database size={16} color="var(--primary-purple)" />
          </div>
          <div>
            <div className="metric-card-primary-value">
              {hasStarted ? `${telemetry.bufferSec.toFixed(1)}s` : '--'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>State:</span>
              <span className={`chip ${playerStatus === 'playing' ? 'chip-green' : playerStatus === 'stalled' ? 'chip-red' : 'chip-blue'}`} style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                {hasStarted ? playerStatus.toUpperCase() : 'NO PLAYBACK'}
              </span>
            </div>
          </div>
          <div className="metric-sub-items">
            <div className="metric-sub-item">
              <span className="metric-sub-label">Target:</span>
              <span className="metric-sub-val">10.0s</span>
            </div>
            <div className="metric-sub-item">
              <span className="metric-sub-label">Min Safety:</span>
              <span className="metric-sub-val">3.5s</span>
            </div>
          </div>
        </div>

        {/* Card 3: Buffering Risk */}
        <div className="metric-card-detailed">
          <div className="metric-card-header">
            <span className="metric-card-title">Buffering Risk</span>
            <AlertTriangle size={16} color={risk.color || 'var(--warning)'} />
          </div>
          <div>
            <div className="metric-card-primary-value" style={{ color: risk.color || 'inherit' }}>
              {risk.level}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
              {risk.explanation}
            </div>
          </div>
          <div className="metric-sub-items">
            <div className="metric-sub-item">
              <span className="metric-sub-label">Risk Index:</span>
              <span className="metric-sub-val" style={{ color: risk.color || 'inherit' }}>{risk.pct}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Streaming Quality */}
        <div className="metric-card-detailed">
          <div className="metric-card-header">
            <span className="metric-card-title">Streaming Quality</span>
            <TrendingUp size={16} color="var(--primary-purple)" />
          </div>
          <div>
            <div className="metric-card-primary-value">
              {hasStarted ? telemetry.resolution : '--'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
              {recommendation}
            </div>
          </div>
          <div className="metric-sub-items">
            <div className="metric-sub-item">
              <span className="metric-sub-label">Bitrate:</span>
              <span className="metric-sub-val">{telemetry.bitrateKbps > 0 ? `${telemetry.bitrateKbps}k` : 'Auto'}</span>
            </div>
            <div className="metric-sub-item">
              <span className="metric-sub-label">Safety Margin:</span>
              <span className="metric-sub-val">75%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric Cards Row 2 (3 Cards) ────────────────────────────── */}
      <div className="overview-metric-grid-3" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Startup Delay (TTFF)</span>
            <div className="stat-icon-wrap">
              <Clock size={16} />
            </div>
          </div>
          <div className="stat-value">
            {hasStarted && telemetry.startupDelayMs > 0 ? (telemetry.startupDelayMs / 1000).toFixed(2) : '--'}
            <span className="stat-unit">sec</span>
          </div>
          <div className="stat-sub">
            {hasStarted ? 'Time to first decoded video frame' : 'Start playback to view startup latency'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Buffering Duration</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--error-bg)', color: 'var(--danger)' }}>
              <Pause size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ color: telemetry.rebufferSec > 0 ? 'var(--error)' : 'inherit' }}>
            {hasStarted ? telemetry.rebufferSec.toFixed(1) : '--'}
            <span className="stat-unit">sec</span>
          </div>
          <div className="stat-sub">
            {hasStarted ? 'Total time spent recovering from buffer starvation' : 'No starvation events recorded'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Playback Interruptions</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ color: telemetry.stallCount > 0 ? 'var(--error)' : 'inherit' }}>
            {hasStarted ? telemetry.stallCount : '--'}
            <span className="stat-unit">stalls</span>
          </div>
          <div className="stat-sub">
            {hasStarted ? 'Stalls triggered by depleted media buffer' : 'Playback continuous & stable'}
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Layout: Left (Player + Timeline) & Right (Activities & Alerts) ── */}
      <div className="overview-layout">
        {/* Left Column: Player & Full-Width Optimization Timeline */}
        <div className="overview-main">
          {/* Active Stream Live Monitor */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--primary-purple)" />
                <div className="card-title">Live Playback Telemetry Monitor</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Profile quick select */}
                <select
                  className="form-control"
                  style={{ fontSize: '12px', padding: '4px 8px', height: '32px' }}
                  value={selectedProfile.id}
                  onChange={(e) => {
                    const prof = NETWORK_PROFILES.find(p => p.id === Number(e.target.value));
                    if (prof) handleSelectProfile(prof);
                  }}
                >
                  {NETWORK_PROFILES.map(p => (
                    <option key={p.id} value={p.id}>{p.profile_name}</option>
                  ))}
                </select>

                {/* Video quick select */}
                <select
                  className="form-control"
                  style={{ fontSize: '12px', padding: '4px 8px', height: '32px', maxWidth: '220px' }}
                  value={selectedVideo.video_id}
                  onChange={(e) => {
                    const vid = VERIFIED_HLS_STREAMS.find(v => v.video_id === Number(e.target.value));
                    if (vid) handleSelectVideo(vid);
                  }}
                >
                  {VERIFIED_HLS_STREAMS.map(v => (
                    <option key={v.video_id} value={v.video_id}>{v.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Video Viewport with overlays */}
            <div className="player-video-wrap" style={{ borderRadius: 'var(--radius-md)' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', display: 'block' }}
              />

              {/* Loading State */}
              {playerStatus === 'loading' && (
                <div className="player-loading-overlay">
                  <div className="player-loading-spinner" />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading HLS Stream Manifest…</div>
                </div>
              )}

              {/* Error State with Retry Button */}
              {playerStatus === 'error' && (
                <div className="player-error-overlay">
                  <AlertTriangle size={36} color="var(--error)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-inverse)' }}>Video Loading Failed</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '85%', margin: '6px auto 16px' }}>
                    {errorMessage || 'Network error or CORS restrictions prevented stream manifest delivery.'}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={initStream}>
                    <RotateCcw size={13} />
                    <span>Retry Stream</span>
                  </button>
                </div>
              )}

              <div className="player-overlay">
                <span className="player-overlay-badge" style={{ background: 'var(--primary-purple)' }}>
                  {telemetry.resolution}
                </span>
                {telemetry.bitrateKbps > 0 && (
                  <span className="player-overlay-badge">{telemetry.bitrateKbps} Kbps</span>
                )}
                <span className="player-overlay-badge">
                  Buf: {telemetry.bufferSec.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Stream details bar */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVideo.title}</span>
                <span className="chip chip-blue" style={{ fontSize: '10px', padding: '1px 6px' }}>{selectedVideo.badge}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={togglePlay}
                  disabled={playerStatus === 'loading' || playerStatus === 'error'}
                  title={playerStatus === 'loading' ? 'Buffering…' : undefined}
                >
                  {playerStatus === 'loading' ? (
                    <RotateCcw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : isPlaying ? (
                    <Pause size={13} />
                  ) : (
                    <Play size={13} />
                  )}
                  <span>
                    {playerStatus === 'loading' ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
                  </span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={initStream}>
                  <RotateCcw size={13} />
                  <span>Reload</span>
                </button>
              </div>
            </div>
          </div>

          {/* Full-Width Optimization Timeline */}
          <div className="timeline-card">
            <div className="card-header" style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary-purple)" />
                <div className="card-title">Optimization Timeline</div>
              </div>
              <span className="chip chip-blue" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Chronological Events
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Historical sequence of streaming milestones, network condition transitions, and ABR decisions
            </div>

            <div className="timeline-track">
              {timelineEvents.map((item, idx) => (
                <div key={item.id || idx} className="timeline-item">
                  <div className={`timeline-node ${item.status || 'completed'}`}>
                    {idx + 1}
                  </div>
                  <div className="timeline-header-row">
                    <span className="timeline-title">{item.title}</span>
                    <span className="timeline-time-badge">{item.timestamp}</span>
                  </div>
                  <div className="timeline-desc">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Activities & Alerts Panel */}
        <aside className="overview-sidebar">
          <div className="activities-panel">
            <div className="activities-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={17} color="var(--primary-purple)" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Activities & Alerts
                </h3>
              </div>
              <div className="live-beacon">
                <span className="beacon-dot" />
                <span>Live Feed</span>
              </div>
            </div>

            {/* Scrollable Events List */}
            <div className="events-list">
              {recentEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No recent activities recorded.
                </div>
              ) : (
                recentEvents.map((evt) => (
                  <div key={evt.id} className="event-item">
                    <div className={`event-icon-chip ${evt.type || 'info'}`}>
                      {evt.type === 'error' ? (
                        <AlertTriangle size={14} />
                      ) : evt.type === 'warning' ? (
                        <Clock size={14} />
                      ) : evt.type === 'success' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <Activity size={14} />
                      )}
                    </div>
                    <div className="event-content">
                      <div className="event-title-row">
                        <span className="event-title">{evt.title}</span>
                        <span className="event-time">{evt.timestamp}</span>
                      </div>
                      <div className="event-desc">{evt.desc}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* System Health Section */}
            <div className="system-health-box">
              <div className="system-health-title">
                <ShieldCheck size={14} color="var(--success)" />
                <span>System Health & Modules</span>
              </div>
              <div className="health-row">
                <span>Edge Cache POP</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Active (12ms POP)</span>
              </div>
              <div className="health-row">
                <span>MSE Buffer Controller</span>
                <span style={{ color: 'var(--primary-purple)', fontWeight: 600 }}>Operational</span>
              </div>
              <div className="health-row">
                <span>LocalStorage Sync</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Persisting (v1.3)</span>
              </div>
            </div>

            {/* Quick Workbench Action Banner */}
            <div style={{
              background: 'var(--info-bg)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontWeight: 600, color: 'var(--primary-purple)', marginBottom: '4px' }}>
                Dual-Player Benchmarking
              </div>
              <div>Run side-by-side trials comparing Fixed 1080p vs Adaptive ABR in real time.</div>
              <Link to="/workbench" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', color: 'var(--primary-purple)', fontWeight: 700 }}>
                <span>Launch Benchmark Studio</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

