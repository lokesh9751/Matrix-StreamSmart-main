/**
 * models/Video.js – Mongoose Schema & Persistent Video Model
 *
 * Implements complete MongoDB schema for StreamSmart videos with Cloudinary HLS support.
 * Also provides static compatibility methods mapping seamlessly between Mongoose documents,
 * persistent disk records, and frontend client expectations.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
      maxlength: [255, 'Video title cannot exceed 255 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: ''
    },
    mp4Url: {
      type: String,
      required: [true, 'MP4 URL is required'],
      trim: true
    },
    hlsPlaylistUrl: {
      type: String,
      required: [true, 'HLS playlist URL (.m3u8) is required'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      trim: true,
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
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'ready'
    },
    // Backwards compatibility fields
    video_id: {
      type: Number,
      index: true
    },
    stream_url: {
      type: String,
      trim: true
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
    },
    is_uploaded: {
      type: Boolean,
      default: false
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
  let dbVideos = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const docs = await this.find({ is_active: { $ne: false } }).sort({ createdAt: -1, _id: -1 });
      if (docs && docs.length > 0) {
        dbVideos = docs.map(d => {
          const obj = d.toObject({ virtuals: true });
          const streamUrl = obj.hlsPlaylistUrl || obj.stream_url || obj.mp4Url;
          return {
            ...obj,
            video_id: obj.video_id || obj._id,
            id: obj.video_id || obj._id,
            stream_url: streamUrl,
            hlsPlaylistUrl: streamUrl,
            thumbnail_url: obj.thumbnailUrl || obj.thumbnail_url,
            thumbnailUrl: obj.thumbnailUrl || obj.thumbnail_url,
            duration_sec: obj.duration || obj.duration_sec || 60,
            category: obj.category || (obj.is_uploaded ? 'Uploaded Streams' : 'General'),
            badge: obj.badge || (obj.is_uploaded ? 'Cloudinary HLS' : 'HD'),
            is_uploaded: Boolean(obj.is_uploaded || obj.cloudinaryPublicId)
          };
        });
      }
    } catch (err) {
      console.warn('[Video.findAll] MongoDB query failed:', err.message);
    }
  }

  // Also load fallback & disk-persisted videos
  const fallbackVideos = fallback.getVideos().filter(v => v.is_active);

  // Merge unique by video_id, cloudinaryPublicId, stream_url, or normalized title
  const seenIds = new Set();
  const seenPublicIds = new Set();
  const seenUrls = new Set();
  const seenTitles = new Set();
  const merged = [];

  const allCandidates = [...dbVideos, ...fallbackVideos];
  for (const v of allCandidates) {
    const idKey = String(v.video_id || v.id || v._id || '');
    const pubId = v.cloudinaryPublicId ? String(v.cloudinaryPublicId).trim() : '';
    const rawUrl = v.hlsPlaylistUrl || v.stream_url || v.mp4Url || '';
    const normUrl = rawUrl.replace(/[\?#].*$/, '').toLowerCase();
    const normTitle = (v.title || '').trim().toLowerCase();

    // Deduplicate against multiple keys to prevent any duplicate streams in catalog
    if (pubId && seenPublicIds.has(pubId)) continue;
    if (normUrl && seenUrls.has(normUrl)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;
    if (idKey && seenIds.has(idKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (pubId) seenPublicIds.add(pubId);
    if (normUrl) seenUrls.add(normUrl);
    if (normTitle) seenTitles.add(normTitle);

    const streamUrl = v.hlsPlaylistUrl || v.stream_url || v.mp4Url;
    const thumb = v.thumbnail_url || v.thumbnailUrl || (v.mp4Url ? v.mp4Url.replace(/\.mp4$/, '.jpg') : '');
    merged.push({
      ...v,
      video_id: v.video_id || v.id || v._id,
      id: v.video_id || v.id || v._id,
      stream_url: streamUrl,
      hlsPlaylistUrl: streamUrl,
      streamUrl,
      mp4Url: v.mp4Url || streamUrl,
      thumbnail_url: thumb,
      thumbnailUrl: thumb,
      duration_sec: v.duration_sec || v.duration || 60,
      category: v.category || (v.is_uploaded ? 'Uploaded Streams' : 'General'),
      badge: v.badge || (v.is_uploaded ? 'Cloudinary HLS' : 'HD'),
      is_uploaded: Boolean(v.is_uploaded || v.cloudinaryPublicId),
      cloudinaryPublicId: pubId || v.cloudinaryPublicId || ''
    });
  }

  return merged;
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
        const streamUrl = obj.hlsPlaylistUrl || obj.stream_url || obj.mp4Url;
        return {
          ...obj,
          video_id: obj.video_id || obj._id,
          id: obj.video_id || obj._id,
          stream_url: streamUrl,
          hlsPlaylistUrl: streamUrl,
          streamUrl,
          thumbnail_url: obj.thumbnailUrl || obj.thumbnail_url,
          thumbnailUrl: obj.thumbnailUrl || obj.thumbnail_url,
          duration_sec: obj.duration || obj.duration_sec || 60
        };
      }
    } catch (err) {
      console.warn('[Video.findByIdOrLegacy] MongoDB query failed:', err.message);
    }
  }
  return fallback.getVideoById(videoId);
};

videoSchema.statics.createVideo = async function (data) {
  const mp4Url = data.mp4Url || data.streamUrl || data.stream_url || '';
  const hlsPlaylistUrl = data.hlsPlaylistUrl || (mp4Url.includes('.m3u8') ? mp4Url : mp4Url.replace(/\.mp4$/, '.m3u8'));
  const thumbnailUrl = data.thumbnailUrl || (mp4Url ? mp4Url.replace(/\.mp4$/, '.jpg') : '');
  const duration = data.duration || data.durationSec || data.duration_sec || 60;
  const numId = data.videoId || data.video_id || Math.floor(Date.now() % 1000000);

  const docData = {
    title: data.title || 'Untitled Stream',
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
    video_id: numId,
    category: data.category || 'Uploaded Streams',
    badge: data.badge || 'Cloudinary HLS',
    is_uploaded: true
  };

  let savedObj = null;
  if (mongoose.connection.readyState === 1) {
    try {
      const created = await this.create(docData);
      savedObj = created.toObject ? created.toObject({ virtuals: true }) : created;
    } catch (err) {
      console.warn('[Video.createVideo] MongoDB create failed, writing to persistent disk fallback:', err.message);
    }
  }

  // Always write to persistent disk fallback store so metadata is never lost
  const fallbackItem = fallback.addVideo({
    videoId: numId,
    title: docData.title,
    streamUrl: docData.hlsPlaylistUrl,
    mp4Url: docData.mp4Url,
    thumbnailUrl: docData.thumbnailUrl,
    availableTiers: docData.available_tiers,
    durationSec: docData.duration_sec,
    category: docData.category,
    badge: docData.badge,
    isUploaded: true,
    cloudinaryPublicId: docData.cloudinaryPublicId
  });

  return savedObj ? { ...savedObj, videoId: numId, video_id: numId, streamUrl: hlsPlaylistUrl } : fallbackItem;
};

videoSchema.statics.deleteByCloudinaryPublicId = async function (publicId) {
  if (!publicId) return { success: false, reason: 'No publicId provided' };
  let dbCount = 0;
  if (mongoose.connection.readyState === 1) {
    try {
      const res = await this.updateMany(
        {
          $or: [
            { cloudinaryPublicId: publicId },
            { hlsPlaylistUrl: { $regex: publicId, $options: 'i' } },
            { mp4Url: { $regex: publicId, $options: 'i' } }
          ]
        },
        { is_active: false, status: 'failed' }
      );
      dbCount = res.modifiedCount || 0;
    } catch (err) {
      console.warn('[Video.deleteByCloudinaryPublicId] MongoDB update error:', err.message);
    }
  }

  // Also deactivate in disk fallback
  const fallbackChanged = fallback.deleteVideoByCloudinaryPublicId(publicId);

  return { success: true, publicId, dbCount, fallbackChanged };
};

const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);

module.exports = Video;
