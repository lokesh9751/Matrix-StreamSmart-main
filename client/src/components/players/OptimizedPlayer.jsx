import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { createOptimizedPlayer } from '../../utils/dualPlayer';
import YouTubeQualitySelector from './YouTubeQualitySelector';
import {
  AlertTriangle,
  TrendingUp,
  Scale,
  Sliders,
  ArrowRight,
  Clock,
  Activity,
  ShieldAlert
} from 'lucide-react';

const OptimizedPlayer = forwardRef(function OptimizedPlayer(
  { src, networkConfig, onMetrics, sessionId },
  ref
) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [levels, setLevels] = useState([]);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(-1);

  // Core playback metrics
  const [metrics, setMetrics] = useState({
    currentResolution: '--',
    currentBitrateKbps: 0,
    currentBufferSec: 0,
    startupDelayMs: 0,
    stallCount: 0,
    totalStallDurationSec: 0,
    qualitySwitches: 0,
    isStarted: false,
    currentlyStalled: false,
  });

  // ABR Live Diagnostics State
  const [abrState, setAbrState] = useState({
    decision: 'STEADY_STATE_HOLD',
    reasonDetail: 'ABR initialized — monitoring buffer and bandwidth…',
    bufferSec: 0,
    availableBandwidthKbps: networkConfig?.bandwidthKbps || 4500,
    safeBandwidthKbps: Math.round((networkConfig?.bandwidthKbps || 4500) * 0.75),
    estimatedBandwidthKbps: 0,
    simulatedBandwidthKbps: networkConfig?.bandwidthKbps || 4500,
    isAuto: true,
  });

  // Quality switch history log (up to 15 items)
  const [switchHistory, setSwitchHistory] = useState([]);
  const [lastSwitchTime, setLastSwitchTime] = useState(null);

  // Track actual HLS.js current level for display sync
  const actualLevelRef = useRef(-1);
  const hlsRef = useRef(null);

  // Get actual playback level from HLS.js (used for UI sync in Auto mode)
  const getActualPlaybackLevel = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls || !hls.levels || hls.levels.length === 0) return -1;
    return hls.currentLevel >= 0 ? hls.currentLevel : (hls.nextLevel >= 0 ? hls.nextLevel : 0);
  }, []);

  // Expose imperative API for synchronized bench controls
  useImperativeHandle(ref, () => ({
    getTracker: () => playerRef.current?.getTracker(),
    destroy: () => playerRef.current?.destroy(),
    setQuality: (idx) => handleSelectQuality(idx),
    updateNetworkConfig: (cfg) => playerRef.current?.updateNetworkConfig(cfg),
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    seek: (time) => playerRef.current?.seek(time),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getVideo: () => videoRef.current,
    getHls: () => playerRef.current?.getHls(),
  }));

  const handleSelectQuality = (levelIndex) => {
    if (levelIndex === -1) {
      setIsAutoMode(true);
      setSelectedLevelIndex(-1);
    } else {
      setIsAutoMode(false);
      setSelectedLevelIndex(levelIndex);
    }
    if (playerRef.current?.setQuality) {
      playerRef.current.setQuality(levelIndex);
    }
  };

  // Re-apply live network throttling when networkConfig updates
  useEffect(() => {
    if (playerRef.current?.updateNetworkConfig && networkConfig) {
      playerRef.current.updateNetworkConfig(networkConfig);
    }
  }, [networkConfig]);

  // Sync UI with actual HLS.js level (especially in Auto mode)
  useEffect(() => {
    const hls = playerRef.current?.getHls();
    if (!hls) return;
    hlsRef.current = hls;

    // Poll actual level for UI sync (in Auto mode)
    const interval = setInterval(() => {
      if (!isAutoMode) return;
      const actual = getActualPlaybackLevel();
      if (actual >= 0 && actual !== actualLevelRef.current) {
        actualLevelRef.current = actual;
        // Update metrics resolution/bitrate from actual level
        if (hls.levels && hls.levels[actual]) {
          const lvl = hls.levels[actual];
          setMetrics(prev => ({
            ...prev,
            currentResolution: lvl.height ? `${lvl.height}p` : `L${actual}`,
            currentBitrateKbps: Math.round((lvl.bitrate || lvl.averageBitrate || 0) / 1000),
          }));
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isAutoMode, getActualPlaybackLevel]);

  useEffect(() => {
    if (!src || !videoRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setStatus('loading');
    setMetrics(m => ({ ...m, isStarted: false }));

    try {
      playerRef.current = createOptimizedPlayer({
        videoEl: videoRef.current,
        src,
        networkConfig: { ...networkConfig, sessionId },
        onMetrics: (m) => {
          setMetrics(m);
          setStatus(m.currentlyStalled ? 'stalled' : m.isStarted ? 'playing' : 'loading');
          onMetrics && onMetrics(m);
        },
        onLevels: (lvls) => {
          setLevels(lvls || []);
        },
        onABRStateChange: (state) => {
          setAbrState(state);
        },
        onQualitySwitch: (switchItem) => {
          setSwitchHistory(prev => [switchItem, ...prev.slice(0, 14)]);
          setLastSwitchTime(switchItem.timestamp);
          // Update actual level ref on switch
          const hls = hlsRef.current;
          if (hls && hls.levels && hls.levels.length > 0) {
            actualLevelRef.current = hls.currentLevel >= 0 ? hls.currentLevel : (hls.nextLevel >= 0 ? hls.nextLevel : 0);
          }
        },
        onError: (err) => {
          setStatus('error');
          console.error('[OptimizedPlayer] Error:', err);
        },
      });
    } catch (err) {
      setStatus('error');
      console.error('[OptimizedPlayer] Init error:', err);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src]);

  const statusLabel = { idle: 'Idle', loading: 'Loading…', playing: 'Playing', stalled: 'Buffering', error: 'Error' }[status] || status;

  // Decision badge styling map with Lucide icons
  const renderDecisionBadge = () => {
    switch (abrState.decision) {
      case 'BUFFER_RISK_DOWNSHIFT':
        return (
          <span className="abr-status-pill abr-status-downshift">
            <AlertTriangle size={12} strokeWidth={2.5} />
            <span>BUFFER_RISK_DOWNSHIFT</span>
          </span>
        );
      case 'BANDWIDTH_LIMIT':
        return (
          <span className="abr-status-pill abr-status-downshift" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' }}>
            <ShieldAlert size={12} strokeWidth={2.5} />
            <span>BANDWIDTH_LIMIT</span>
          </span>
        );
      case 'STABLE_BANDWIDTH_UPSHIFT':
        return (
          <span className="abr-status-pill abr-status-upshift">
            <TrendingUp size={12} strokeWidth={2.5} />
            <span>STABLE_BANDWIDTH_UPSHIFT</span>
          </span>
        );
      case 'MANUAL_OVERRIDE':
        return (
          <span className="abr-status-pill abr-status-manual">
            <Sliders size={12} strokeWidth={2.5} />
            <span>MANUAL_OVERRIDE</span>
          </span>
        );
      case 'STEADY_STATE_HOLD':
      default:
        return (
          <span className="abr-status-pill abr-status-hold">
            <Scale size={12} strokeWidth={2.5} />
            <span>STEADY_STATE_HOLD</span>
          </span>
        );
    }
  };

  return (
    <div className="player-card optimized">
      <div className="player-header">
        <div className="player-title">
          <span className="player-badge optimized">OPTIMIZED</span>
          <span>Adaptive Bitrate (ABR) Player</span>
        </div>

        {/* YouTube-style Quality Selector */}
        <YouTubeQualitySelector
          levels={levels}
          currentLevelIndex={isAutoMode ? actualLevelRef.current : selectedLevelIndex}
          activeResolution={metrics.currentResolution}
          isAuto={isAutoMode}
          allowAuto={true}
          onSelectQuality={handleSelectQuality}
          playerType="OPTIMIZED"
        />
      </div>

      <div className="player-video-wrap">
        <video
          ref={videoRef}
          controls
          playsInline
          muted
          style={{ width: '100%', height: '100%' }}
        />

        <div className="player-overlay">
          <span className="player-overlay-badge">{metrics.currentResolution}</span>
          {metrics.currentBitrateKbps > 0 && (
            <span className="player-overlay-badge">{metrics.currentBitrateKbps} Kbps</span>
          )}
          {metrics.qualitySwitches > 0 && (
            <span className="player-overlay-badge" style={{ color: '#60A5FA' }}>
              ↕ {metrics.qualitySwitches}
            </span>
          )}
        </div>

        <div className="player-status-indicator">
          <span className={`status-dot ${status}`} />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* ── Live Custom ABR Diagnostics Banner ───────────────────────── */}
      <div className="abr-decision-container">
        <div className="abr-decision-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
              ABR Decision:
            </span>
            {renderDecisionBadge()}
          </div>

          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={13} color="var(--primary-purple)" />
            <span>{metrics.qualitySwitches} {metrics.qualitySwitches === 1 ? 'switch' : 'switches'}</span>
            {lastSwitchTime && <span style={{ color: 'var(--text-muted)' }}>({lastSwitchTime})</span>}
          </div>
        </div>

        <div className="abr-reason-text">
          {abrState.reasonDetail}
        </div>

        {/* Bandwidth & Buffer telemetry metrics */}
        <div className="abr-bandwidth-grid">
          <div className="abr-bw-cell">
            <span className="abr-bw-label">Available BW</span>
            <span className="abr-bw-val" style={{ color: 'var(--primary-purple)' }}>
              {abrState.availableBandwidthKbps} <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Kbps</span>
            </span>
          </div>
          <div className="abr-bw-cell">
            <span className="abr-bw-label">Safe BW (75%)</span>
            <span className="abr-bw-val" style={{ color: 'var(--success)' }}>
              {abrState.safeBandwidthKbps} <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Kbps</span>
            </span>
          </div>
          <div className="abr-bw-cell">
            <span className="abr-bw-label">Buffer Ahead</span>
            <span className="abr-bw-val" style={{
              color: abrState.bufferSec < 3.5 ? 'var(--error)' : abrState.bufferSec > 10 ? 'var(--success)' : 'var(--primary-purple)'
            }}>
              {abrState.bufferSec.toFixed(1)} <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>s</span>
            </span>
          </div>
          <div className="abr-bw-cell">
            <span className="abr-bw-label">HLS Estimate</span>
            <span className="abr-bw-val" style={{ color: 'var(--text-secondary)' }}>
              {abrState.estimatedBandwidthKbps > 0 ? `${abrState.estimatedBandwidthKbps}` : '--'} <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Kbps</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Standard 6-Cell Metrics Grid ─────────────────────────────── */}
      <div className="player-metrics-grid">
        <div className="player-metric-cell">
          <div className="player-metric-value">{metrics.currentResolution}</div>
          <div className="player-metric-label">Resolution</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.currentBitrateKbps > 0 ? `${metrics.currentBitrateKbps}` : '--'}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> Kbps</span>
          </div>
          <div className="player-metric-label">Bitrate</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.currentBufferSec.toFixed(1)}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> s</span>
          </div>
          <div className="player-metric-label">Buffer</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{ color: 'var(--primary-purple)' }}>
            {metrics.qualitySwitches}
          </div>
          <div className="player-metric-label">Quality Switches</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.startupDelayMs > 0 ? (metrics.startupDelayMs / 1000).toFixed(2) : '--'}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> s</span>
          </div>
          <div className="player-metric-label">Startup Delay</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{ color: metrics.stallCount > 0 ? 'var(--warning)' : 'inherit' }}>
            {metrics.stallCount}
          </div>
          <div className="player-metric-label">Stalls</div>
        </div>
      </div>

      {/* ── Quality Switch History Log ────────────────────────────────── */}
      {switchHistory.length > 0 && (
        <div className="abr-history-card">
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Quality Switch History ({switchHistory.length})</span>
            <span style={{ color: 'var(--primary-purple)', fontSize: '10.5px' }}>Live Transition Feed</span>
          </div>
          <div>
            {switchHistory.map((item) => (
              <div key={item.id} className="abr-history-item">
                <div>
                  <div className="abr-switch-levels">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.fromLevel}</span>
                    <ArrowRight size={12} color="var(--primary-purple)" />
                    <span style={{ color: 'var(--text-primary)' }}>{item.toLevel}</span>
                    <span className={`chip ${item.reason === 'BUFFER_RISK_DOWNSHIFT' || item.reason === 'BANDWIDTH_LIMIT' ? 'chip-red' : item.reason === 'STABLE_BANDWIDTH_UPSHIFT' ? 'chip-green' : 'chip-blue'}`} style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                      {item.reason === 'BUFFER_RISK_DOWNSHIFT' ? 'Downshift' : item.reason === 'BANDWIDTH_LIMIT' ? 'Bandwidth Drop' : item.reason === 'STABLE_BANDWIDTH_UPSHIFT' ? 'Upshift' : 'Hold'}
                    </span>
                  </div>
                  <div className="abr-switch-reason">
                    {item.reasonDetail}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '75px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> {item.timestamp}
                  </span>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Buf: {item.bufferSec}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default OptimizedPlayer;
