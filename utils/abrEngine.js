/**
 * utils/abrEngine.js – Custom ABR Quality-Selection Algorithm (Node.js backend)
 *
 * Implements the StreamSmart buffer-occupancy + bandwidth-safety-margin
 * heuristic. Both the browser-side controller (client/src/algorithms/abrEngine.js)
 * and this backend module use the same decision rules so that simulated
 * ABR decisions can be validated server-side.
 *
 * Decision interval: 1500 ms
 * Safety margin: 75% of available bandwidth
 *
 * Rules:
 *  1. B < 3.5 s  → step down one level (BUFFER_RISK_DOWNSHIFT)
 *  2. Current bitrate > safeBandwidth → immediately step down to sustainable tier (BANDWIDTH_LIMIT)
 *  3. B >= 4.0 s AND highestSustainable > currentLevel → step up towards highest sustainable rendition (STABLE_BANDWIDTH_UPSHIFT)
 *  4. Otherwise → hold current level (STEADY_STATE_HOLD)
 */

const QUALITY_LADDER = [
  { level: 0, label: '240p',  bitrateKbps: 400  },
  { level: 1, label: '360p',  bitrateKbps: 800  },
  { level: 2, label: '480p',  bitrateKbps: 1400 },
  { level: 3, label: '720p',  bitrateKbps: 2800 },
  { level: 4, label: '1080p', bitrateKbps: 5000 }
];

const ABR_INTERVAL_MS       = 1500;
const BUFFER_LOW_THRESHOLD  = 3.5;   // seconds – trigger downshift
const BUFFER_HIGH_THRESHOLD = 10.0;  // seconds – conservative threshold
const BUFFER_UP_THRESHOLD   = 4.0;   // seconds – minimum buffer headroom to consider upshift
const BANDWIDTH_SAFETY      = 0.75;  // 75% safety margin

function calculateSafeBandwidth(bandwidthKbps) {
  const bw = Math.max(50, Number(bandwidthKbps) || 0);
  return bw * BANDWIDTH_SAFETY;
}

function getHighestSustainableLevel(ladder, safeBandwidthKbps) {
  if (!ladder || ladder.length === 0) return 0;
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i].bitrateKbps <= safeBandwidthKbps) {
      return i;
    }
  }
  return 0;
}

/**
 * Recommend the next quality level given current state.
 *
 * @param {object} params
 * @param {number} params.currentLevel    - Current zero-based level index (into hlsLevels if provided)
 * @param {number} params.bufferSec       - Current buffer occupancy in seconds
 * @param {number} params.bandwidthKbps   - Available/simulated bandwidth in Kbps
 * @param {Array}  [params.hlsLevels]     - Actual HLS.js levels [{bitrate, height, ...}].
 *                                          If omitted, QUALITY_LADDER is used.
 * @param {Array}  [params.qualityLadder] - Custom quality ladder (backward compat)
 * @returns {{ nextLevel: number, reason: string, reasonDetail: string, safeBandwidthKbps: number, spec: object }}
 */
