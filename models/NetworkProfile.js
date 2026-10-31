const db = require('../config/db');
const fallback = require('../utils/inMemoryFallbackStore');

class NetworkProfile {
  static async findAll() {
    try {
      const [rows] = await db.execute('SELECT * FROM network_profiles ORDER BY bandwidth_kbps');
      return rows;
    } catch (err) {
      console.warn('[NetworkProfile.findAll] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getProfiles();
    }
  }

  static async findById(profileId) {
    try {
      const [rows] = await db.execute('SELECT * FROM network_profiles WHERE profile_id = ?', [profileId]);
      return rows[0] || null;
    } catch (err) {
      console.warn('[NetworkProfile.findById] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getProfileById(profileId);
    }
  }

  static async create({ profileName, bandwidthKbps, latencyMs, packetLossPct = 0, cacheHitProb = 0.5 }) {
    try {
      const [result] = await db.execute(
        `INSERT INTO network_profiles (profile_name, bandwidth_kbps, latency_ms, packet_loss_pct, cache_hit_prob)
         VALUES (?, ?, ?, ?, ?)`,
        [profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb]
      );
      return { profileId: result.insertId, profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb };
    } catch (err) {
      console.warn('[NetworkProfile.create] MySQL unavailable, using fallback store:', err.code || err.message);
      const p = fallback.addProfile({ profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb });
      return { profileId: p.profile_id, ...p };
    }
  }

  static async update(profileId, data) {
    try {
      const fields = [];
      const values = [];
      const map = {
        profileName:   'profile_name',
        bandwidthKbps: 'bandwidth_kbps',
        latencyMs:     'latency_ms',
        packetLossPct: 'packet_loss_pct',
        cacheHitProb:  'cache_hit_prob'
      };
      for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = ?`);
          values.push(data[key]);
        }
      }
      if (fields.length === 0) return null;
      values.push(profileId);
      await db.execute(`UPDATE network_profiles SET ${fields.join(', ')} WHERE profile_id = ?`, values);
      return NetworkProfile.findById(profileId);
    } catch (err) {
      console.warn('[NetworkProfile.update] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.updateProfile(profileId, data);
    }
  }

  static async delete(profileId) {
    try {
      await db.execute('DELETE FROM network_profiles WHERE profile_id = ?', [profileId]);
    } catch (err) {
      console.warn('[NetworkProfile.delete] MySQL unavailable, using fallback store:', err.code || err.message);
      fallback.deleteProfile(profileId);
    }
  }
}

module.exports = NetworkProfile;
