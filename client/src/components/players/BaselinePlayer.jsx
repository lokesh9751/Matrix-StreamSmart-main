import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { createBaselinePlayer } from '../../utils/dualPlayer';
import YouTubeQualitySelector from './YouTubeQualitySelector';
import { Lock } from 'lucide-react';

const BaselinePlayer = forwardRef(function BaselinePlayer(
  { src, fallbackMp4Url, networkConfig, onMetrics, sessionId },
  ref
) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [levels, setLevels] = useState([]);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(-1);
  const [metrics, setMetrics] = useState({
    currentResolution: '--',
    currentBitrateKbps: 0,
    currentBufferSec: 0,
    startupDelayMs: 0,
    stallCount: 0,
    totalStallDurationSec: 0,
    isStarted: false,
    currentlyStalled: false,
  });

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
  }));

  const handleSelectQuality = (levelIndex) => {
    setSelectedLevelIndex(levelIndex);
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

  useEffect(() => {
    if (!src || !videoRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setStatus('loading');
    setMetrics(m => ({ ...m, isStarted: false }));

    try {
      playerRef.current = createBaselinePlayer({
        videoEl: videoRef.current,
        src,
        fallbackMp4Url: fallbackMp4Url || (typeof src === 'object' ? src?.mp4Url : undefined),
        networkConfig: { ...networkConfig, sessionId },
        onMetrics: (m) => {
          setMetrics(m);
          setStatus(m.currentlyStalled ? 'stalled' : m.isStarted ? 'playing' : 'loading');
          onMetrics && onMetrics(m);
        },
        onLevels: (lvls) => {
          setLevels(lvls || []);
          if (lvls && lvls.length > 0) {
            setSelectedLevelIndex(lvls.length - 1);
          }
        },
        onError: (err) => {
          setStatus('error');
          console.error('[BaselinePlayer] Error:', err);
        },
      });
    } catch (err) {
      setStatus('error');
      console.error('[BaselinePlayer] Init error:', err);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src]);

  const statusLabel = { idle: 'Idle', loading: 'Loading…', playing: 'Playing', stalled: 'Buffering', error: 'Error' }[status] || status;

  return (
    <div className="player-card baseline">
      <div className="player-header">
        <div className="player-title">
          <span className="player-badge baseline">BASELINE</span>
          <span>Fixed-Quality Player</span>
        </div>

        {/* YouTube-style Quality Selector */}
        <YouTubeQualitySelector
          levels={levels}
          currentLevelIndex={selectedLevelIndex}
          activeResolution={metrics.currentResolution}
          isAuto={false}
          allowAuto={false}
          onSelectQuality={handleSelectQuality}
          playerType="BASELINE"
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
        </div>

        <div className="player-status-indicator">
          <span className={`status-dot ${status}`} />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* ── Fixed Quality Status Banner ─────────────────────────────── */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lock size={13} color="var(--text-secondary)" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>LOCKED RENDITION:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-purple)', fontWeight: 700 }}>
            {metrics.currentResolution !== '--' ? metrics.currentResolution : '1080p HD'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            (Auto-switching disabled)
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Target: {metrics.currentBitrateKbps > 0 ? `${metrics.currentBitrateKbps} Kbps` : 'Max Available (1080p)'}
        </div>
      </div>

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
          <div className="player-metric-value">
            {metrics.startupDelayMs > 0 ? (metrics.startupDelayMs / 1000).toFixed(2) : '--'}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> s</span>
          </div>
          <div className="player-metric-label">Startup Delay</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{ color: metrics.stallCount > 0 ? 'var(--error)' : 'inherit' }}>
            {metrics.stallCount}
          </div>
          <div className="player-metric-label">Stalls</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{ color: metrics.currentlyStalled ? 'var(--error)' : 'inherit' }}>
            {metrics.totalStallDurationSec.toFixed(1)}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> s</span>
          </div>
          <div className="player-metric-label">Rebuffer Time</div>
        </div>
      </div>
    </div>
  );
});

export default BaselinePlayer;
