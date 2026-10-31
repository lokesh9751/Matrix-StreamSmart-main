/**
 * models/VideoSample.js – Compatibility wrapper for models/Video.js
 *
 * Exposes the legacy VideoSample interface while directing all operations
 * to the Mongoose Video model and MongoDB collection.
 */

const mongoose = require('mongoose');
const Video = require('./Video');
const fallback = require('../utils/inMemoryFallbackStore');

class VideoSample {
  static async findAll() {
    return Video.findAll();
  }

  static async findById(videoId) {
    return Video.findByIdOrLegacy(videoId);
  }

  static async create({ title, streamUrl, availableTiers = '240p,360p,480p,720p,1080p', durationSec = 60, description = '' }) {
    return Video.createVideo({
      title,
      description,
      streamUrl,
      mp4Url: streamUrl.replace(/\.m3u8$/, '.mp4'),
      hlsPlaylistUrl: streamUrl,
      availableTiers,
      durationSec
    });
  }

  static async update(videoId, { title, streamUrl, availableTiers, durationSec, isActive }) {
    if (mongoose.connection.readyState === 1) {
      try {
        const updateDoc = {};
        if (title !== undefined) updateDoc.title = title;
        if (streamUrl !== undefined) {
          updateDoc.stream_url = streamUrl;
          updateDoc.hlsPlaylistUrl = streamUrl;
        }
        if (availableTiers !== undefined) updateDoc.available_tiers = availableTiers;
        if (durationSec !== undefined) {
          updateDoc.duration_sec = durationSec;
          updateDoc.duration = durationSec;
        }
        if (isActive !== undefined) updateDoc.is_active = isActive;

        let doc = null;
        if (mongoose.isValidObjectId(videoId)) {
          doc = await Video.findByIdAndUpdate(videoId, updateDoc, { new: true });
        } else {
          doc = await Video.findOneAndUpdate({ video_id: Number(videoId) }, updateDoc, { new: true });
        }
        if (doc) {
          return Video.findByIdOrLegacy(videoId);
        }
      } catch (err) {
        console.warn('[VideoSample.update] MongoDB update failed, using fallback store:', err.message);
      }
    }
    return fallback.updateVideo(videoId, { title, streamUrl, availableTiers, durationSec, isActive });
  }

  static async delete(videoId) {
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.isValidObjectId(videoId)) {
          await Video.findByIdAndUpdate(videoId, { is_active: false });
        } else {
          await Video.findOneAndUpdate({ video_id: Number(videoId) }, { is_active: false });
        }
        return;
      } catch (err) {
        console.warn('[VideoSample.delete] MongoDB delete failed, using fallback store:', err.message);
      }
    }
    fallback.deleteVideo(videoId);
  }
}

module.exports = VideoSample;
