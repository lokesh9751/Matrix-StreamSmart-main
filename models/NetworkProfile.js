/**
 * models/NetworkProfile.js – Mongoose Network Profile Model
 *
 * Defines simulated network conditions: bandwidth, latency, jitter,
 * packet loss, and edge cache hit probability.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const networkProfileSchema = new mongoose.Schema(
  {
    profile_id: {
      type: Number,
      unique: true,
      index: true
    },
    profile_name: {
      type: String,
      required: true,
      trim: true
    },
    bandwidth_kbps: {
      type: Number,
      required: true
    },
    latency_ms: {
      type: Number,
      required: true
    },
    packet_loss_pct: {
      type: Number,
      default: 0.0
    },
    cache_hit_prob: {
      type: Number,
      default: 0.5
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

networkProfileSchema.pre('save', function (next) {
  if (!this.profile_id) {
    this.profile_id = Math.floor(Date.now() % 1000000);
  }
  next();
});

// Virtuals for camelCase compatibility
networkProfileSchema.virtual('profileName').get(function () { return this.profile_name; });
networkProfileSchema.virtual('bandwidthKbps').get(function () { return this.bandwidth_kbps; });
networkProfileSchema.virtual('latencyMs').get(function () { return this.latency_ms; });
networkProfileSchema.virtual('packetLossPct').get(function () { return this.packet_loss_pct; });
networkProfileSchema.virtual('cacheHitProb').get(function () { return this.cache_hit_prob; });

const NetworkProfileModel = mongoose.models.NetworkProfile || mongoose.model('NetworkProfile', networkProfileSchema);

class NetworkProfile {
  static get model() {
    return NetworkProfileModel;
  }

  static async findAll() {
    if (mongoose.connection.readyState === 1) {
      try {
        const rows = await NetworkProfileModel.find().sort({ bandwidth_kbps: 1 }).lean();
        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn('[NetworkProfile.findAll] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getProfiles();
  }

  static async findById(profileId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = [{ profile_id: Number(profileId) }];
        if (mongoose.isValidObjectId(profileId)) query.push({ _id: profileId });
        const row = await NetworkProfileModel.findOne({ $or: query }).lean();
        if (row) return row;
      } catch (err) {
        console.warn('[NetworkProfile.findById] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getProfileById(profileId);
  }

  static async create({ profileName, bandwidthKbps, latencyMs, packetLossPct = 0, cacheHitProb = 0.5, profile_id }) {
    if (mongoose.connection.readyState === 1) {
      try {
        const profileId = profile_id || Math.floor(Date.now() % 1000000);
        const p = await NetworkProfileModel.create({
          profile_id: profileId,
          profile_name: profileName,
          bandwidth_kbps: bandwidthKbps,
          latency_ms: latencyMs,
          packet_loss_pct: packetLossPct,
          cache_hit_prob: cacheHitProb
        });
        const obj = p.toObject({ virtuals: true });
        return {
          profileId: obj.profile_id,
          profile_id: obj.profile_id,
          profileName: obj.profile_name,
          profile_name: obj.profile_name,
          bandwidthKbps: obj.bandwidth_kbps,
          bandwidth_kbps: obj.bandwidth_kbps,
          latencyMs: obj.latency_ms,
          latency_ms: obj.latency_ms,
          packetLossPct: obj.packet_loss_pct,
          packet_loss_pct: obj.packet_loss_pct,
          cacheHitProb: obj.cache_hit_prob,
          cache_hit_prob: obj.cache_hit_prob
        };
      } catch (err) {
        console.warn('[NetworkProfile.create] MongoDB error, using fallback store:', err.message);
      }
    }
    const p = fallback.addProfile({ profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb });
    return { profileId: p.profile_id, ...p };
  }

  static async update(profileId, data) {
    if (mongoose.connection.readyState === 1) {
      try {
        const updateDoc = {};
        const map = {
          profileName: 'profile_name',
          profile_name: 'profile_name',
          bandwidthKbps: 'bandwidth_kbps',
          bandwidth_kbps: 'bandwidth_kbps',
          latencyMs: 'latency_ms',
          latency_ms: 'latency_ms',
          packetLossPct: 'packet_loss_pct',
          packet_loss_pct: 'packet_loss_pct',
          cacheHitProb: 'cache_hit_prob',
          cache_hit_prob: 'cache_hit_prob'
        };

        for (const [key, col] of Object.entries(map)) {
          if (data[key] !== undefined) {
            updateDoc[col] = data[key];
          }
        }

        const query = [{ profile_id: Number(profileId) }];
        if (mongoose.isValidObjectId(profileId)) query.push({ _id: profileId });

        const updated = await NetworkProfileModel.findOneAndUpdate(
          { $or: query },
          { $set: updateDoc },
          { new: true }
        ).lean();

        if (updated) return updated;
      } catch (err) {
        console.warn('[NetworkProfile.update] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.updateProfile(profileId, data);
  }

  static async delete(profileId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = [{ profile_id: Number(profileId) }];
        if (mongoose.isValidObjectId(profileId)) query.push({ _id: profileId });
        await NetworkProfileModel.deleteOne({ $or: query });
        return;
      } catch (err) {
        console.warn('[NetworkProfile.delete] MongoDB error, using fallback store:', err.message);
      }
    }
    fallback.deleteProfile(profileId);
  }
}

NetworkProfile.Schema = networkProfileSchema;
NetworkProfile.Model = NetworkProfileModel;

module.exports = NetworkProfile;
