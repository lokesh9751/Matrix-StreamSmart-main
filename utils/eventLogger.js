/**
 * eventLogger.js – Async MySQL Telemetry Writer
 *
 * Uses setImmediate() to schedule telemetry writes outside the current
 * event-loop tick, keeping the simulation path non-blocking.
 */

const db = require('../config/db');

/**
 * Log a single playback event asynchronously to MySQL.
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
        elapsedSec, resolution, bufferSec,
        delayMs, isCacheHit
      } = eventPayload;

      await db.execute(
        `INSERT INTO playback_events
         (session_id, player_type, event_type, elapsed_sec, resolution_label, buffer_level_sec, simulated_delay_ms, is_cache_hit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          playerType,
          eventType,
          parseFloat(elapsedSec).toFixed(2),
          resolution || 'unknown',
          parseFloat(bufferSec).toFixed(2),
          parseInt(delayMs) || 0,
          isCacheHit ? 1 : 0
        ]
      );
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
    const {
      startupDelayMs = 0,
      stallCount = 0,
      totalStallDurationSec = 0,
      avgBitrateKbps = 0,
      qualitySwitches = 0,
      cacheHits = 0,
      cacheMisses = 0
    } = metrics;

    // Check if row exists
    const [rows] = await db.execute(
      'SELECT metric_id FROM player_metrics WHERE session_id = ? AND player_type = ?',
      [sessionId, playerType]
    );

    if (rows.length > 0) {
      await db.execute(
        `UPDATE player_metrics SET
          startup_delay_ms = ?,
          stall_count = ?,
          total_stall_duration_sec = ?,
          avg_bitrate_kbps = ?,
          quality_switches = ?,
          cache_hits = ?,
          cache_misses = ?
         WHERE session_id = ? AND player_type = ?`,
        [startupDelayMs, stallCount, totalStallDurationSec, avgBitrateKbps,
         qualitySwitches, cacheHits, cacheMisses, sessionId, playerType]
      );
    } else {
      await db.execute(
        `INSERT INTO player_metrics
         (session_id, player_type, startup_delay_ms, stall_count, total_stall_duration_sec,
          avg_bitrate_kbps, quality_switches, cache_hits, cache_misses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, playerType, startupDelayMs, stallCount, totalStallDurationSec,
         avgBitrateKbps, qualitySwitches, cacheHits, cacheMisses]
      );
    }
  } catch (err) {
    console.error('[eventLogger] upsertPlayerMetrics error:', err.message);
  }
}

module.exports = { logPlaybackEventAsync, upsertPlayerMetrics };

