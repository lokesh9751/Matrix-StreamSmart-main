/**
 * models/TestSession.js – Mongoose Test Session Model
 *
 * Manages benchmark execution sessions, tracking network scenarios,
 * chosen video streams, and session lifecycle statuses.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');
const Video = require('./Video');
const NetworkProfile = require('./NetworkProfile');
const User = require('./User');

const testSessionSchema = new mongoose.Schema(
  {
    session_id: {
      type: Number,
      unique: true,
      index: true
    },
    user_id: {
      type: Number,
      default: 1
    },
    video_id: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    profile_id: {
      type: Number,
      default: null
    },
    sim_bandwidth_kbps: {
      type: Number,
      required: true
    },
    sim_latency_ms: {
      type: Number,
      required: true
    },
    sim_cache_hit_prob: {
      type: Number,
      required: true
    },
    measurement_mode: {
      type: String,
      enum: ['SIMULATED', 'REAL_BROWSER'],
      default: 'SIMULATED'
    },
    test_duration_sec: {
      type: Number,
      default: 30
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'stopped'],
      default: 'running'
    },
    video_title: {
      type: String,
      default: ''
    },
    stream_url: {
      type: String,
      default: ''
    },
    profile_name: {
      type: String,
      default: ''
    },
    username: {
      type: String,
      default: ''
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

testSessionSchema.pre('save', function (next) {
  if (!this.session_id) {
    this.session_id = Math.floor(Date.now() % 10000000);
  }
  next();
});

const TestSessionModel = mongoose.models.TestSession || mongoose.model('TestSession', testSessionSchema);

class TestSession {
  static get model() {
    return TestSessionModel;
  }

  static async create({
    userId, videoId, profileId, simBandwidthKbps, simLatencyMs, simCacheHitProb,
    measurementMode = 'SIMULATED', testDurationSec = 30
  }) {
    if (mongoose.connection.readyState === 1) {
      try {
        const session_id = Math.floor(Date.now() % 10000000);

        // Populate metadata snapshots
        let video_title = '';
        let stream_url = '';
        let profile_name = '';
        let username = '';

        if (videoId) {
          const v = await Video.findByIdOrLegacy(videoId);
          if (v) {
            video_title = v.title || '';
            stream_url = v.stream_url || v.hlsPlaylistUrl || '';
          }
        }
        if (profileId) {
          const p = await NetworkProfile.findById(profileId);
          if (p) profile_name = p.profile_name || '';
        }
        if (userId) {
          const u = await User.findById(userId);
          if (u) username = u.username || '';
        }

        const session = await TestSessionModel.create({
          session_id,
          user_id: userId || 1,
          video_id: videoId || null,
          profile_id: profileId || null,
          sim_bandwidth_kbps: simBandwidthKbps,
          sim_latency_ms: simLatencyMs,
          sim_cache_hit_prob: simCacheHitProb,
          measurement_mode: measurementMode,
          test_duration_sec: testDurationSec,
          status: 'running',
          video_title,
          stream_url,
          profile_name,
          username
        });

        return { sessionId: session.session_id };
      } catch (err) {
        console.warn('[TestSession.create] MongoDB error, using fallback store:', err.message);
      }
    }

    const s = fallback.createSession({
      userId, videoId, profileId, simBandwidthKbps, simLatencyMs, simCacheHitProb,
      measurementMode, testDurationSec
    });
    return { sessionId: s.session_id };
  }

  static async findAll({ limit = 50, offset = 0, profileId } = {}) {
    if (mongoose.connection.readyState === 1) {
      try {
        const filter = {};
        if (profileId) filter.profile_id = Number(profileId);

        const rows = await TestSessionModel.find(filter)
          .sort({ created_at: -1, createdAt: -1 })
          .skip(parseInt(offset, 10))
          .limit(parseInt(limit, 10))
          .lean();

        if (rows && rows.length > 0) {
          return rows.map(r => ({
            ...r,
            sessionId: r.session_id
          }));
        }
      } catch (err) {
        console.warn('[TestSession.findAll] MongoDB error, using fallback store:', err.message);
      }
    }

    let list = fallback.getSessions();
    if (profileId) {
      list = list.filter(s => s.profile_id === Number(profileId));
    }
    return list.slice(offset, offset + limit);
  }

  static async findById(sessionId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = [{ session_id: Number(sessionId) }];
        if (mongoose.isValidObjectId(sessionId)) query.push({ _id: sessionId });

        const session = await TestSessionModel.findOne({ $or: query }).lean();
        if (session) {
          return {
            ...session,
            sessionId: session.session_id
          };
        }
      } catch (err) {
        console.warn('[TestSession.findById] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getSessionById(sessionId);
  }

  static async updateStatus(sessionId, status) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = [{ session_id: Number(sessionId) }];
        if (mongoose.isValidObjectId(sessionId)) query.push({ _id: sessionId });
        await TestSessionModel.updateOne({ $or: query }, { $set: { status } });
        return;
      } catch (err) {
        console.warn('[TestSession.updateStatus] MongoDB error, using fallback store:', err.message);
      }
    }
    fallback.updateSessionStatus(sessionId, status);
  }

  static async count(profileId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const filter = {};
        if (profileId) filter.profile_id = Number(profileId);
        return await TestSessionModel.countDocuments(filter);
      } catch (err) {
        console.warn('[TestSession.count] MongoDB error, using fallback store:', err.message);
      }
    }

    let list = fallback.getSessions();
    if (profileId) list = list.filter(s => s.profile_id === Number(profileId));
    return list.length;
  }
}

TestSession.Schema = testSessionSchema;
TestSession.Model = TestSessionModel;

module.exports = TestSession;
