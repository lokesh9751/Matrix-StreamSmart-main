/**
 * models/PlaybackEvent.js – Mongoose Playback Event Model
 *
 * Persists granular time-series events recorded during benchmark playback:
 * STARTUP, QUALITY_SWITCH, BUFFER_STALL, BUFFER_RESUME, and SEGMENT_FETCH.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const playbackEventSchema = new mongoose.Schema(
  {
    event_id: {
      type: Number,
      index: true
    },
    session_id: {
      type: Number,
      required: true,
      index: true
    },
    player_type: {
      type: String,
      enum: ['BASELINE', 'OPTIMIZED'],
      required: true
    },
    event_type: {
      type: String,
      enum: ['STARTUP', 'QUALITY_SWITCH', 'BUFFER_STALL', 'BUFFER_RESUME', 'SEGMENT_FETCH'],
      required: true
    },
    elapsed_sec: {
      type: Number,
      default: 0.0
    },
    resolution_label: {
      type: String,
      default: 'unknown'
    },
    buffer_level_sec: {
      type: Number,
      default: 0.0
    },
    simulated_delay_ms: {
      type: Number,
      default: 0
    },
    is_cache_hit: {
      type: Boolean,
      default: false
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

playbackEventSchema.index({ session_id: 1, elapsed_sec: 1 });

playbackEventSchema.pre('save', function (next) {
  if (!this.event_id) {
    this.event_id = Math.floor(Date.now() % 10000000);
  }
  next();
});

const PlaybackEventModel = mongoose.models.PlaybackEvent || mongoose.model('PlaybackEvent', playbackEventSchema);

class PlaybackEvent {
  static get model() {
    return PlaybackEventModel;
  }

  static async findBySession(sessionId, playerType) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = { session_id: Number(sessionId) };
        if (playerType) query.player_type = playerType;

        const rows = await PlaybackEventModel.find(query).sort({ elapsed_sec: 1 }).lean();
        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn('[PlaybackEvent.findBySession] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getEventsBySession(sessionId, playerType);
  }

  static async create(eventData) {
    const {
      sessionId, playerType, eventType, elapsedSec,
      resolutionLabel = 'unknown', bufferLevelSec = 0,
      simulatedDelayMs = 0, isCacheHit = false
    } = eventData;

    const docData = {
      event_id: Math.floor(Date.now() % 10000000),
      session_id: Number(sessionId),
      player_type: playerType,
      event_type: eventType,
      elapsed_sec: parseFloat(elapsedSec) || 0,
      resolution_label: resolutionLabel || 'unknown',
      buffer_level_sec: parseFloat(bufferLevelSec) || 0,
      simulated_delay_ms: parseInt(simulatedDelayMs, 10) || 0,
      is_cache_hit: Boolean(isCacheHit)
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const created = await PlaybackEventModel.create(docData);
        return created.event_id;
      } catch (err) {
        console.warn('[PlaybackEvent.create] MongoDB error, using fallback store:', err.message);
      }
    }

    return fallback.addPlaybackEvent(eventData);
  }

  static async getTimeSeriesForChart(sessionId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const rows = await PlaybackEventModel.find({
          session_id: Number(sessionId),
          event_type: { $in: ['SEGMENT_FETCH', 'BUFFER_STALL', 'BUFFER_RESUME', 'QUALITY_SWITCH'] }
        })
          .sort({ elapsed_sec: 1 })
          .select('player_type elapsed_sec buffer_level_sec resolution_label simulated_delay_ms is_cache_hit')
          .lean();

        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn('[PlaybackEvent.getTimeSeriesForChart] MongoDB error, using fallback store:', err.message);
      }
    }

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

PlaybackEvent.Schema = playbackEventSchema;
PlaybackEvent.Model = PlaybackEventModel;

module.exports = PlaybackEvent;
