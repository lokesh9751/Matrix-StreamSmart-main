import React, { useState, useEffect } from 'react';
import BufferBitrateChart from '../components/charts/BufferBitrateChart';
import PerformanceBarChart from '../components/charts/PerformanceBarChart';
import CacheEfficiencyChart from '../components/charts/CacheEfficiencyChart';
import {
  BarChart3,
  TrendingUp,
  Activity,
  HardDrive,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { getStoredSessions } from '../services/sessionStore';

export default function Analytics() {
  const [sessions, setSessions] = useState(() => getStoredSessions());
  const [selectedSession, setSelectedSession] = useState(sessions[0] || null);

  useEffect(() => {
    const handleSessionSaved = () => {
      const updated = getStoredSessions();
      setSessions(updated);
      if (!selectedSession && updated.length > 0) {
        setSelectedSession(updated[0]);
      }
    };
    window.addEventListener('streamsmart:session_saved', handleSessionSaved);
    return () => window.removeEventListener('streamsmart:session_saved', handleSessionSaved);
  }, [selectedSession]);

  // Synthetic or recorded chart data derived from selected session
  const defaultBaselineSeries = [
    { timestamp: '0s',  bufferSec: 1.0, bitrateKbps: 5000 },
    { timestamp: '5s',  bufferSec: 3.2, bitrateKbps: 5000 },
    { timestamp: '10s', bufferSec: 2.1, bitrateKbps: 5000 },
    { timestamp: '15s', bufferSec: 0.8, bitrateKbps: 5000 },
    { timestamp: '20s', bufferSec: 0.0, bitrateKbps: 5000 },
    { timestamp: '25s', bufferSec: 1.4, bitrateKbps: 5000 },
    { timestamp: '30s', bufferSec: 2.2, bitrateKbps: 5000 },
  ];

  const defaultOptimizedSeries = [
    { timestamp: '0s',  bufferSec: 2.5, bitrateKbps: 800  },
    { timestamp: '5s',  bufferSec: 6.8, bitrateKbps: 1400 },
    { timestamp: '10s', bufferSec: 10.4,bitrateKbps: 2800 },
    { timestamp: '15s', bufferSec: 12.1,bitrateKbps: 2800 },
    { timestamp: '20s', bufferSec: 11.5,bitrateKbps: 2800 },
    { timestamp: '25s', bufferSec: 13.0,bitrateKbps: 2800 },
    { timestamp: '30s', bufferSec: 14.2,bitrateKbps: 5000 },
  ];

  const baselineSeries = (selectedSession?.baselineSeries && selectedSession.baselineSeries.length > 0)
    ? selectedSession.baselineSeries
    : defaultBaselineSeries;

  const optimizedSeries = (selectedSession?.optimizedSeries && selectedSession.optimizedSeries.length > 0)
    ? selectedSession.optimizedSeries
    : defaultOptimizedSeries;


  const baselineMetrics = {
    startupDelayMs: selectedSession?.baseline_startup_ms || 1240,
    stallCount: selectedSession?.baseline_stalls ?? 3,
    totalStallDurationSec: selectedSession?.baseline_rebuffer_sec || 8.4,
    currentBufferSec: 2.2,
    currentBitrateKbps: 5000,
    currentResolution: selectedSession?.baseline_resolution || '1080p'
  };

  const optimizedMetrics = {
    startupDelayMs: selectedSession?.optimized_startup_ms || 380,
    stallCount: selectedSession?.optimized_stalls ?? 0,
    totalStallDurationSec: selectedSession?.optimized_rebuffer_sec || 0.0,
    currentBufferSec: 14.2,
    currentBitrateKbps: 2800,
    currentResolution: selectedSession?.optimized_resolution || '720p'
  };

  const stallsAvoided = Math.max(0, baselineMetrics.stallCount - optimizedMetrics.stallCount);
  const rebufferSaved = Math.max(0, baselineMetrics.totalStallDurationSec - optimizedMetrics.totalStallDurationSec);

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="page-title">Performance Analytics & QoS Telemetry</h2>
            <div className="page-subtitle">
              Comparative visualization of buffer occupancy, bitrate scaling, startup latency, and edge cache efficiency
            </div>
          </div>

          {/* Session Selector */}
          {sessions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selected Run:</span>
              <select
                className="form-control"
                style={{ fontSize: '12px', padding: '4px 8px', height: '34px', maxWidth: '300px' }}
                value={selectedSession?.session_id || ''}
                onChange={(e) => {
                  const s = sessions.find(item => item.session_id === e.target.value);
                  if (s) setSelectedSession(s);
                }}
              >
                {sessions.map(s => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.session_id} — {s.video_title} ({s.profile_name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Top Executive KPI Highlights ────────────────────────────── */}
      <div className="overview-metric-grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Stalls Eliminated</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stallsAvoided}
            <span className="stat-unit">avoided</span>
          </div>
          <div className="stat-sub">
            {baselineMetrics.stallCount} baseline stalls vs {optimizedMetrics.stallCount} optimized
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Rebuffer Time Preserved</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--info-bg)', color: 'var(--primary-purple)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--primary-purple)' }}>
            {rebufferSaved.toFixed(1)}
            <span className="stat-unit">sec saved</span>
          </div>
          <div className="stat-sub">
            {rebufferSaved > 0 ? `${Math.round((rebufferSaved / Math.max(0.1, baselineMetrics.totalStallDurationSec)) * 100)}% rebuffer reduction` : 'Zero rebuffer required'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Startup Speedup</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--info-bg)', color: 'var(--primary-purple)' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="stat-value">
            {baselineMetrics.startupDelayMs > 0 && optimizedMetrics.startupDelayMs > 0
              ? `${(baselineMetrics.startupDelayMs / optimizedMetrics.startupDelayMs).toFixed(1)}x`
              : '3.2x'}
            <span className="stat-unit">faster</span>
          </div>
          <div className="stat-sub">
            {optimizedMetrics.startupDelayMs}ms optimized vs {baselineMetrics.startupDelayMs}ms baseline
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Cache Hit Ratio</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <HardDrive size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {selectedSession?.cache_hit_rate || 68.5}%
          </div>
          <div className="stat-sub">
            {selectedSession?.total_cache_hits || 48} POP hits / {selectedSession?.total_cache_misses || 22} origin fetches
          </div>
        </div>
      </div>

      {/* ── Buffer & Bitrate Timeline Chart (Primary Chart) ──────────── */}
      <div style={{ marginBottom: '24px' }}>
        <BufferBitrateChart
          baselineSeries={baselineSeries}
          optimizedSeries={optimizedSeries}
        />
      </div>

      {/* ── Side-by-Side Charts (Comparison Bar & Cache Doughnut) ─────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <PerformanceBarChart
          baselineMetrics={baselineMetrics}
          optimizedMetrics={optimizedMetrics}
        />
        <CacheEfficiencyChart
          hits={selectedSession?.total_cache_hits || 48}
          misses={selectedSession?.total_cache_misses || 22}
        />
      </div>

      {/* ── Head-to-Head Telemetry Audit Table ───────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--primary-purple)" />
            <div className="card-title-lg">Comparative Performance Scorecard</div>
          </div>
          <span className="badge badge-primary">Session: {selectedSession?.session_id || 'Active'}</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Performance Dimension</th>
              <th>Player 1: Baseline (Locked 1080p)</th>
              <th>Player 2: Optimized (Custom ABR)</th>
              <th>Optimization Outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="td-primary">Startup Latency (TTFF)</td>
              <td className="td-mono">{baselineMetrics.startupDelayMs} ms</td>
              <td className="td-mono text-green">{optimizedMetrics.startupDelayMs} ms</td>
              <td>
                <span className="chip chip-green">
                  {baselineMetrics.startupDelayMs - optimizedMetrics.startupDelayMs} ms faster
                </span>
              </td>
            </tr>
            <tr>
              <td className="td-primary">Starvation Stalls</td>
              <td className="td-mono text-red">{baselineMetrics.stallCount} stalls</td>
              <td className="td-mono text-green">{optimizedMetrics.stallCount} stalls</td>
              <td>
                <span className="chip chip-green">{stallsAvoided} stalls eliminated</span>
              </td>
            </tr>
            <tr>
              <td className="td-primary">Rebuffering Duration</td>
              <td className="td-mono text-red">{baselineMetrics.totalStallDurationSec.toFixed(1)} s</td>
              <td className="td-mono text-green">{optimizedMetrics.totalStallDurationSec.toFixed(1)} s</td>
              <td>
                <span className="chip chip-green">{rebufferSaved.toFixed(1)} s preserved</span>
              </td>
            </tr>
            <tr>
              <td className="td-primary">Streaming Strategy</td>
              <td>Fixed High-Tier (1080p Locked)</td>
              <td>Buffer-Driven Heuristic (Dynamic)</td>
              <td>
                <span className="chip chip-blue">Continuity Prioritized</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

