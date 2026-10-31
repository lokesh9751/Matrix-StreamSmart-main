/**
 * utils/eventLogger.js – Async Telemetry Writer via Mongoose
 *
 * Uses setImmediate() to schedule telemetry writes outside the current
 * event-loop tick, keeping the simulation path non-blocking.
 */

const PlaybackEvent = require('../models/PlaybackEvent');
const PlayerMetric = require('../models/PlayerMetric');

/**
 * Log a single playback event asynchronously.
 *
 * @param {object} eventPayload
 * @param {number} eventPayload.sessionId
 * @param {string} eventPayload.playerType   - 'BASELINE' | 'OPTIMIZED'
 * @param {string} eventPayload.eventType    - STARTUP | QUALITY_SWITCH | BUFFER_STALL | BUFFER_RESUME | SEGMENT_FETCH
 * @param {number} eventPayload.elapsedSec
 * @param {string} eventPayload.resolution
 * @param {number} eventPayload.bufferSec
 * @param {number} [eventPayload.delayMs]
 * @param {boolean} [eventPayload.isCacheHit]
 */
function logPlaybackEventAsync(eventPayload) {
  setImmediate(async () => {
    try {
      const {
        sessionId, playerType, eventType,
        elapsedSec, resolution, resolutionLabel, bufferSec, bufferLevelSec,
        delayMs, simulatedDelayMs, isCacheHit
      } = eventPayload;

      await PlaybackEvent.create({
        sessionId,
        playerType,
        eventType,
        elapsedSec: parseFloat(elapsedSec) || 0,
        resolutionLabel: resolutionLabel || resolution || 'unknown',
        bufferLevelSec: parseFloat(bufferLevelSec !== undefined ? bufferLevelSec : bufferSec) || 0,
        simulatedDelayMs: parseInt(simulatedDelayMs !== undefined ? simulatedDelayMs : delayMs, 10) || 0,
        isCacheHit: Boolean(isCacheHit)
      });
    } catch (err) {
      console.error('[eventLogger] Non-blocking telemetry log error:', err.message);
    }
  });
}

/**
 * Upsert aggregated player metrics for a session.
 */
async function upsertPlayerMetrics(sessionId, playerType, metrics) {
  try {
    await PlayerMetric.upsert(sessionId, playerType, metrics);
  } catch (err) {
    console.error('[eventLogger] upsertPlayerMetrics error:', err.message);
  }
}

module.exports = { logPlaybackEventAsync, upsertPlayerMetrics };
