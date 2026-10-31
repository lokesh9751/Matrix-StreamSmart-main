/**
 * client/src/algorithms/abrEngine.js
 *
 * StreamSmart Custom Adaptive Bitrate Streaming (ABR) Engine
 *
 * Implements the StreamSmart buffer-occupancy + bandwidth-safety-margin heuristic.
 * Evaluated periodically (every 1500 ms) on the Optimized Player.
 *
 * Core Formulas & Rules:
 *  - Safe Bandwidth: T_safe = Available Bandwidth * 0.75
 *  - Buffer Occupancy: B = video.buffered.end(i) - video.currentTime
 *  - Rule 1 (Emergency Downshift): B < 3.5 s -> Step down to prevent buffer starvation (BUFFER_RISK_DOWNSHIFT)
 *  - Rule 2 (Bandwidth Limit Downshift): Current bitrate > T_safe -> Immediately downshift to sustainable tier (BANDWIDTH_LIMIT)
 *  - Rule 3 (Conservative Upshift): B > 10.0 s AND nextLevel.bitrate <= T_safe -> Step up one level (STABLE_BANDWIDTH_UPSHIFT)
 *  - Rule 4 (Steady State): 3.5 s <= B <= 10.0 s (or bandwidth insufficient) -> Hold current level (STEADY_STATE_HOLD)
 *
 * Designed to map dynamically to actual manifest levels (hls.levels)
 * rather than assuming fixed resolutions.
 */

// ── Standard Quality Reference Ladder ──────────────────────────────────────
export const QUALITY_LADDER = [
  { level: 0, label: '240p',  bitrateKbps: 400,  height: 240  },
  { level: 1, label: '360p',  bitrateKbps: 800,  height: 360  },
  { level: 2, label: '480p',  bitrateKbps: 1400, height: 480  },
  { level: 3, label: '720p',  bitrateKbps: 2800, height: 720  },
  { level: 4, label: '1080p', bitrateKbps: 5000, height: 1080 },
];

export const ABR_INTERVAL_MS       = 1500; // Decision loop runs every 1.5 seconds
export const BUFFER_LOW_THRESHOLD  = 3.5;  // seconds: emergency downshift trigger
export const BUFFER_HIGH_THRESHOLD = 10.0; // seconds: conservative upshift requirement
export const BANDWIDTH_SAFETY      = 0.75; // 75% safe bandwidth threshold

/**
 * Calculate the safe bandwidth available for video quality switching.
 * @param {number} bandwidthKbps Available or simulated bandwidth in Kbps
 * @returns {number} Safe bandwidth threshold in Kbps
 */
export function calculateSafeBandwidth(bandwidthKbps) {
  const bw = Math.max(50, Number(bandwidthKbps) || 0);
  return bw * BANDWIDTH_SAFETY;
}

/**
 * Calculates real buffer occupancy ahead of current playback position.
 * Handles multiple buffered ranges, paused state, startup, and seek gaps.
 *
 * @param {HTMLMediaElement} video - HTML5 video element
 * @returns {number} Buffer occupancy in seconds
 */
export function calculateBufferOccupancy(video) {
  if (!video || !video.buffered || video.buffered.length === 0) {
    return 0;
  }

  const ct = video.currentTime;
  const numRanges = video.buffered.length;

  // 1. Direct range match: ct falls within buffered range [start, end]
  for (let i = 0; i < numRanges; i++) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (ct >= start && ct <= end) {
      return Math.max(0, end - ct);
    }
  }

  // 2. Tolerance match: ct is within 0.5s before the start of the next range
  for (let i = 0; i < numRanges; i++) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (start >= ct && (start - ct) <= 0.5) {
      return Math.max(0, end - ct);
    }
  }

  // 3. Fallback: video reached the end of playback
  if (video.ended) {
    return 0;
  }

  return 0;
}

/**
 * Normalizes and maps actual HLS.js levels from manifest into structured ladder.
 * Reads actual resolution and bitrate from hls.levels.
 *
 * @param {Array} hlsLevels - Raw hls.levels array from HLS.js instance
 * @returns {Array} Formatted ladder of available renditions
 */
