/**
 * models/Video.js – Mongoose Video Model & Controller Interface
 *
 * Stores video metadata, Cloudinary public IDs, direct MP4 URLs,
 * and adaptive HLS manifest (.m3u8) URLs generated via Cloudinary eager transformations.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      trim: true
    },
    mp4Url: {
      type: String,
      required: true,
      trim: true
    },
    hlsPlaylistUrl: {
      type: String,
      required: true,
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'failed'],
      default: 'ready'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    // Compatibility fields for existing UI & routes
    video_id: {
      type: Number,
      index: true
    },
    stream_url: {
      type: String
    },
    available_tiers: {
      type: String,
      default: '240p,360p,480p,720p,1080p'
    },
    duration_sec: {
      type: Number,
      default: 60
    },
    is_active: {
      type: Boolean,
      default: true
    },
    category: {
      type: String,
      default: 'General'
    },
    badge: {
      type: String,
      default: 'HD'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save hook to ensure compatibility fields are populated
videoSchema.pre('save', function (next) {
  if (!this.stream_url) {
    this.stream_url = this.hlsPlaylistUrl || this.mp4Url;
  }
  if (!this.duration_sec && this.duration) {
    this.duration_sec = Math.round(this.duration);
  }
  if (!this.video_id) {
    this.video_id = Math.floor(Date.now() % 1000000);
  }
  if (!this.thumbnail_url && this.thumbnailUrl) {
    this.thumbnail_url = this.thumbnailUrl;
  }
  next();
});

// Virtuals for legacy frontend compatibility
videoSchema.virtual('id').get(function () {
  return this.video_id || this._id;
});

videoSchema.virtual('thumbnail_url').get(function () {
  return this.thumbnailUrl || (this.mp4Url ? this.mp4Url.replace(/\.mp4$/, '.jpg') : '');
});

// Static helper methods for backwards compatibility with controller routes
videoSchema.statics.findAll = async function () {
  if (mongoose.connection.readyState === 1) {
    try {
      const docs = await this.find({ is_active: { $ne: false } }).sort({ createdAt: -1, _id: -1 });
      if (docs && docs.length > 0) {
        return docs.map(d => {
          const obj = d.toObject({ virtuals: true });
          return {
            ...obj,
            video_id: obj.video_id || obj._id,
            stream_url: obj.hlsPlaylistUrl || obj.stream_url || obj.mp4Url,
            thumbnail_url: obj.thumbnailUrl || obj.thumbnail_url,
            duration_sec: obj.duration || obj.duration_sec || 60
          };
        });
      }
    } catch (err) {
      console.warn('[Video.findAll] MongoDB query failed, using fallback store:', err.message);
    }
  }
  return fallback.getVideos().filter(v => v.is_active);
};

videoSchema.statics.findByIdOrLegacy = async function (videoId) {
  if (mongoose.connection.readyState === 1) {
    try {
      let doc = null;
      if (mongoose.isValidObjectId(videoId)) {
        doc = await this.findById(videoId);
      }
      if (!doc) {
        const numId = Number(videoId);
        if (!isNaN(numId)) {
          doc = await this.findOne({ video_id: numId });
        }
      }
      if (doc) {
        const obj = doc.toObject({ virtuals: true });
        return {
          ...obj,
          video_id: obj.video_id || obj._id,
          stream_url: obj.hlsPlaylistUrl || obj.stream_url || obj.mp4Url,
          thumbnail_url: obj.thumbnailUrl || obj.thumbnail_url,
          duration_sec: obj.duration || obj.duration_sec || 60
        };
      }
    } catch (err) {
      console.warn('[Video.findByIdOrLegacy] MongoDB query failed, using fallback store:', err.message);
    }
  }
  return fallback.getVideoById(videoId);
};

videoSchema.statics.createVideo = async function (data) {
  const mp4Url = data.mp4Url || data.streamUrl || data.stream_url || '';
  const hlsPlaylistUrl = data.hlsPlaylistUrl || (mp4Url.includes('.m3u8') ? mp4Url : mp4Url.replace(/\.mp4$/, '.m3u8'));
  const thumbnailUrl = data.thumbnailUrl || (mp4Url ? mp4Url.replace(/\.mp4$/, '.jpg') : '');
  const duration = data.duration || data.durationSec || data.duration_sec || 60;

  const docData = {
    title: data.title,
    description: data.description || '',
    cloudinaryPublicId: data.cloudinaryPublicId || `vid_${Date.now()}`,
    mp4Url,
    hlsPlaylistUrl,
    thumbnailUrl,
    fileSize: data.fileSize || 0,
    duration,
    status: data.status || 'ready',
    available_tiers: data.availableTiers || data.available_tiers || '240p,360p,480p,720p,1080p',
    duration_sec: duration,
    is_active: data.isActive !== undefined ? data.isActive : true,
    video_id: data.videoId || data.video_id || Math.floor(Date.now() % 1000000)
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const created = await this.create(docData);
      const obj = created.toObject({ virtuals: true });
      return {
        ...obj,
        videoId: obj.video_id || obj._id,
        video_id: obj.video_id || obj._id,
        streamUrl: obj.hlsPlaylistUrl,
        stream_url: obj.hlsPlaylistUrl
      };
    } catch (err) {
      console.warn('[Video.createVideo] MongoDB create failed, using fallback store:', err.message);
    }
  }

  const v = fallback.addVideo({
    title: docData.title,
    streamUrl: docData.hlsPlaylistUrl,
    availableTiers: docData.available_tiers,
    durationSec: docData.duration_sec
  });
  return { videoId: v.video_id, ...v };
};

const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);

module.exports = Video;
