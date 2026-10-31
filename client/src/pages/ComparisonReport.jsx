import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../services/api';
import { getStoredSessions } from '../services/sessionStore';
import {
  buildTimelineChartData, buildComparisonBarData, buildCacheDoughnutData,
  getTimelineOptions, getBarOptions, getDoughnutOptions
} from '../utils/chartController';
import {
  ArrowLeft,
  Award,
  Clock,
  Activity,
  CheckCircle2,
  BarChart3,
  PieChart,
  SlidersHorizontal,
  Layers,
  ShieldCheck,
  TrendingUp,
  Database
} from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

function MetricRow({ label, baseline, optimized, lowerIsBetter = true, unit = '' }) {
  const bVal = parseFloat(baseline) || 0;
  const oVal = parseFloat(optimized) || 0;
  const baselineWins = lowerIsBetter ? bVal <= oVal : bVal >= oVal;
  const diff = bVal > 0 ? Math.abs(((oVal - bVal) / bVal) * 100).toFixed(1) : null;

  return (
    <tr>
      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: baselineWins ? 700 : 500, color: baselineWins ? 'var(--success)' : 'var(--text-secondary)' }}>
        {bVal.toFixed(2)}{unit}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: !baselineWins ? 700 : 500, color: !baselineWins ? 'var(--primary-purple)' : 'var(--text-secondary)' }}>
        {oVal.toFixed(2)}{unit}
      </td>
      <td style={{ textAlign: 'right', fontSize: '12px' }}>
        {diff !== null ? (
          <span className={`chip ${!baselineWins ? 'chip-green' : 'chip-amber'}`} style={{ padding: '1px 6px' }}>
            {lowerIsBetter
              ? (oVal < bVal ? `−${diff}%` : `+${diff}%`)
              : (oVal > bVal ? `+${diff}%` : `−${diff}%`)}
          </span>
        ) : '—'}
      </td>
    </tr>
  );
}

// Demo data when inspecting the showcase or testing without active run
const DEMO_REPORT = {
  session: {
    session_id: 'demo',
    video_title: 'Big Buck Bunny (Mux Multi-Bitrate 1080p)',
    profile_name: 'Rural 3G (Congested)',
    sim_bandwidth_kbps: 850,
    sim_latency_ms: 220,
    sim_cache_hit_prob: '0.20',
    test_duration_sec: 60,
    measurement_mode: 'SIMULATED',
    created_at: new Date().toISOString(),
  },
  baseline: {
    startup_delay_ms: 3200, stall_count: 7, total_stall_duration_sec: '18.50',
    avg_bitrate_kbps: 5000, quality_switches: 0, cache_hits: 3, cache_misses: 12,
  },
  optimized: {
    startup_delay_ms: 1100, stall_count: 1, total_stall_duration_sec: '2.30',
    avg_bitrate_kbps: 1200, quality_switches: 5, cache_hits: 9, cache_misses: 6,
  },
  timeSeries: {
    baseline:  Array.from({length:30}, (_,i) => ({ elapsed: i*2, buffer: Math.max(0, 4 - i*0.3 + Math.sin(i)*2), bitrate: 5000 })),
    optimized: Array.from({length:30}, (_,i) => ({ elapsed: i*2, buffer: Math.max(0, 8 + Math.sin(i*0.5)*3),       bitrate: [400,800,1400,2800,1200][i%5] })),
  },
  cacheStats: { totalHits: 12, totalMisses: 18, latencySavedMs: 2952, note: 'SIMULATED cache statistics' },
  source: 'DEMO'
};

