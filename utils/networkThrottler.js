/**
 * networkThrottler.js – Segment Transfer Delay Calculator
 *
 * Computes the simulated total delivery delay for one HLS media segment
 * based on configured network parameters.
 *
 * Formula:
 *   transferTimeMs = (segmentBits / (bandwidthKbps * 1000)) * 1000
 *   jitterMs       = random(0..maxJitter)
 *   totalDelayMs   = transferTimeMs + latencyMs + cacheDelayMs + jitterMs
 */

const SEGMENT_DURATION_SEC = 4;   // Typical HLS segment duration
const MAX_JITTER_MS        = 25;  // Upper bound for random jitter

/**
 * Simulate packet loss — returns true if the segment should be considered
 * dropped (caller decides how to handle: retry delay, etc.).
 */
function simulatePacketLoss(packetLossPct) {
  return Math.random() < (parseFloat(packetLossPct) / 100);
}

/**
 * Calculate simulated segment delivery delay.
 *
 * @param {object} params
 * @param {number} params.bitrateKbps    - Segment encoded bitrate in Kbps
 * @param {number} params.bandwidthKbps  - Simulated available bandwidth in Kbps
 * @param {number} params.latencyMs      - Configured one-way network latency in ms
 * @param {number} params.cacheDelayMs   - Cache hit (12ms) or miss (260ms) delay
 * @param {number} [params.segmentDurationSec] - Override segment duration (default 4s)
 * @returns {{ transferTimeMs, jitterMs, totalSimulatedDelayMs }}
 */
function calculateSegmentDelay({ bitrateKbps, bandwidthKbps, latencyMs, cacheDelayMs, segmentDurationSec }) {
  const duration    = segmentDurationSec || SEGMENT_DURATION_SEC;
  const segmentBits = bitrateKbps * 1000 * duration;
  const effectiveBW = Math.max(bandwidthKbps, 1) * 1000; // bps, minimum 1 kbps

  const transferTimeMs = Math.round((segmentBits / effectiveBW) * 1000);
  const jitterMs       = Math.floor(Math.random() * MAX_JITTER_MS);

  const totalSimulatedDelayMs = Math.round(
    transferTimeMs + parseInt(latencyMs || 0) + (cacheDelayMs || 0) + jitterMs
  );

  return { transferTimeMs, jitterMs, totalSimulatedDelayMs };
}

/**
 * Calculate buffer impact of a segment fetch.
 * Returns estimated stall probability given current buffer depth.
 *
 * @param {number} bufferSec           - Current player buffer depth in seconds
 * @param {number} totalDelayMs        - Simulated total fetch delay in ms
 * @param {number} [segmentDurationSec] - Segment duration (default 4s)
 */
function estimateStallRisk(bufferSec, totalDelayMs, segmentDurationSec) {
  const duration  = segmentDurationSec || SEGMENT_DURATION_SEC;
  const delayS    = totalDelayMs / 1000;
  // If download takes longer than remaining buffer, stall is likely
  const willStall = delayS > bufferSec;
  return { willStall, margin: parseFloat((bufferSec - delayS).toFixed(2)) };
}

module.exports = {
  SEGMENT_DURATION_SEC,
  MAX_JITTER_MS,
  simulatePacketLoss,
  calculateSegmentDelay,
  estimateStallRisk
};

