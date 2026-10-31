/**
 * client/src/utils/dualPlayer.js – Dual HLS.js Player Controller with MP4 Fallback
 *
 * Manages two independent video player instances (Baseline + Optimized).
 *  - Player 1 (Baseline): Fixed-quality streaming locked to the highest available rendition.
 *  - Player 2 (Optimized): Custom Adaptive Bitrate (ABR) Streaming with buffer-driven heuristics.
 *
 * Both players support Cloudinary HLS (.m3u8) playback with automatic fallback to direct MP4
 * URLs if HLS eager transcoding is still in progress or HLS is unavailable.
 */

import Hls from 'hls.js';
import { createTelemetryTracker } from './telemetryTracker';
import {
  recommendQuality,
  calculateBufferOccupancy,
  calculateSafeBandwidth,
  mapHlsLevels,
  ABR_INTERVAL_MS
} from '../algorithms/abrEngine';
import { logQualitySwitchEvent } from '../services/telemetryService';

// ── Custom HLS.js Throttled Loader Factory ─────────────────────────────────
// Simulates network bandwidth constraints, latency, jitter, packet loss, and
// edge cache hit/miss delays directly on video segment delivery into MSE buffers.

function createThrottledLoaderClass(getNetworkConfig, trackerRef) {
  const DefaultLoader = Hls.DefaultConfig.loader;

  return class ThrottledLoader extends DefaultLoader {
    constructor(config) {
      super(config);
      this.delayTimer = null;
    }

    load(context, loaderConfig, callbacks) {
      const netConfig = getNetworkConfig ? getNetworkConfig() : null;

      // Identify if request is a media fragment (video segment) vs manifest playlist
      const isMediaFragment = Boolean(
        context.frag ||
        context.part ||
        (context.url && (/\.(ts|m4s|mp4|aac|m4a)($|\?)/i.test(context.url) || !context.url.includes('.m3u8')))
      );

      // If network simulation is disabled or not a media fragment, execute standard fast load
      if (!netConfig || !netConfig.enabled || !isMediaFragment) {
        return super.load(context, loaderConfig, callbacks);
      }

      const originalOnSuccess = callbacks.onSuccess;
      const originalOnError   = callbacks.onError;

      const wrappedCallbacks = {
        ...callbacks,
        onSuccess: (response, stats, ctx, networkDetails) => {
          try {
            // 1. Packet loss simulation: drop segment if condition met
            const packetLossPct = parseFloat(netConfig.packetLossPct || 0);
            if (packetLossPct > 0 && Math.random() * 100 < packetLossPct) {
              if (originalOnError) {
                originalOnError.call(this, { code: 408, text: 'Simulated Packet Loss (Timeout)' }, ctx, networkDetails);
                return;
              }
            }

            // 2. Segment size in bits
            const segmentBytes = stats?.total || stats?.loaded || response?.data?.byteLength || 350000;
            const segmentBits = segmentBytes * 8;
            const bwKbps = Math.max(50, parseFloat(netConfig.bandwidthKbps) || 4500);
            const bwBps = bwKbps * 1000;

            // 3. Transfer duration: (bits / bps) * 1000 ms
            const transferTimeMs = Math.round((segmentBits / bwBps) * 1000);

            // 4. Base RTT Latency + +/-10% Jitter
            const latencyMs = Math.max(0, parseInt(netConfig.latencyMs, 10) || 0);
            const jitterMs = Math.round((Math.random() * 0.2 - 0.1) * latencyMs);

            // 5. Edge Cache simulation: Hit = 12ms edge delay, Miss = 260ms origin delay
            const cacheHitProb = netConfig.cacheHitProb !== undefined ? parseFloat(netConfig.cacheHitProb) : 0.75;
            const isCacheHit = Math.random() < cacheHitProb;
            const cacheDelayMs = isCacheHit ? 12 : 260;

            if (trackerRef?.current?.recordCacheEvent) {
              trackerRef.current.recordCacheEvent(isCacheHit);
            }

            // 6. Total simulated delivery delay
            const totalDelayMs = Math.max(10, Math.min(transferTimeMs + latencyMs + jitterMs + cacheDelayMs, 12000));

            this.delayTimer = setTimeout(() => {
              this.delayTimer = null;
              // Update loader stats with actual delivery completion time for accurate bandwidth estimation
              if (stats && stats.loading) {
                stats.loading.end = performance.now();
              }
              if (trackerRef?.current?.recordThroughput) {
                trackerRef.current.recordThroughput(bwKbps);
              }
              originalOnSuccess.call(this, response, stats, ctx, networkDetails);
            }, totalDelayMs);
          } catch (err) {
            originalOnSuccess.call(this, response, stats, ctx, networkDetails);
          }
        }
      };

      super.load(context, loaderConfig, wrappedCallbacks);
    }

    abort() {
      if (this.delayTimer) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
      super.abort();
    }

    destroy() {
      if (this.delayTimer) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
      super.destroy();
    }
  };
}

