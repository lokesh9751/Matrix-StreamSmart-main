const db = require('../config/db');
const fallback = require('../utils/inMemoryFallbackStore');

class VideoSample {
  static async findAll() {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM video_samples WHERE is_active = TRUE ORDER BY video_id'
      );
      return rows;
    } catch (err) {
      console.warn('[VideoSample.findAll] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getVideos().filter(v => v.is_active);
    }
  }

  static async findById(videoId) {
    try {
      const [rows] = await db.execute('SELECT * FROM video_samples WHERE video_id = ?', [videoId]);
      return rows[0] || null;
    } catch (err) {
      console.warn('[VideoSample.findById] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getVideoById(videoId);
    }
  }

  static async create({ title, streamUrl, availableTiers = '240p,360p,480p,720p,1080p', durationSec = 60 }) {
    try {
      const [result] = await db.execute(
        'INSERT INTO video_samples (title, stream_url, available_tiers, duration_sec) VALUES (?, ?, ?, ?)',
        [title, streamUrl, availableTiers, durationSec]
      );
      return { videoId: result.insertId, title, streamUrl, availableTiers, durationSec };
    } catch (err) {
      console.warn('[VideoSample.create] MySQL unavailable, using fallback store:', err.code || err.message);
      const v = fallback.addVideo({ title, streamUrl, availableTiers, durationSec });
      return { videoId: v.video_id, ...v };
    }
  }

  static async update(videoId, { title, streamUrl, availableTiers, durationSec, isActive }) {
    try {
      const fields = [];
      const values = [];
      if (title !== undefined)         { fields.push('title = ?');            values.push(title); }
      if (streamUrl !== undefined)     { fields.push('stream_url = ?');       values.push(streamUrl); }
      if (availableTiers !== undefined){ fields.push('available_tiers = ?');  values.push(availableTiers); }
      if (durationSec !== undefined)   { fields.push('duration_sec = ?');     values.push(durationSec); }
      if (isActive !== undefined)      { fields.push('is_active = ?');        values.push(isActive ? 1 : 0); }
      if (fields.length === 0) return null;
      values.push(videoId);
      await db.execute(`UPDATE video_samples SET ${fields.join(', ')} WHERE video_id = ?`, values);
      return VideoSample.findById(videoId);
    } catch (err) {
      console.warn('[VideoSample.update] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.updateVideo(videoId, { title, streamUrl, availableTiers, durationSec, isActive });
    }
  }

  static async delete(videoId) {
    try {
      await db.execute('UPDATE video_samples SET is_active = FALSE WHERE video_id = ?', [videoId]);
    } catch (err) {
      console.warn('[VideoSample.delete] MySQL unavailable, using fallback store:', err.code || err.message);
      fallback.deleteVideo(videoId);
    }
  }
}

module.exports = VideoSample;