function recommendQuality({ currentLevel = 0, bufferSec = 0, bandwidthKbps = 4500, hlsLevels, qualityLadder }) {
  const ladder = qualityLadder || ((hlsLevels && Array.isArray(hlsLevels) && hlsLevels.length > 0)
    ? hlsLevels.map((l, i) => {
        const height = l.height || 0;
        const bitrateKbps = Math.round((l.bitrate || l.averageBitrate || 0) / 1000) || QUALITY_LADDER[Math.min(i, QUALITY_LADDER.length - 1)].bitrateKbps;
        const label = height > 0 ? `${height}p` : `${bitrateKbps}k`;
        return { level: i, label, bitrateKbps, height };
      })
    : QUALITY_LADDER);

  const maxLevel = Math.max(0, ladder.length - 1);
  const safeLevel = Math.max(0, Math.min(Number(currentLevel) || 0, maxLevel));
  const safeBandwidthKbps = calculateSafeBandwidth(bandwidthKbps);
  const currentSpec = ladder[safeLevel] || { level: safeLevel, label: `${safeLevel}`, bitrateKbps: 0 };
  const buf = Math.max(0, Number(bufferSec) || 0);

  // Single-quality streams cannot adapt
  if (ladder.length <= 1) {
    return {
      nextLevel: 0,
      reason: 'STEADY_STATE_HOLD',
      reasonDetail: `Single rendition stream (${currentSpec.label})`,
      safeBandwidthKbps: Math.round(safeBandwidthKbps),
      spec: currentSpec
    };
  }

  // 1. Emergency downshift – buffer running dry (< 3.5s)
  if (buf < BUFFER_LOW_THRESHOLD && safeLevel > 0) {
    const nextLevel = safeLevel - 1;
    return {
      nextLevel,
      reason: 'BUFFER_RISK_DOWNSHIFT',
      reasonDetail: `Buffer depleted (${buf.toFixed(1)}s < ${BUFFER_LOW_THRESHOLD}s) — emergency downshift to ${ladder[nextLevel].label}`,
      safeBandwidthKbps: Math.round(safeBandwidthKbps),
      spec: ladder[nextLevel]
    };
  }

  // 2. Bandwidth constraint – current bitrate exceeds safe bandwidth capacity
  if (currentSpec.bitrateKbps > safeBandwidthKbps && safeLevel > 0) {
    const sustainableLevel = getHighestSustainableLevel(ladder, safeBandwidthKbps);
    const targetLevel = Math.min(sustainableLevel, safeLevel - 1);
    return {
      nextLevel: targetLevel,
      reason: 'BANDWIDTH_LIMIT',
      reasonDetail: `Bandwidth limit (${bandwidthKbps} Kbps, safe: ${Math.round(safeBandwidthKbps)} Kbps) — current ${currentSpec.label} exceeds limit. Downshifting to ${ladder[targetLevel].label}`,
      safeBandwidthKbps: Math.round(safeBandwidthKbps),
      spec: ladder[targetLevel]
    };
  }

  // 3. Intelligent upshift – buffer healthy (>= 4.0s) and bandwidth supports higher tier
  const highestSustainable = getHighestSustainableLevel(ladder, safeBandwidthKbps);

  if (highestSustainable > safeLevel && buf >= BUFFER_UP_THRESHOLD) {
    let nextLevel;
    if (buf >= 8.0 || bandwidthKbps >= 5000) {
      // Abundant bandwidth or very healthy buffer: upgrade directly to highest sustainable level
      nextLevel = highestSustainable;
    } else {
      // Moderate conditions: step up gradually (+1) to prevent buffer drain
      nextLevel = Math.min(highestSustainable, safeLevel + 1);
    }

    const candidate = ladder[nextLevel];
    return {
      nextLevel,
      reason: 'STABLE_BANDWIDTH_UPSHIFT',
      reasonDetail: `Buffer healthy (${buf.toFixed(1)}s >= ${BUFFER_UP_THRESHOLD}s) & safe BW (${Math.round(safeBandwidthKbps)} Kbps >= ${candidate.bitrateKbps} Kbps) — upshift to ${candidate.label}`,
      safeBandwidthKbps: Math.round(safeBandwidthKbps),
      spec: candidate
    };
  }

  // 4. Steady state – hold current level
  let steadyDetail = `Buffer in steady zone (${buf.toFixed(1)}s)`;
  if (buf < BUFFER_LOW_THRESHOLD && safeLevel === 0) {
    steadyDetail = `Buffer critical (${buf.toFixed(1)}s), but already at lowest rendition (${currentSpec.label})`;
  } else if (safeLevel >= maxLevel) {
    steadyDetail = `Buffer optimal (${buf.toFixed(1)}s) — at peak rendition (${currentSpec.label})`;
  } else if (highestSustainable <= safeLevel) {
    const nextCandidate = ladder[Math.min(maxLevel, safeLevel + 1)];
    steadyDetail = `Buffer in steady zone (${buf.toFixed(1)}s), but safe BW (${Math.round(safeBandwidthKbps)} Kbps) < next tier (${nextCandidate?.bitrateKbps || '--'} Kbps)`;
  } else {
    steadyDetail = `Buffer building (${buf.toFixed(1)}s < ${BUFFER_UP_THRESHOLD}s) — holding ${currentSpec.label} until buffer stabilizes`;
  }

  return {
    nextLevel: safeLevel,
    reason: 'STEADY_STATE_HOLD',
    reasonDetail: steadyDetail,
    safeBandwidthKbps: Math.round(safeBandwidthKbps),
    spec: currentSpec
  };
}

module.exports = {
  QUALITY_LADDER,
  ABR_INTERVAL_MS,
  BUFFER_LOW_THRESHOLD,
  BUFFER_HIGH_THRESHOLD,
  BUFFER_UP_THRESHOLD,
  BANDWIDTH_SAFETY,
  calculateSafeBandwidth,
  getHighestSustainableLevel,
  recommendQuality
};