// ── Baseline Player (Fixed High Quality) ───────────────────────────────────

export function createBaselinePlayer({ videoEl, src, fallbackMp4Url, networkConfig, onMetrics, onLevels, onError }) {
  const resolvedHlsUrl = (typeof src === 'string' ? src : (src?.hlsPlaylistUrl || src?.stream_url || src?.mp4Url)) || '';
  const resolvedMp4Url = fallbackMp4Url || (typeof src === 'object' ? src?.mp4Url : '') || (resolvedHlsUrl.includes('.m3u8') ? resolvedHlsUrl.replace(/\.m3u8$/, '.mp4') : resolvedHlsUrl);

  // If source is direct MP4, attach directly to HTML5 video element
  if (!resolvedHlsUrl.includes('.m3u8') && (resolvedHlsUrl.endsWith('.mp4') || resolvedMp4Url)) {
    videoEl.src = resolvedHlsUrl || resolvedMp4Url;
    const tracker = createTelemetryTracker({
      playerType: 'BASELINE',
      sessionId: networkConfig?.sessionId,
      onMetricsUpdate: onMetrics,
    });
    tracker.attach(videoEl, null);
    videoEl.play().catch(e => console.warn('[Baseline] Autoplay caught:', e.message));
    return {
      destroy: () => {
        tracker.detach();
        try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (_) {}
      },
      getHls: () => null,
      getVideo: () => videoEl,
      getCurrentTime: () => videoEl.currentTime,
      play: () => videoEl.play().catch(err => console.warn('[Baseline] Play failed:', err.message)),
      pause: () => videoEl.pause(),
      seek: (t) => { if (videoEl && !isNaN(t)) videoEl.currentTime = Math.max(0, t); },
      updateNetworkConfig: () => {},
      setQuality: () => {},
      getTracker: () => tracker
    };
  }

  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = resolvedHlsUrl;
      videoEl.addEventListener('error', () => {
        if (resolvedMp4Url && videoEl.src !== resolvedMp4Url) {
          console.warn('[Baseline] Native HLS error – falling back to mp4Url:', resolvedMp4Url);
          videoEl.src = resolvedMp4Url;
          videoEl.play().catch(e => console.warn('Native fallback play error:', e.message));
        }
      }, { once: true });
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    if (resolvedMp4Url) {
      console.warn('[Baseline] HLS not supported – falling back to mp4Url:', resolvedMp4Url);
      videoEl.src = resolvedMp4Url;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  // Mutable network config holder for dynamic updates
  let currentNetConfig = { ...networkConfig };
  const trackerRef = { current: null };

  const ThrottledLoader = createThrottledLoaderClass(() => currentNetConfig, trackerRef);

  const hls = new Hls({
    startLevel:       -1,
    autoStartLoad:    true,
    autoLevelEnabled: false,
    loader:           ThrottledLoader,
  });

  const tracker = createTelemetryTracker({
    playerType: 'BASELINE',
    sessionId: currentNetConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });
  trackerRef.current = tracker;

  let selectedQualityIndex = -1;

  hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
    // Lock to the highest available rendition (preferably 1080p)
    const highest = hls.levels.length - 1;
    selectedQualityIndex = highest;
    hls.currentLevel     = highest;
    hls.loadLevel        = highest;
    hls.autoLevelEnabled = false;

    console.log(`[Baseline] Locked to highest level ${highest}:`, hls.levels[highest]);
    videoEl.play().catch(e => console.warn('[Baseline] Autoplay caught:', e.message));

    if (onLevels && hls.levels) {
      onLevels(hls.levels);
    }
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          if (data.details === 'manifestLoadError' || data.details === 'manifestLoadTimeOut' || data.response?.code === 404) {
            if (resolvedMp4Url && resolvedMp4Url !== resolvedHlsUrl) {
              console.warn('[Baseline] HLS manifest still processing or unavailable – falling back to mp4Url:', resolvedMp4Url);
              hls.destroy();
              videoEl.src = resolvedMp4Url;
              videoEl.play().catch(e => console.warn('[Baseline] Fallback play error:', e.message));
              return;
            }
          }
          console.warn('[Baseline] Fatal network error – attempting recovery');
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.warn('[Baseline] Fatal media error – attempting recovery');
          hls.recoverMediaError();
          break;
        default:
          console.error('[Baseline] Unrecoverable error:', data);
          if (resolvedMp4Url && videoEl.src !== resolvedMp4Url) {
            console.warn('[Baseline] Falling back to MP4 URL on unrecoverable error:', resolvedMp4Url);
            hls.destroy();
            videoEl.src = resolvedMp4Url;
            videoEl.play().catch(e => console.warn('[Baseline] Fallback play error:', e.message));
            return;
          }
          onError && onError(data);
          break;
      }
    }
  });

  hls.loadSource(resolvedHlsUrl);
  hls.attachMedia(videoEl);
  tracker.attach(videoEl, hls);

  return {
    destroy() {
      tracker.detach();
      hls.destroy();
      try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (_) {}
    },
    getHls:     () => hls,
    getTracker: () => tracker,
    getVideo:   () => videoEl,
    getCurrentTime: () => videoEl.currentTime,
    play() {
      return videoEl.play().catch(err => console.warn('[Baseline] Play failed:', err.message));
    },
    pause() {
      videoEl.pause();
    },
    seek(time) {
      if (videoEl && !isNaN(time)) {
        videoEl.currentTime = Math.max(0, time);
      }
    },
    updateNetworkConfig(newConfig) {
      currentNetConfig = { ...currentNetConfig, ...newConfig };
    },
    setQuality(levelIndex) {
      if (!hls || !hls.levels) return;
      const target = Math.max(0, Math.min(levelIndex, hls.levels.length - 1));
      selectedQualityIndex = target;
      hls.currentLevel     = target;
      hls.loadLevel        = target;
      hls.nextLevel        = target;
      hls.autoLevelEnabled = false;
      console.log(`[Baseline] Fixed quality locked to level ${target} (${hls.levels[target]?.height || '--'}p):`, hls.levels[target]);
    }
  };
}

