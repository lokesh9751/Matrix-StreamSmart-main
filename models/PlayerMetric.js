/**
 * models/PlayerMetric.js – Mongoose Player Metric Model
 *
 * Stores comparative benchmark results per session for both BASELINE and OPTIMIZED players:
 * startup delay, rebuffering frequency, total stall time, average bitrate, and cache hit metrics.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const playerMetricSchema = new mongoose.Schema(
  {
    metric_id: {
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
    startup_delay_ms: {
      type: Number,
      default: 0
    },
    stall_count: {
      type: Number,
      default: 0
    },
    total_stall_duration_sec: {
      type: Number,
      default: 0.0
    },
    avg_bitrate_kbps: {
      type: Number,
      default: 0
    },
    quality_switches: {
      type: Number,
      default: 0
    },
    cache_hits: {
      type: Number,
      default: 0
    },
    cache_misses: {
      type: Number,
      default: 0
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

playerMetricSchema.index({ session_id: 1, player_type: 1 }, { unique: true });

playerMetricSchema.pre('save', function (next) {
  if (!this.metric_id) {
    this.metric_id = Math.floor(Date.now() % 10000000);
  }
  next();
});

const PlayerMetricModel = mongoose.models.PlayerMetric || mongoose.model('PlayerMetric', playerMetricSchema);

class PlayerMetric {
  static get model() {
    return PlayerMetricModel;
  }

  static async findBySession(sessionId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const rows = await PlayerMetricModel.find({ session_id: Number(sessionId) })
          .sort({ player_type: 1 })
          .lean();

        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn('[PlayerMetric.findBySession] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getMetricsBySession(sessionId);
  }

  static async upsert(sessionId, playerType, metrics) {
    const {
      startupDelayMs = 0,
      stallCount = 0,
      totalStallDurationSec = 0,
      avgBitrateKbps = 0,
      qualitySwitches = 0,
      cacheHits = 0,
      cacheMisses = 0
    } = metrics;

    const updateDoc = {
      startup_delay_ms: startupDelayMs,
      stall_count: stallCount,
      total_stall_duration_sec: totalStallDurationSec,
      avg_bitrate_kbps: avgBitrateKbps,
      quality_switches: qualitySwitches,
      cache_hits: cacheHits,
      cache_misses: cacheMisses
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const sid = Number(sessionId);
        await PlayerMetricModel.findOneAndUpdate(
          { session_id: sid, player_type: playerType },
          {
            $set: updateDoc,
            $setOnInsert: {
              metric_id: Math.floor(Date.now() % 10000000),
              created_at: new Date()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return;
      } catch (err) {
        console.warn('[PlayerMetric.upsert] MongoDB error, using fallback store:', err.message);
      }
    }

    fallback.upsertMetric(sessionId, playerType, metrics);
  }
}

PlayerMetric.Schema = playerMetricSchema;
PlayerMetric.Model = PlayerMetricModel;

module.exports = PlayerMetric;
