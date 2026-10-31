const db = require('../config/db');
const fallback = require('../utils/inMemoryFallbackStore');

class PlaybackEvent {
  static async findBySession(sessionId, playerType) {
    try {
      let query = `SELECT * FROM playback_events WHERE session_id = ?`;
      const params = [sessionId];
      if (playerType) {
        query += ' AND player_type = ?';
        params.push(playerType);
      }
      query += ' ORDER BY elapsed_sec ASC';
      const [rows] = await db.execute(query, params);
      return rows;
    } catch (err) {
      console.warn('[PlaybackEvent.findBySession] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getEventsBySession(sessionId, playerType);
    }
  }

  static async create(eventData) {
    const {
      sessionId, playerType, eventType, elapsedSec,
      resolutionLabel = 'unknown', bufferLevelSec = 0,
      simulatedDelayMs = 0, isCacheHit = false
    } = eventData;

    try {
      const [result] = await db.execute(
        `INSERT INTO playback_events
         (session_id, player_type, event_type, elapsed_sec, resolution_label,
          buffer_level_sec, simulated_delay_ms, is_cache_hit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, playerType, eventType, elapsedSec, resolutionLabel,
         bufferLevelSec, simulatedDelayMs, isCacheHit ? 1 : 0]
      );
      return result.insertId;
    } catch (err) {
      console.warn('[PlaybackEvent.create] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.addPlaybackEvent(eventData);
    }
  }

  static async getTimeSeriesForChart(sessionId) {
    try {
      const [rows] = await db.execute(
        `SELECT player_type, elapsed_sec, buffer_level_sec, resolution_label, simulated_delay_ms, is_cache_hit
         FROM playback_events
         WHERE session_id = ? AND event_type IN ('SEGMENT_FETCH', 'BUFFER_STALL', 'BUFFER_RESUME', 'QUALITY_SWITCH')
         ORDER BY elapsed_sec ASC`,
        [sessionId]
      );
      return rows;
    } catch (err) {
      console.warn('[PlaybackEvent.getTimeSeriesForChart] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getEventsBySession(sessionId).map(e => ({
        player_type: e.player_type,
        elapsed_sec: e.elapsed_sec,
        buffer_level_sec: e.buffer_level_sec,
        resolution_label: e.resolution_label,
        simulated_delay_ms: e.simulated_delay_ms,
        is_cache_hit: e.is_cache_hit
      }));
    }
  }
}

module.exports = PlaybackEvent;