// ── Optimized Player (Custom ABR Heuristic Engine) ─────────────────────────

export function createOptimizedPlayer({
  videoEl,
  src,
  fallbackMp4Url,
  networkConfig,
  onMetrics,
  onLevels,
  onABRStateChange,
  onQualitySwitch,
  onError
}) {
  const resolvedHlsUrl = (typeof src === 'string' ? src : (src?.hlsPlaylistUrl || src?.stream_url || src?.mp4Url)) || '';
  const resolvedMp4Url = fallbackMp4Url || (typeof src === 'object' ? src?.mp4Url : '') || (resolvedHlsUrl.includes('.m3u8') ? resolvedHlsUrl.replace(/\.m3u8$/, '.mp4') : resolvedHlsUrl);

  // If source is direct MP4, attach directly to HTML5 video element
  if (!resolvedHlsUrl.includes('.m3u8') && (resolvedHlsUrl.endsWith('.mp4') || resolvedMp4Url)) {
    videoEl.src = resolvedHlsUrl || resolvedMp4Url;
    const tracker = createTelemetryTracker({
      playerType: 'OPTIMIZED',
      sessionId: networkConfig?.sessionId,
      onMetricsUpdate: onMetrics,
    });
    tracker.attach(videoEl, null);
    videoEl.play().catch(e => console.warn('[Optimized] Autoplay caught:', e.message));
    return {
      destroy: () => {
        tracker.detach();
        try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (_) {}
      },
      getHls: () => null,
      getVideo: () => videoEl,
      getCurrentTime: () => videoEl.currentTime,
      play: () => videoEl.play().catch(err => console.warn('[Optimized] Play failed:', err.message)),
      pause: () => videoEl.pause(),
      seek: (t) => { if (videoEl && !isNaN(t)) videoEl.currentTime = Math.max(0, t); },
      updateNetworkConfig: () => {},
      setQuality: () => {},
      getTracker: () => tracker
    };
  }

  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = resolvedHlsUrl;
      videoEl.addEventListener('error', () => {
        if (resolvedMp4Url && videoEl.src !== resolvedMp4Url) {
          console.warn('[Optimized] Native HLS error – falling back to mp4Url:', resolvedMp4Url);
          videoEl.src = resolvedMp4Url;
          videoEl.play().catch(e => console.warn('Native fallback play error:', e.message));
        }
      }, { once: true });
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    if (resolvedMp4Url) {
      console.warn('[Optimized] HLS not supported – falling back to mp4Url:', resolvedMp4Url);
      videoEl.src = resolvedMp4Url;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  // Mutable network config holder for dynamic throttling updates
  let currentNetConfig = { ...networkConfig };
  const trackerRef = { current: null };

  const ThrottledLoader = createThrottledLoaderClass(() => currentNetConfig, trackerRef);

  const hls = new Hls({
    startLevel:       0,     // Start at lowest rendition for rapid TTFF
    autoStartLoad:    true,
    autoLevelEnabled: false, // Ensure built-in HLS.js ABR is replaced by custom engine
    loader:           ThrottledLoader,
  });

  const tracker = createTelemetryTracker({
    playerType: 'OPTIMIZED',
    sessionId: currentNetConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });
  trackerRef.current = tracker;

  let abrInterval = null;
  let isAutoMode = true;
  let currentTargetLevel = 0;
  const startTime = Date.now();

  function runABRTick() {
    if (!hls.levels || hls.levels.length === 0) return;

    // 1. Calculate actual buffer headroom ahead of current playhead
    const buffer = calculateBufferOccupancy(videoEl);

    // 2. Determine available bandwidth: configured simulation bandwidth
    const simBw = parseFloat(currentNetConfig?.bandwidthKbps) || 4500;
    const availableBw = simBw;
    const safeBw = calculateSafeBandwidth(availableBw);

    const hlsBwEstimate = tracker?.getMetrics()?.downloadBandwidthKbps || Math.round((hls.bandwidthEstimate || 0) / 1000);
    const activeLevelIndex = hls.currentLevel >= 0 ? hls.currentLevel : currentTargetLevel;

    // 3. Handle manual quality override
    if (!isAutoMode) {
      if (onABRStateChange) {
        onABRStateChange({
          decision: 'MANUAL_OVERRIDE',
          reasonDetail: `Manual override locked to Level ${activeLevelIndex} (${hls.levels[activeLevelIndex]?.height || '--'}p)`,
          bufferSec: buffer,
          availableBandwidthKbps: availableBw,
          safeBandwidthKbps: Math.round(safeBw),
          estimatedBandwidthKbps: hlsBwEstimate,
          simulatedBandwidthKbps: simBw,
          isAuto: false,
          currentLevelIndex: activeLevelIndex,
          recommendedLevelIndex: activeLevelIndex
        });
      }
      return;
    }

    // Keep built-in HLS.js autoLevel disabled so custom algorithm drives levels
    if (hls.autoLevelEnabled) {
      hls.autoLevelEnabled = false;
    }

    // 4. Evaluate Custom ABR Decision Heuristic
    const recommendation = recommendQuality({
      currentLevel: activeLevelIndex,
      bufferSec: buffer,
      bandwidthKbps: availableBw,
      hlsLevels: hls.levels,
    });

    // Emit live diagnostics to React UI
    if (onABRStateChange) {
      onABRStateChange({
        decision: recommendation.reason,
        reasonDetail: recommendation.reasonDetail,
        bufferSec: buffer,
        availableBandwidthKbps: availableBw,
        safeBandwidthKbps: Math.round(safeBw),
        estimatedBandwidthKbps: hlsBwEstimate,
        simulatedBandwidthKbps: simBw,
        isAuto: true,
        currentLevelIndex: activeLevelIndex,
        recommendedLevelIndex: recommendation.nextLevel
      });
    }

    // 5. Apply HLS.js level switch if recommended level differs
    if (recommendation.nextLevel !== currentTargetLevel) {
      const ladder = mapHlsLevels(hls.levels);
      const fromSpec = ladder[currentTargetLevel] || { label: `Level ${currentTargetLevel}` };
      const toSpec = ladder[recommendation.nextLevel] || { label: `Level ${recommendation.nextLevel}` };

      console.log(
        `[Optimized ABR] ${recommendation.reason}: ${fromSpec.label} → ${toSpec.label} | Buffer: ${buffer.toFixed(1)}s | Safe BW: ${Math.round(safeBw)}Kbps`
      );

      // Smooth switch at fragment boundary
      hls.nextLevel = recommendation.nextLevel;

      // Emergency buffer depletion or severe bandwidth drop: switch immediately to avoid stall
      if (recommendation.reason === 'BUFFER_RISK_DOWNSHIFT' || recommendation.reason === 'BANDWIDTH_LIMIT') {
        hls.currentLevel = recommendation.nextLevel;
      }

      currentTargetLevel = recommendation.nextLevel;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const switchData = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        elapsedSec: parseFloat(elapsedSec.toFixed(1)),
        fromLevel: fromSpec.label,
        toLevel: toSpec.label,
        reason: recommendation.reason,
        reasonDetail: recommendation.reasonDetail,
        bufferSec: parseFloat(buffer.toFixed(1)),
        bandwidthKbps: availableBw,
        safeBandwidthKbps: Math.round(safeBw)
      };

      if (onQualitySwitch) {
        onQualitySwitch(switchData);
      }

      // Record to backend
      logQualitySwitchEvent({
        sessionId: currentNetConfig?.sessionId,
        playerType: 'OPTIMIZED',
        elapsedSec,
        previousResolution: fromSpec.label,
        newResolution: toSpec.label,
        bufferLevelSec: buffer,
        bandwidthKbps: availableBw,
        reason: recommendation.reason
      });
    }
  }

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // Start at lowest level for fastest initial Time to First Frame (TTFF)
    hls.currentLevel     = 0;
    currentTargetLevel   = 0;
    hls.autoLevelEnabled = false;

    // Run custom ABR decision loop every 1500 ms
    if (abrInterval) clearInterval(abrInterval);
    abrInterval = setInterval(runABRTick, ABR_INTERVAL_MS);

    console.log('[Optimized] Manifest parsed – custom ABR controller active');
    videoEl.play().catch(e => console.warn('[Optimized] Autoplay caught:', e.message));

    if (onLevels && hls.levels) {
      onLevels(hls.levels);
    }
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          if (data.details === 'manifestLoadError' || data.details === 'manifestLoadTimeOut' || data.response?.code === 404) {
            if (resolvedMp4Url && resolvedMp4Url !== resolvedHlsUrl) {
              console.warn('[Optimized] HLS manifest still processing or unavailable – falling back to mp4Url:', resolvedMp4Url);
              if (abrInterval) clearInterval(abrInterval);
              hls.destroy();
              videoEl.src = resolvedMp4Url;
              videoEl.play().catch(e => console.warn('[Optimized] Fallback play error:', e.message));
              return;
            }
          }
          console.warn('[Optimized] Fatal network error – attempting recovery');
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.warn('[Optimized] Fatal media error – recovering media');
          hls.recoverMediaError();
          break;
        default:
          console.error('[Optimized] Unrecoverable error:', data);
          if (resolvedMp4Url && videoEl.src !== resolvedMp4Url) {
            console.warn('[Optimized] Falling back to MP4 URL on unrecoverable error:', resolvedMp4Url);
            if (abrInterval) clearInterval(abrInterval);
            hls.destroy();
            videoEl.src = resolvedMp4Url;
            videoEl.play().catch(e => console.warn('[Optimized] Fallback play error:', e.message));
            return;
          }
          onError && onError(data);
          break;
      }
    }
  });

  hls.loadSource(resolvedHlsUrl);
  hls.attachMedia(videoEl);
  tracker.attach(videoEl, hls);

  return {
    destroy() {
      if (abrInterval) { clearInterval(abrInterval); abrInterval = null; }
      tracker.detach();
      hls.destroy();
      try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (_) {}
    },
    getHls:     () => hls,
    getTracker: () => tracker,
    getVideo:   () => videoEl,
    getCurrentTime: () => videoEl.currentTime,
    play() {
      return videoEl.play().catch(err => console.warn('[Optimized] Play failed:', err.message));
    },
    pause() {
      videoEl.pause();
    },
    seek(time) {
      if (videoEl && !isNaN(time)) {
        videoEl.currentTime = Math.max(0, time);
      }
    },
    updateNetworkConfig(newConfig) {
      currentNetConfig = { ...currentNetConfig, ...newConfig };
    },
    setQuality(levelIndex) {
      if (!hls || !hls.levels) return;
      if (levelIndex === -1) {
        isAutoMode = true;
        hls.autoLevelEnabled = false;
        console.log('[Optimized] Restored Auto mode (Custom ABR active)');
      } else {
        isAutoMode = false;
        const target = Math.max(0, Math.min(levelIndex, hls.levels.length - 1));
        currentTargetLevel = target;
        hls.currentLevel   = target;
        hls.loadLevel      = target;
        hls.nextLevel      = target;
        hls.autoLevelEnabled = false;
        console.log(`[Optimized] Manual quality override to level ${target} (${hls.levels[target]?.height || '--'}p):`, hls.levels[target]);
      }
    }
  };
}

export default {
  createBaselinePlayer,
  createOptimizedPlayer
};
