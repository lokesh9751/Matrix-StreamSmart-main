/**
 * client/src/utils/telemetryTracker.js – High-Fidelity Playback Telemetry Collection
 *
 * Attaches to an HTML5 video element and HLS.js instance.
 * Measures: Time to First Frame (TTFF), stall count, stall duration, buffer occupancy,
 * average bitrate, quality switches, download bandwidth, and cache metrics.
 *
 * Call tracker.getMetrics() to read the current snapshot.
 * Call tracker.getTimeSeries() for chart data.
 */

export function createTelemetryTracker({ playerType, sessionId, onMetricsUpdate }) {
  const state = {
    playerType,
    sessionId,
    // Timing & Startup
    initTime: performance.now(),
    startTime: null,
    startupDelayMs: 0,
    started: false,
    // Stalls
    stallCount: 0,
    stallStart: null,
    totalStallDurationMs: 0,
    currentlyStalled: false,
    isSeeking: false,
    // Bitrate & Resolution
    bitrateSamples: [],
    currentBitrateKbps: 0,
    currentResolution: '--',
    downloadBandwidthKbps: 0,
    // Quality Switches
    qualitySwitches: 0,
    // Edge Cache (hit / miss)
    cacheHits: 0,
    cacheMisses: 0,
    // Buffer Headroom
    currentBufferSec: 0,
    // Time series for charts (sampled every second: { elapsed, buffer, bitrate, resolution })
    timeSeries: [],
  };

  let video = null;
  let hls   = null;
  let tickInterval = null;

  // ── Multi-range Buffer Calculation ───────────────────────────────────────
  function readBuffer() {
    if (!video || !video.buffered || video.buffered.length === 0) return 0;
    const ct = video.currentTime;
    const numRanges = video.buffered.length;

    // 1. Direct range match
    for (let i = 0; i < numRanges; i++) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (ct >= start && ct <= end) {
        return Math.max(0, end - ct);
      }
    }

    // 2. Tolerance match (within 0.5s of start of next range)
    for (let i = 0; i < numRanges; i++) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (start >= ct && (start - ct) <= 0.5) {
        return Math.max(0, end - ct);
      }
    }

    return 0;
  }

  // ── Video Event Listeners ────────────────────────────────────────────────

  function onLoadedData() {
    if (!state.started) {
      state.startTime = performance.now();
      state.startupDelayMs = Math.max(1, Math.round(state.startTime - state.initTime));
      state.started = true;
    }
  }

  function onWaiting() {
    // Only count as network buffer stall if NOT actively seeking
    if (!state.currentlyStalled && !state.isSeeking && state.started) {
      state.currentlyStalled = true;
      state.stallStart       = performance.now();
      state.stallCount++;
    }
  }

  function onPlaying() {
    if (state.currentlyStalled) {
      state.currentlyStalled = false;
      const dur = performance.now() - (state.stallStart || performance.now());
      state.totalStallDurationMs += dur;
      state.stallStart = null;
    }
    if (!state.started) {
      state.startTime = performance.now();
      state.startupDelayMs = Math.max(1, Math.round(state.startTime - state.initTime));
      state.started = true;
    }
    state.isSeeking = false;
  }

  function onSeeking() {
    state.isSeeking = true;
  }

  function onSeeked() {
    state.isSeeking = false;
  }

  function tickMetrics() {
    if (!video) return;
    const bufferSec = readBuffer();
    state.currentBufferSec = bufferSec;

    // Active stall ongoing check
    if (state.currentlyStalled && state.stallStart) {
      const activeDuration = performance.now() - state.stallStart;
      // Active stall reflected in total live counter
    }

    const elapsed = state.started && state.startTime
      ? (performance.now() - state.startTime) / 1000
      : 0;

    // Sample bitrate
    if (state.currentBitrateKbps > 0) {
      state.bitrateSamples.push(state.currentBitrateKbps);
    }

    // Push to time series (keep last 180 points)
    state.timeSeries.push({
      elapsed:    parseFloat(elapsed.toFixed(1)),
      buffer:     parseFloat(bufferSec.toFixed(2)),
      bitrate:    state.currentBitrateKbps,
      resolution: state.currentResolution,
    });
    if (state.timeSeries.length > 180) state.timeSeries.shift();

    onMetricsUpdate && onMetricsUpdate(getMetrics());
  }

  // ── HLS.js Event Handlers ────────────────────────────────────────────────

  function onManifestParsed(event, data) {
    if (!state.initTime) {
      state.initTime = performance.now();
    }
    if (data.levels && data.levels.length > 0) {
      const initialLevel = hls.currentLevel >= 0 ? data.levels[hls.currentLevel] : data.levels[0];
      if (initialLevel) {
        state.currentResolution = initialLevel.height ? `${initialLevel.height}p` : 'Auto';
        state.currentBitrateKbps = Math.round((initialLevel.bitrate || initialLevel.averageBitrate || 0) / 1000);
      }
    }
  }

  function onFragLoaded(event, data) {
    // 1. Bitrate & resolution from fragment
    if (data && data.frag) {
      const lvl = hls?.levels?.[data.frag.level];
      const bitrateBps = lvl?.bitrate || data.frag.bitrate || 0;
      const bitrateKbps = Math.round(bitrateBps / 1000);
      if (bitrateKbps > 0) {
        state.currentBitrateKbps = bitrateKbps;
      }
      if (lvl?.height) {
        state.currentResolution = `${lvl.height}p`;
      }
    }

    // 2. Measure actual segment download throughput from stats
    if (data?.stats?.loading?.end && data?.stats?.loading?.first && data?.stats?.total) {
      const durationMs = data.stats.loading.end - data.stats.loading.first;
      if (durationMs > 10) {
        const measuredBwKbps = Math.round(((data.stats.total * 8) / durationMs));
        state.downloadBandwidthKbps = measuredBwKbps;
      }
    }
  }

  function onLevelSwitched(event, data) {
    state.qualitySwitches++;
    if (hls && hls.levels && hls.levels[data.level]) {
      const lv = hls.levels[data.level];
      state.currentBitrateKbps = Math.round((lv.bitrate || lv.averageBitrate || 0) / 1000);
      state.currentResolution  = lv.height ? `${lv.height}p` : `L${data.level}`;
    }
  }

  function onError(event, data) {
    if (data.fatal) {
      console.error(`[${playerType} Tracker] Fatal HLS error:`, data.type, data.details);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  function attach(videoEl, hlsInstance) {
    video = videoEl;
    hls   = hlsInstance;
    state.initTime = performance.now();

    // HTML5 video events
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('waiting',    onWaiting);
    video.addEventListener('playing',    onPlaying);
    video.addEventListener('seeking',    onSeeking);
    video.addEventListener('seeked',     onSeeked);

    // HLS.js events
    if (hls) {
      const Hls = hls.constructor;
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.on(Hls.Events.FRAG_LOADED,     onFragLoaded);
      hls.on(Hls.Events.LEVEL_SWITCHED,  onLevelSwitched);
      hls.on(Hls.Events.ERROR,           onError);
    }

    // 1-second polling tick
    tickInterval = setInterval(tickMetrics, 1000);
  }

  function detach() {
    // If stalled when detached, close stall timer
    if (state.currentlyStalled && state.stallStart) {
      state.totalStallDurationMs += performance.now() - state.stallStart;
      state.currentlyStalled = false;
      state.stallStart = null;
    }

    if (video) {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('waiting',    onWaiting);
      video.removeEventListener('playing',    onPlaying);
      video.removeEventListener('seeking',    onSeeking);
      video.removeEventListener('seeked',     onSeeked);
    }
    if (hls) {
      const Hls = hls.constructor;
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.FRAG_LOADED,     onFragLoaded);
      hls.off(Hls.Events.LEVEL_SWITCHED,  onLevelSwitched);
      hls.off(Hls.Events.ERROR,           onError);
    }
    if (tickInterval) clearInterval(tickInterval);
  }

  function recordCacheEvent(isHit) {
    if (isHit) {
      state.cacheHits++;
    } else {
      state.cacheMisses++;
    }
  }

  function recordThroughput(bwKbps) {
    if (bwKbps > 0) {
      state.downloadBandwidthKbps = Math.round(bwKbps);
    }
  }

  function getMetrics() {
    let activeStallSec = 0;
    if (state.currentlyStalled && state.stallStart) {
      activeStallSec = (performance.now() - state.stallStart) / 1000;
    }

    const totalStallDurationSec = parseFloat(
      ((state.totalStallDurationMs / 1000) + activeStallSec).toFixed(2)
    );

    const avgBitrate = state.bitrateSamples.length > 0
      ? Math.round(state.bitrateSamples.reduce((a, b) => a + b, 0) / state.bitrateSamples.length)
      : state.currentBitrateKbps;

    return {
      playerType:            state.playerType,
      startupDelayMs:        state.startupDelayMs,
      stallCount:            state.stallCount,
      totalStallDurationSec,
      avgBitrateKbps:        avgBitrate,
      currentBitrateKbps:    state.currentBitrateKbps,
      currentResolution:     state.currentResolution,
      downloadBandwidthKbps: state.downloadBandwidthKbps,
      qualitySwitches:       state.qualitySwitches,
      cacheHits:             state.cacheHits,
      cacheMisses:           state.cacheMisses,
      currentBufferSec:      parseFloat(state.currentBufferSec.toFixed(2)),
      currentlyStalled:      state.currentlyStalled,
      isStarted:             state.started,
    };
  }

  function getTimeSeries() {
    return [...state.timeSeries];
  }

  function reset() {
    Object.assign(state, {
      initTime: performance.now(),
      startTime: null,
      startupDelayMs: 0,
      started: false,
      stallCount: 0,
      stallStart: null,
      totalStallDurationMs: 0,
      currentlyStalled: false,
      isSeeking: false,
      bitrateSamples: [],
      currentBitrateKbps: 0,
      currentResolution: '--',
      downloadBandwidthKbps: 0,
      qualitySwitches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      currentBufferSec: 0,
      timeSeries: [],
    });
  }

  return {
    attach,
    detach,
    recordCacheEvent,
    recordThroughput,
    getMetrics,
    getTimeSeries,
    reset
  };
}