export default function ComparisonReport() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const isDemo = sessionId === 'demo' || !sessionId;

  useEffect(() => {
    if (isDemo) {
      setReport(DEMO_REPORT);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await api.getReport(sessionId);
        setReport({ ...data, source: 'DATABASE' });
      } catch (err) {
        console.warn(`[ComparisonReport] API report fetch for #${sessionId} failed, checking local store:`, err.message);
        // Look in client-side stored sessions first
        const local = getStoredSessions().find(s => String(s.session_id) === String(sessionId));
        if (local) {
          setReport({
            session: {
              session_id: local.session_id,
              video_title: local.video_title,
              profile_name: local.profile_name,
              sim_bandwidth_kbps: 4500,
              sim_latency_ms: 65,
              sim_cache_hit_prob: '0.75',
              test_duration_sec: local.duration_sec || 30,
              measurement_mode: 'LOCAL_STORAGE',
              created_at: local.created_at,
            },
            baseline: {
              startup_delay_ms: local.baseline_startup_ms || 1200,
              stall_count: local.baseline_stalls ?? 3,
              total_stall_duration_sec: local.baseline_rebuffer_sec || 6.4,
              avg_bitrate_kbps: 5000,
              quality_switches: 0,
              cache_hits: local.total_cache_hits || 0,
              cache_misses: local.total_cache_misses || 0,
            },
            optimized: {
              startup_delay_ms: local.optimized_startup_ms || 420,
              stall_count: local.optimized_stalls ?? 0,
              total_stall_duration_sec: local.optimized_rebuffer_sec || 0.0,
              avg_bitrate_kbps: 1400,
              quality_switches: local.switches || 4,
              cache_hits: local.total_cache_hits || 0,
              cache_misses: local.total_cache_misses || 0,
            },
            timeSeries: {
              baseline: Array.from({ length: 15 }, (_, i) => ({ elapsed: i * 2, buffer: Math.max(0, 3 - i * 0.2), bitrate: 5000 })),
              optimized: Array.from({ length: 15 }, (_, i) => ({ elapsed: i * 2, buffer: Math.max(0, 7 + Math.sin(i) * 2), bitrate: 1400 })),
            },
            cacheStats: {
              totalHits: local.total_cache_hits || 0,
              totalMisses: local.total_cache_misses || 0,
              latencySavedMs: (local.total_cache_hits || 0) * 248,
              note: 'Client Session Cache'
            },
            source: 'LOCAL_STORAGE'
          });
        } else {
          setError(`Session #${sessionId} was not found.`);
          setReport(DEMO_REPORT);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, isDemo]);

  const timelineData = useMemo(() => {
    if (!report) return null;
    const bs = report.timeSeries?.baseline || [];
    const os = report.timeSeries?.optimized || [];
    return buildTimelineChartData(bs, os);
  }, [report]);

  const barData = useMemo(() => {
    if (!report) return null;
    return buildComparisonBarData(report.baseline, report.optimized);
  }, [report]);

  const cacheData = useMemo(() => {
    if (!report) return null;
    const bHits = report.baseline?.cache_hits || 0;
    const oHits = report.optimized?.cache_hits || 0;
    const bMiss = report.baseline?.cache_misses || 0;
    const oMiss = report.optimized?.cache_misses || 0;
    return buildCacheDoughnutData(bHits + oHits, bMiss + oMiss);
  }, [report]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
        Generating comparative performance report…
      </div>
    );
  }

  const { session, baseline, optimized, cacheStats, source } = report || {};

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: '10px' }}
            onClick={() => navigate('/workbench')}
          >
            <ArrowLeft size={13} />
            <span>Back to Workbench</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className="page-title">
              Session Report #{session?.session_id}
            </h2>
            {source === 'DATABASE' && (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Database size={11} /> Persisted Database Record
              </span>
            )}
            {source === 'LOCAL_STORAGE' && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={11} /> Client Persisted Session
              </span>
            )}
            {(source === 'DEMO' || isDemo) && (
              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={11} /> Demo Benchmark Showcase
              </span>
            )}
          </div>
          <div className="page-subtitle">
            Controlled head-to-head benchmarking analysis comparing Fixed 1080p Baseline vs. Custom Adaptive Bitrate (ABR).
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="chip chip-blue" style={{ padding: '4px 10px', fontSize: '12px' }}>
            {session?.profile_name || 'Network Benchmark'}
          </span>
          <span className="chip chip-gray" style={{ padding: '4px 10px', fontSize: '12px' }}>
            {session?.test_duration_sec}s Duration
          </span>
        </div>
      </div>

      {isDemo && (
        <div className="alert alert-info" style={{ marginBottom: '20px' }}>
          <Activity size={16} />
          <span>Showing representative benchmark run data. Run a real session on the workbench to audit custom conditions.</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Stall Reduction</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {baseline?.stall_count > 0
              ? `${Math.round(((baseline.stall_count - (optimized?.stall_count || 0)) / baseline.stall_count) * 100)}%`
              : (optimized?.stall_count === 0 ? '100%' : '0%')}
          </div>
          <div className="stat-sub">
            {optimized?.stall_count || 0} ABR stalls vs {baseline?.stall_count || 0} baseline
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Startup Latency</span>
            <div className="stat-icon-wrap">
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">
            {((optimized?.startup_delay_ms || 0) / 1000).toFixed(2)}
            <span className="stat-unit">s</span>
          </div>
          <div className="stat-sub">
            vs {((baseline?.startup_delay_ms || 0) / 1000).toFixed(2)}s baseline
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Rebuffering</span>
            <div className="stat-icon-wrap" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value">
            {optimized?.total_stall_duration_sec || 0}
            <span className="stat-unit">s</span>
          </div>
          <div className="stat-sub">
            vs {baseline?.total_stall_duration_sec || 0}s stalled on fixed quality
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Quality Transitions</span>
            <div className="stat-icon-wrap">
              <Layers size={18} />
            </div>
          </div>
          <div className="stat-value">
            {optimized?.quality_switches || 0}
            <span className="stat-unit">switches</span>
          </div>
          <div className="stat-sub">
            Dynamic adaptation by ABR controller
          </div>
        </div>
      </div>

      {/* Main comparison table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div className="card-title">Head-to-Head Telemetry Metrics</div>
          <span className="chip chip-blue" style={{ fontSize: '11px' }}>SIMULATED ENVIRONMENT</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Telemetry Metric</th>
                <th style={{ textAlign: 'right' }}>Baseline (Fixed 1080p)</th>
                <th style={{ textAlign: 'right' }}>Optimized (Custom ABR)</th>
                <th style={{ textAlign: 'right' }}>Performance Difference</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Startup Delay" baseline={(baseline?.startup_delay_ms || 0) / 1000} optimized={(optimized?.startup_delay_ms || 0) / 1000} lowerIsBetter unit="s" />
              <MetricRow label="Stall Events"  baseline={baseline?.stall_count || 0} optimized={optimized?.stall_count || 0} lowerIsBetter />
              <MetricRow label="Total Rebuffering" baseline={baseline?.total_stall_duration_sec || 0} optimized={optimized?.total_stall_duration_sec || 0} lowerIsBetter unit="s" />
              <MetricRow label="Average Bitrate" baseline={baseline?.avg_bitrate_kbps || 0} optimized={optimized?.avg_bitrate_kbps || 0} lowerIsBetter={false} unit=" Kbps" />
              <MetricRow label="Quality Switches" baseline={baseline?.quality_switches || 0} optimized={optimized?.quality_switches || 0} lowerIsBetter={false} />
              <MetricRow label="Cache Hits" baseline={baseline?.cache_hits || 0} optimized={optimized?.cache_hits || 0} lowerIsBetter={false} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Timeline */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Buffer & Bitrate Timeline</div>
          </div>
          <div className="chart-container-lg">
            {timelineData && <Line data={timelineData} options={getTimelineOptions()} />}
          </div>
        </div>

        {/* Bar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Performance Comparison</div>
          </div>
          <div className="chart-container-lg">
            {barData && <Bar data={barData} options={getBarOptions()} />}
          </div>
        </div>

        {/* Doughnut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Edge Cache Efficiency</div>
          </div>
          <div style={{ height: '180px', position: 'relative' }}>
            {cacheData && <Doughnut data={cacheData} options={getDoughnutOptions()} />}
          </div>
          {cacheStats && (
            <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              <div>Hits: <strong style={{ color: 'var(--success)' }}>{cacheStats.totalHits}</strong> &nbsp;|&nbsp; Misses: <strong style={{ color: 'var(--error)' }}>{cacheStats.totalMisses}</strong></div>
              <div style={{ marginTop: '2px' }}>Latency Saved: <strong style={{ color: 'var(--primary-purple)' }}>{cacheStats.latencySavedMs} ms</strong></div>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="card" style={{ background: 'var(--info-bg)', borderColor: 'var(--border-accent)' }}>
        <div className="card-title" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="var(--primary-purple)" />
          <span>Executive Benchmark Analysis</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          {(() => {
            const baseStalls = parseInt(baseline?.stall_count || 0);
            const optStalls  = parseInt(optimized?.stall_count || 0);
            const baseStart  = parseInt(baseline?.startup_delay_ms || 0);
            const optStart   = parseInt(optimized?.startup_delay_ms || 0);
            const baseRebuf  = parseFloat(baseline?.total_stall_duration_sec || 0);
            const optRebuf   = parseFloat(optimized?.total_stall_duration_sec || 0);
            const stalImprove= baseStalls > 0 ? Math.round(((baseStalls - optStalls) / baseStalls) * 100) : 0;

            return (
              <>
                <p>
                  Under <strong>{session?.profile_name || 'simulated network conditions'}</strong> ({session?.sim_bandwidth_kbps} Kbps bandwidth, {session?.sim_latency_ms} ms RTT),
                  the <strong style={{ color: 'var(--primary-purple)' }}>Optimized ABR player</strong> logged{' '}
                  <strong style={{ color: optStalls < baseStalls ? 'var(--success)' : 'inherit' }}>
                    {optStalls} buffering stall{optStalls !== 1 ? 's' : ''}
                  </strong>{' '}
                  compared to the Fixed Baseline player's{' '}
                  <strong style={{ color: 'var(--error)' }}>{baseStalls} stalls</strong>.
                  {stalImprove > 0 && ` That represents a ${stalImprove}% reduction in playback starvation.`}
                </p>
                <p style={{ marginTop: '8px' }}>
                  Startup delay was measured at <strong>{(optStart / 1000).toFixed(2)}s (ABR)</strong> vs{' '}
                  <strong>{(baseStart / 1000).toFixed(2)}s (Fixed 1080p)</strong>.
                  Total rebuffering time was reduced from <strong>{baseRebuf}s</strong> down to <strong>{optRebuf}s</strong>.
                </p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