export function mapHlsLevels(hlsLevels) {
  if (!hlsLevels || !Array.isArray(hlsLevels) || hlsLevels.length === 0) {
    return QUALITY_LADDER;
  }

  return hlsLevels.map((lvl, index) => {
    const height = lvl.height || (lvl.attrs?.RESOLUTION ? parseInt(lvl.attrs.RESOLUTION.split('x')[1]) : 0);
    const width = lvl.width || (lvl.attrs?.RESOLUTION ? parseInt(lvl.attrs.RESOLUTION.split('x')[0]) : 0);
    const bitrateBps = lvl.bitrate || lvl.averageBitrate || 0;
    const bitrateKbps = Math.round(bitrateBps / 1000) || QUALITY_LADDER[Math.min(index, QUALITY_LADDER.length - 1)].bitrateKbps;

    let label;
    if (height > 0) {
      label = `${height}p`;
    } else if (bitrateKbps > 0) {
      label = `${bitrateKbps}k`;
    } else {
      label = `Level ${index}`;
    }

    return {
      level: index,
      hlsIndex: index,
      label,
      height,
      width,
      bitrateKbps,
      bitrateBps,
    };
  });
}

/**
 * StreamSmart Custom ABR Decision Engine
 *
 * Evaluates current buffer occupancy and bandwidth, applying 4-state heuristic rules:
 * 1. BUFFER_RISK_DOWNSHIFT (B < 3.5s)
 * 2. BANDWIDTH_LIMIT (Current bitrate > Safe Bandwidth)
 * 3. STABLE_BANDWIDTH_UPSHIFT (B > 10.0s AND candidate <= Safe Bandwidth)
 * 4. STEADY_STATE_HOLD (Stable buffer and bandwidth)
 *
 * @param {object} params
 * @param {number} params.currentLevel    - Current active zero-based level index
 * @param {number} params.bufferSec       - Current buffer occupancy in seconds
 * @param {number} params.bandwidthKbps   - Available / simulated bandwidth in Kbps
 * @param {Array}  [params.hlsLevels]     - Manifest levels from HLS.js
 * @returns {{
 *   nextLevel: number,
 *   reason: 'BUFFER_RISK_DOWNSHIFT' | 'BANDWIDTH_LIMIT' | 'STABLE_BANDWIDTH_UPSHIFT' | 'STEADY_STATE_HOLD',
 *   reasonDetail: string,
 *   safeBandwidthKbps: number,
 *   label: string,
 *   targetSpec: object,
 *   currentSpec: object,
 *   isSwitch: boolean
 * }}
 */
