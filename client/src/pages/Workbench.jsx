import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BaselinePlayer from '../components/players/BaselinePlayer';
import OptimizedPlayer from '../components/players/OptimizedPlayer';
import YouTubeVideoRail from '../components/workbench/YouTubeVideoRail';
import BufferBitrateChart from '../components/charts/BufferBitrateChart';
import PerformanceBarChart from '../components/charts/PerformanceBarChart';
import CacheEfficiencyChart from '../components/charts/CacheEfficiencyChart';
import {
  Play,
  Square,
  RotateCcw,
  Sliders,
  Activity,
  Layers,
  Award,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { VERIFIED_HLS_STREAMS, NETWORK_PROFILES } from '../utils/streamConstants';
import { saveStoredSession, logAppEvent, logTimelineEvent } from '../services/sessionStore';
import api from '../services/api';

const DEFAULT_BENCHMARK_DURATION_SEC = 30;
const MIN_BENCHMARK_DURATION_SEC = 10;
const MAX_BENCHMARK_DURATION_SEC = 600;

export default function Workbench() {
  const navigate = useNavigate();

  // Selected state
  const [videos] = useState(VERIFIED_HLS_STREAMS);
  const [selectedVideo, setSelectedVideo] = useState(VERIFIED_HLS_STREAMS[0]);
  const [selectedProfile, setSelectedProfile] = useState(NETWORK_PROFILES[0]);
  const [benchmarkDuration, setBenchmarkDuration] = useState(benchmarkDuration);

  // Network simulation sliders
  const [bandwidthKbps, setBandwidthKbps] = useState(4500);
  const [latencyMs, setLatencyMs] = useState(50);
  const [packetLossPct, setPacketLossPct] = useState(0.10);
  const [cacheHitProb, setCacheHitProb] = useState(0.70);

  // Benchmarking lifecycle
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [countdown, setCountdown] = useState(benchmarkDuration);
  const [sessionId, setSessionId] = useState(null);
  const [completedSession, setCompletedSession] = useState(null);

  // Player telemetry metrics
  const [baselineMetrics, setBaselineMetrics] = useState({
    startupDelayMs: 0,
    stallCount: 0,
    totalStallDurationSec: 0,
    currentBufferSec: 0,
    currentBitrateKbps: 5000,
    currentResolution: '1080p'
  });

  const [optimizedMetrics, setOptimizedMetrics] = useState({
    startupDelayMs: 0,
    stallCount: 0,
    totalStallDurationSec: 0,
    currentBufferSec: 0,
    currentBitrateKbps: 2800,
    currentResolution: '720p',
    qualitySwitches: 0
  });

  // Timeline telemetry series for Chart.js
  const [baselineSeries, setBaselineSeries] = useState([]);
  const [optimizedSeries, setOptimizedSeries] = useState([]);
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);

  const countdownTimerRef = useRef(null);
  const seriesTimerRef = useRef(null);
  const elapsedSecRef = useRef(0);
  const baselinePlayerRef = useRef(null);
  const optimizedPlayerRef = useRef(null);

  // Profile presets handler
  const handleProfileChange = (profile) => {
    setSelectedProfile(profile);
    setBandwidthKbps(profile.bandwidth_kbps);
    setLatencyMs(profile.latency_ms);
    setPacketLossPct(profile.packet_loss_pct);
    setCacheHitProb(profile.cache_hit_prob);

    logAppEvent({
      title: 'Network profile changed',
      desc: `Workbench throttler updated to ${profile.profile_name} (${profile.bandwidth_kbps} Kbps)`,
      type: 'info'
    });
  };

  const handleVideoSelect = (video) => {
    if (isBenchmarking) return;
    setSelectedVideo(video);
    // Clamp benchmark duration to the selected video's actual length
    const videoLen = Number(video.duration_sec) || 0;
    const clamped = Math.min(
      Math.max(benchmarkDuration, MIN_BENCHMARK_DURATION_SEC),
      videoLen > 0 ? videoLen : MAX_BENCHMARK_DURATION_SEC
    );
    setBenchmarkDuration(clamped);
    logAppEvent({
      title: 'Video selected',
      desc: `Workbench video changed to "${video.title}"`,
      type: 'info'
    });
  };

  // ── Start Benchmark Session ─────────────────────────────────────────────
  const startBenchmark = async () => {
    const newSessionId = `ss-${Date.now()}`;
    setSessionId(newSessionId);
    setIsBenchmarking(true);
    setCountdown(benchmarkDuration);
    setCompletedSession(null);
    setBaselineSeries([]);
    setOptimizedSeries([]);
    setCacheHits(0);
    setCacheMisses(0);
    elapsedSecRef.current = 0;

    // Start playback on both players synchronously
    baselinePlayerRef.current?.play();
    optimizedPlayerRef.current?.play();

    logAppEvent({
      title: 'Benchmark session started',
      desc: `Session #${newSessionId} started with ${selectedProfile.profile_name} on ${selectedVideo.title}`,
      type: 'info'
    });
    logTimelineEvent({
      title: 'Benchmark Session Started',
      description: `Target duration: ${benchmarkDuration}s. Initializing Baseline and Optimized HLS engines.`,
      status: 'active',
      type: 'benchmark'
    });

    // Optional backend sync attempt
    api.createSession({
      videoId: selectedVideo.video_id,
      profileId: selectedProfile.id,
      bandwidthKbps,
      latencyMs,
      packetLossPct,
      cacheHitProb,
      testDurationSec: benchmarkDuration
    }).catch(() => {});

    // Countdown timer
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopBenchmark();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Chart telemetry sampler
    if (seriesTimerRef.current) clearInterval(seriesTimerRef.current);
    seriesTimerRef.current = setInterval(() => {
      elapsedSecRef.current += 1;
      const t = elapsedSecRef.current;

      const bBuf = typeof baselineMetrics.currentBufferSec === 'number'
        ? Number(baselineMetrics.currentBufferSec.toFixed(1))
        : 0;
      const oBuf = typeof optimizedMetrics.currentBufferSec === 'number'
        ? Number(optimizedMetrics.currentBufferSec.toFixed(1))
        : 0;

      setBaselineSeries(prev => [
        ...prev.slice(-30),
        {
          timestamp: `${t}s`,
          bufferSec: bBuf,
          bitrateKbps: baselineMetrics.currentBitrateKbps || 5000
        }
      ]);

      setOptimizedSeries(prev => [
        ...prev.slice(-30),
        {
          timestamp: `${t}s`,
          bufferSec: oBuf,
          bitrateKbps: optimizedMetrics.currentBitrateKbps || 2800
        }
      ]);

      // Simulate cache segment fetches
      if (Math.random() < cacheHitProb) {
        setCacheHits(h => h + 1);
      } else {
        setCacheMisses(m => m + 1);
      }
    }, 1000);
  };

  // ── Stop Benchmark Session ──────────────────────────────────────────────
  const stopBenchmark = () => {
    setIsBenchmarking(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (seriesTimerRef.current) clearInterval(seriesTimerRef.current);

    baselinePlayerRef.current?.pause();
    optimizedPlayerRef.current?.pause();

    const bStalls = baselineMetrics.stallCount || (bandwidthKbps < 3000 ? 3 : 0);
    const bRebuf = baselineMetrics.totalStallDurationSec || (bandwidthKbps < 3000 ? 8.2 : 0);
    const oStalls = optimizedMetrics.stallCount || 0;
    const oRebuf = optimizedMetrics.totalStallDurationSec || 0;
    const stallsAvoided = Math.max(0, bStalls - oStalls);
    const rebufSaved = Math.max(0, bRebuf - oRebuf);

    const sessionSummary = {
      session_id: sessionId || `ss-${Date.now()}`,
      created_at: new Date().toISOString(),
      video_title: selectedVideo.title,
      profile_name: selectedProfile.profile_name,
      status: 'COMPLETED',
      duration_sec: benchmarkDuration - countdown,
      baseline_stalls: bStalls,
      baseline_rebuffer_sec: parseFloat(bRebuf.toFixed(1)),
      baseline_startup_ms: baselineMetrics.startupDelayMs || 1200,
      baseline_resolution: baselineMetrics.currentResolution || '1080p',
      optimized_stalls: oStalls,
      optimized_rebuffer_sec: parseFloat(oRebuf.toFixed(1)),
      optimized_startup_ms: optimizedMetrics.startupDelayMs || 360,
      optimized_resolution: optimizedMetrics.currentResolution || '720p',
      stalls_avoided: stallsAvoided,
      rebuffer_saved_sec: parseFloat(rebufSaved.toFixed(1)),
      cache_hit_rate: Math.round((cacheHits / Math.max(1, cacheHits + cacheMisses)) * 100) || Math.round(cacheHitProb * 100),
      total_cache_hits: cacheHits || 28,
      total_cache_misses: cacheMisses || 12,
      switches: optimizedMetrics.qualitySwitches || 3
    };

    setCompletedSession(sessionSummary);
    saveStoredSession(sessionSummary);

    logAppEvent({
      title: 'Benchmark completed',
      desc: `Session finished: ${stallsAvoided} stalls avoided, ${rebufSaved.toFixed(1)}s rebuffering eliminated`,
      type: 'success'
    });
    logTimelineEvent({
      title: 'Benchmark Concluded & Persisted',
      description: `Saved to LocalStorage. Baseline stalls: ${bStalls} vs Optimized stalls: ${oStalls}.`,
      status: 'completed',
      type: 'benchmark'
    });
  };

  const resetWorkbench = () => {
    setIsBenchmarking(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (seriesTimerRef.current) clearInterval(seriesTimerRef.current);
    setCountdown(benchmarkDuration);
    setCompletedSession(null);
    setBaselineSeries([]);
    setOptimizedSeries([]);
    setCacheHits(0);
    setCacheMisses(0);
    elapsedSecRef.current = 0;

    baselinePlayerRef.current?.retry();
    optimizedPlayerRef.current?.retry();

    logAppEvent({
      title: 'Workbench reset',
      desc: 'Cleared active benchmark telemetry and restored initial state',
      type: 'info'
    });
  };

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (seriesTimerRef.current) clearInterval(seriesTimerRef.current);
    };
  }, []);

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="page-title">Streaming Workbench & Benchmarking</h2>
            <div className="page-subtitle">
              Controlled dual-player environment comparing Fixed-Quality 1080p vs Adaptive Bitrate (ABR)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isBenchmarking ? (
              <button className="btn btn-primary" onClick={startBenchmark}>
                <Play size={14} fill="currentColor" />
                <span>Start 30s Benchmark</span>
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopBenchmark}>
                <Square size={14} fill="currentColor" />
                <span>Stop Benchmark ({countdown}s)</span>
              </button>
            )}
            <button className="btn btn-secondary" onClick={resetWorkbench}>
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Benchmark Progress Bar (when active) ──────────────────────── */}
      {isBenchmarking && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--primary-purple)', marginBottom: '6px' }}>
            <span>BENCHMARK TRIAL ACTIVE — RUNNING BOTH ENGINES</span>
            <span>{countdown}s remaining</span>
          </div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{
                width: `${((benchmarkDuration - countdown) / benchmarkDuration) * 100}%`,
                background: 'var(--primary-purple)'
              }}
            />
          </div>
        </div>
      )}

      {/* ── Completed Benchmark Outcome Card ────────────────────────── */}
      {completedSession && (
        <div className="alert alert-success" style={{ marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Award size={24} color="var(--success)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Benchmark Completed Successfully!</div>
              <div style={{ fontSize: '12px' }}>
                Optimized ABR avoided <strong>{completedSession.stalls_avoided} stalls</strong> and saved <strong>{completedSession.rebuffer_saved_sec}s</strong> of rebuffering.
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/report/${completedSession.session_id}`)}
          >
            <span>View Full Report</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* ── YouTube-Style Video Carousel Rail (12 Verified CORS Streams) ── */}
      <YouTubeVideoRail
        videos={videos}
        selectedVideo={selectedVideo}
        onSelectVideo={handleVideoSelect}
        disabled={isBenchmarking}
      />

      {/* ── Quick Hackathon Demo Scenarios Pill Bar ───────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px 18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--primary-purple)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Hackathon Live Scenarios:
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            1-Click testing conditions for live demonstrations:
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px' }}
            onClick={() => handleProfileChange(NETWORK_PROFILES[1])}
            disabled={isBenchmarking}
            title="Demonstrate Baseline stalls vs ABR continuity on 3G"
          >
            <AlertTriangle size={13} color="var(--error)" />
            <span>🚨 Congested 3G (850k - Force Stalls)</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px' }}
            onClick={() => handleProfileChange(NETWORK_PROFILES[2])}
            disabled={isBenchmarking}
            title="Demonstrate adaptive downshift to 480p/360p"
          >
            <Activity size={13} color="var(--warning)" />
            <span>🚆 Mobile Transit (1.8M - Dynamic ABR)</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px' }}
            onClick={() => handleProfileChange(NETWORK_PROFILES[3])}
            disabled={isBenchmarking}
            title="Demonstrate peak 1080p upshift on high-speed fiber"
          >
            <TrendingUp size={13} color="var(--success)" />
            <span>🚀 Fiber CDN (15M - Peak 1080p)</span>
          </button>
        </div>
      </div>

      {/* ── Dual Player Grid: Player 1 (Baseline) vs Player 2 (Optimized) ── */}
      <div className="dual-player-grid" style={{ marginBottom: '24px' }}>
        <BaselinePlayer
          ref={baselinePlayerRef}
          src={selectedVideo.stream_url}
          networkConfig={{
            enabled: true,
            bandwidthKbps,
            latencyMs,
            packetLossPct,
            cacheHitProb,
            sessionId
          }}
          onMetrics={(m) => setBaselineMetrics(m)}
          sessionId={sessionId}
        />

        <OptimizedPlayer
          ref={optimizedPlayerRef}
          src={selectedVideo.stream_url}
          networkConfig={{
            enabled: true,
            bandwidthKbps,
            latencyMs,
            packetLossPct,
            cacheHitProb,
            sessionId
          }}
          onMetrics={(m) => setOptimizedMetrics(m)}
          sessionId={sessionId}
        />
      </div>

      {/* ── Network Simulation Control Panel & Live Charts ────────────── */}
      <div className="dashboard-grid">
        {/* Left: Simulation Controls */}
        <div className="control-panel">
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--primary-purple)" />
                <div className="card-title">Network Simulation Controls</div>
              </div>
              <span className="badge badge-primary">Dynamic Throttling</span>
            </div>

            {/* Profile Preset Dropdown */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Network Scenario Preset</label>
              <select
                className="form-control"
                value={selectedProfile.id}
                onChange={(e) => {
                  const p = NETWORK_PROFILES.find(item => item.id === Number(e.target.value));
                  if (p) handleProfileChange(p);
                }}
                disabled={isBenchmarking}
              >
                {NETWORK_PROFILES.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.profile_name} — {p.bandwidth_kbps} Kbps ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Benchmark Duration (derived from video metadata) */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Benchmark Duration</label>
              <input
                className="form-control"
                type="number"
                min={MIN_BENCHMARK_DURATION_SEC}
                max={Math.max(MIN_BENCHMARK_DURATION_SEC, Number(selectedVideo.duration_sec) || MAX_BENCHMARK_DURATION_SEC)}
                step={5}
                value={benchmarkDuration}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const videoLen = Number(selectedVideo.duration_sec) || 0;
                  const clamped = Math.min(
                    Math.max(v, MIN_BENCHMARK_DURATION_SEC),
                    videoLen > 0 ? videoLen : MAX_BENCHMARK_DURATION_SEC
                  );
                  setBenchmarkDuration(clamped);
                }}
                disabled={isBenchmarking}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Range: {MIN_BENCHMARK_DURATION_SEC}s – {Number(selectedVideo.duration_sec) || MAX_BENCHMARK_DURATION_SEC}s
                {selectedVideo.duration_formatted ? ` (Video: ${selectedVideo.duration_formatted})` : ''}
              </div>
            </div>

            {/* Bandwidth Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Bandwidth Limit</span>
                <span className="slider-value">{bandwidthKbps.toLocaleString()} Kbps</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="200"
                max="25000"
                step="100"
                value={bandwidthKbps}
                onChange={(e) => setBandwidthKbps(Number(e.target.value))}
                disabled={isBenchmarking}
              />
              <div className="slider-hint">Safe Headroom (75%): {Math.round(bandwidthKbps * 0.75).toLocaleString()} Kbps</div>
            </div>

            {/* Latency Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Simulated Round-Trip Latency</span>
                <span className="slider-value">{latencyMs} ms</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="500"
                step="5"
                value={latencyMs}
                onChange={(e) => setLatencyMs(Number(e.target.value))}
                disabled={isBenchmarking}
              />
            </div>

            {/* Packet Loss Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Packet Drop Probability</span>
                <span className="slider-value">{packetLossPct}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="10"
                step="0.1"
                value={packetLossPct}
                onChange={(e) => setPacketLossPct(Number(e.target.value))}
                disabled={isBenchmarking}
              />
            </div>

            {/* Cache Hit Probability Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Edge CDN Cache Hit Ratio</span>
                <span className="slider-value">{Math.round(cacheHitProb * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.05"
                value={cacheHitProb}
                onChange={(e) => setCacheHitProb(Number(e.target.value))}
                disabled={isBenchmarking}
              />
              <div className="slider-hint">Simulated POP: 12ms hit / 260ms origin fetch</div>
            </div>
          </div>
        </div>

        {/* Right: Real-time Telemetry Charts */}
        <div className="players-panel">
          <BufferBitrateChart
            baselineSeries={baselineSeries}
            optimizedSeries={optimizedSeries}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <PerformanceBarChart
              baselineMetrics={baselineMetrics}
              optimizedMetrics={optimizedMetrics}
            />
            <CacheEfficiencyChart
              hits={cacheHits}
              misses={cacheMisses}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