export function recommendQuality({ currentLevel = 0, bufferSec = 0, bandwidthKbps = 4500, hlsLevels }) {
  const ladder = mapHlsLevels(hlsLevels);
  const maxLevel = Math.max(0, ladder.length - 1);
  const safeCurrentLevel = Math.max(0, Math.min(Number(currentLevel) || 0, maxLevel));
  const safeBW = calculateSafeBandwidth(bandwidthKbps);
  const currentSpec = ladder[safeCurrentLevel] || { level: safeCurrentLevel, label: `${safeCurrentLevel}`, bitrateKbps: 0 };

  const buf = Math.max(0, Number(bufferSec) || 0);

  // Single-quality streams cannot adapt
  if (ladder.length <= 1) {
    return {
      nextLevel: 0,
      reason: 'STEADY_STATE_HOLD',
      reasonDetail: `Single rendition stream (${currentSpec.label}) — adaptation disabled`,
      safeBandwidthKbps: Math.round(safeBW),
      label: currentSpec.label,
      targetSpec: currentSpec,
      currentSpec,
      isSwitch: false
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rule 1: Emergency Downshift (Buffer Starvation Prevention)
  // If buffer occupancy is below 3.5 seconds, immediately drop quality by 1 level
  // to avoid buffer starvation / stall events.
  // ──────────────────────────────────────────────────────────────────────────
  if (buf < BUFFER_LOW_THRESHOLD && safeCurrentLevel > 0) {
    const nextLevel = safeCurrentLevel - 1;
    const targetSpec = ladder[nextLevel];
    return {
      nextLevel,
      reason: 'BUFFER_RISK_DOWNSHIFT',
      reasonDetail: `Buffer depleted (${buf.toFixed(1)}s < ${BUFFER_LOW_THRESHOLD}s) — emergency downshift to ${targetSpec.label}`,
      safeBandwidthKbps: Math.round(safeBW),
      label: targetSpec.label,
      targetSpec,
      currentSpec,
      isSwitch: true
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rule 2: Bandwidth Constraint Downshift (Never exceed safe bandwidth)
  // If current rendition's bitrate exceeds the safe bandwidth capacity,
  // immediately step down to the highest rendition that satisfies T_safe.
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSpec.bitrateKbps > safeBW && safeCurrentLevel > 0) {
    // Find the highest sustainable rendition that fits under safeBW
    let targetLevel = 0;
    for (let i = safeCurrentLevel - 1; i >= 0; i--) {
      if (ladder[i].bitrateKbps <= safeBW) {
        targetLevel = i;
        break;
      }
    }
    const targetSpec = ladder[targetLevel];
    return {
      nextLevel: targetLevel,
      reason: 'BANDWIDTH_LIMIT',
      reasonDetail: `Bandwidth constraint (${bandwidthKbps} Kbps, safe: ${Math.round(safeBW)} Kbps) — current ${currentSpec.label} (${currentSpec.bitrateKbps} Kbps) exceeds safe threshold. Downshifting to ${targetSpec.label}`,
      safeBandwidthKbps: Math.round(safeBW),
      label: targetSpec.label,
      targetSpec,
      currentSpec,
      isSwitch: true
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rule 3: Conservative Upshift
  // If buffer occupancy exceeds 10.0 seconds AND the candidate next rendition's
  // bitrate is less than or equal to the 75% safe bandwidth threshold.
  // ──────────────────────────────────────────────────────────────────────────
  if (buf > BUFFER_HIGH_THRESHOLD && safeCurrentLevel < maxLevel) {
    const candidate = ladder[safeCurrentLevel + 1];

    if (candidate.bitrateKbps <= safeBW) {
      return {
        nextLevel: safeCurrentLevel + 1,
        reason: 'STABLE_BANDWIDTH_UPSHIFT',
        reasonDetail: `Buffer healthy (${buf.toFixed(1)}s > ${BUFFER_HIGH_THRESHOLD}s) & safe BW (${Math.round(safeBW)} Kbps >= ${candidate.bitrateKbps} Kbps) — upshift to ${candidate.label}`,
        safeBandwidthKbps: Math.round(safeBW),
        label: candidate.label,
        targetSpec: candidate,
        currentSpec,
        isSwitch: true
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rule 4: Steady State (Hold Current Rendition)
  // Maintains current quality if buffer is in stable range [3.5s - 10.0s]
  // or if bandwidth cannot comfortably sustain the next higher rendition.
  // ──────────────────────────────────────────────────────────────────────────
  let steadyReasonDetail;
  if (buf < BUFFER_LOW_THRESHOLD && safeCurrentLevel === 0) {
    steadyReasonDetail = `Buffer critical (${buf.toFixed(1)}s), but already at lowest rendition (${currentSpec.label})`;
  } else if (buf > BUFFER_HIGH_THRESHOLD && safeCurrentLevel === maxLevel) {
    steadyReasonDetail = `Buffer optimal (${buf.toFixed(1)}s) — already at peak rendition (${currentSpec.label})`;
  } else if (buf > BUFFER_HIGH_THRESHOLD && safeCurrentLevel < maxLevel) {
    const candidate = ladder[safeCurrentLevel + 1];
    steadyReasonDetail = `Buffer healthy (${buf.toFixed(1)}s), but safe BW (${Math.round(safeBW)} Kbps) < next tier (${candidate.bitrateKbps} Kbps)`;
  } else {
    steadyReasonDetail = `Buffer in steady zone (${buf.toFixed(1)}s between ${BUFFER_LOW_THRESHOLD}s and ${BUFFER_HIGH_THRESHOLD}s)`;
  }

  return {
    nextLevel: safeCurrentLevel,
    reason: 'STEADY_STATE_HOLD',
    reasonDetail: steadyReasonDetail,
    safeBandwidthKbps: Math.round(safeBW),
    label: currentSpec.label,
    targetSpec: currentSpec,
    currentSpec,
    isSwitch: false
  };
}

export default {
  QUALITY_LADDER,
  ABR_INTERVAL_MS,
  BUFFER_LOW_THRESHOLD,
  BUFFER_HIGH_THRESHOLD,
  BANDWIDTH_SAFETY,
  calculateSafeBandwidth,
  calculateBufferOccupancy,
  mapHlsLevels,
  recommendQuality
};
