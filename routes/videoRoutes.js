/**
 * routes/videoRoutes.js – Video Management, Chunked Cloudinary Upload & HLS Pipeline
 *
 * Implements:
 *  1. POST /api/video/upload: Multer staging + Cloudinary chunked upload_large (6MB) + auto HLS pipeline
 *  2. GET  /api/video/stream/:id: HTTP 206 Partial Content byte-range streaming fallback & Cloudinary redirect
 *  3. GET  /api/video: List all video entries
 *  4. GET  /api/video/:id: Fetch specific video entry
 *  5. DELETE /api/video/:id: Deactivate video entry
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Video = require('../models/Video');

// Ensure temporary staging directory exists
const tempUploadDir = path.resolve(__dirname, '../uploads/temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|mkv|mov|avi|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MKV, MOV, WEBM) are supported.'));
    }
  }
});

// ── 1. Chunked Video Upload & Auto-HLS Pipeline ─────────────────────────────
// POST /api/video/upload
router.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file uploaded' });
  }

  const filePath = req.file.path;

  // Verify Cloudinary credentials before initiating upload
  if (!cloudinary.credentials?.isConfigured) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid or placeholder Cloudinary credentials in .env. Please set valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      details: 'Log into https://console.cloudinary.com -> Copy credentials from "Product Environment Credentials" on your Dashboard.'
    });
  }

  try {
    // Upload the MP4 to Cloudinary in chunks using upload_large() wrapped in a Promise
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        filePath,
        {
          resource_type: 'video',
          folder: 'streamsmart_videos',
          chunk_size: 6000000, // 6MB chunks
          eager: [{ streaming_profile: 'hd', format: 'm3u8' }],
          eager_async: true
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });

    // Delete the local temporary file immediately after successful upload
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`[Video Upload] Could not remove temp file ${filePath}:`, err.message);
      }
    }

    // Extract streaming and media URLs
    const mp4Url = uploadResult.secure_url;
    const hlsPlaylistUrl =
      uploadResult.eager?.[0]?.secure_url || uploadResult.secure_url.replace(/\.mp4$/, '.m3u8');
    const thumbnailUrl = uploadResult.secure_url.replace(/\.mp4$/, '.jpg');

    // Extract title, description, and available tiers from request
    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, '');
    const description = req.body.description || '';
    const availableTiers = req.body.availableTiers || '240p,360p,480p,720p,1080p';
    const duration = uploadResult.duration ? Math.round(uploadResult.duration) : 60;
    const fileSize = uploadResult.bytes || req.file.size || 0;
    const uniqueVideoId = Math.floor(Date.now() % 10000000);

    // Save video document via unified persistent model (MongoDB + persistent disk fallback)
    const videoRecord = await Video.createVideo({
      videoId: uniqueVideoId,
      video_id: uniqueVideoId,
      title,
      description,
      cloudinaryPublicId: uploadResult.public_id,
      mp4Url,
      hlsPlaylistUrl,
      thumbnailUrl,
      fileSize,
      duration,
      durationSec: duration,
      duration_sec: duration,
      status: 'ready',
      stream_url: hlsPlaylistUrl,
      available_tiers: availableTiers,
      availableTiers,
      is_active: true,
      category: 'Uploaded Streams',
      badge: 'Cloudinary HLS',
      is_uploaded: true
    });

    const finalVideo = {
      video_id: videoRecord.video_id || videoRecord.videoId || uniqueVideoId,
      id: videoRecord.video_id || videoRecord.videoId || uniqueVideoId,
      title: videoRecord.title || title,
      description: videoRecord.description || description,
      cloudinaryPublicId: uploadResult.public_id,
      mp4Url,
      hlsPlaylistUrl,
      stream_url: hlsPlaylistUrl,
      streamUrl: hlsPlaylistUrl,
      thumbnailUrl,
      thumbnail_url: thumbnailUrl,
      available_tiers: availableTiers,
      availableTiers,
      duration_sec: duration,
      duration,
      fileSize,
      category: 'Uploaded Streams',
      badge: 'Cloudinary HLS',
      is_uploaded: true
    };

    return res.status(201).json({
      success: true,
      message: 'Video successfully uploaded and queued for adaptive HLS transcoding',
      video: finalVideo
    });
  } catch (error) {
    // Delete temporary file on error
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn(`[Video Upload Error] Could not clean temp file ${filePath}:`, unlinkErr.message);
      }
    }

    console.error('[Video Upload Error]:', error.message || error);

    if (error.message && error.message.includes('Invalid Signature')) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ Cloudinary Signature Mismatch:');
      console.error('   Your CLOUDINARY_API_SECRET in .env does not match the CLOUDINARY_API_KEY/CLOUD_NAME.');
      console.error('   Go to https://console.cloudinary.com -> Dashboard -> Copy real API Secret.');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload video to Cloudinary'
    });
  }
});

// ── 2. Local HTTP 206 Byte-Range Fallback & Cloudinary Stream Route ─────────
// GET /api/video/stream/:id
router.get('/stream/:id', async (req, res) => {
  try {
    const video = await Video.findByIdOrLegacy(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    // Check if a local file exists (e.g. staged video or local test asset)
    const possibleLocalPaths = [
      video.localFilePath,
      path.join(tempUploadDir, `${req.params.id}.mp4`),
      path.join(__dirname, '../uploads', `${req.params.id}.mp4`)
    ].filter(Boolean);

    const localFile = possibleLocalPaths.find(p => fs.existsSync(p));

    if (localFile) {
      const stat = fs.statSync(localFile);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(localFile, { start, end });

        const headers = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4'
        };

        res.writeHead(206, headers);
        return fileStream.pipe(res);
      } else {
        const headers = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes'
        };

        res.writeHead(200, headers);
        return fs.createReadStream(localFile).pipe(res);
      }
    }

    // Otherwise redirect cleanly to the Cloudinary stream URL
    const targetUrl = video.mp4Url || video.hlsPlaylistUrl || video.stream_url;
    if (!targetUrl) {
      return res.status(404).json({ success: false, error: 'No media stream URL available for this video' });
    }

    return res.redirect(302, targetUrl);
  } catch (error) {
    console.error('[Stream Error]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── 3. List All Videos (Supports EJS view rendering & JSON API) ─────────────
// GET /videos, GET /benchmark, GET /api/videos, GET /api/video
const fetchAllVideosHandler = async (req, res) => {
  try {
    let videos = [];
    if (mongoose.connection.readyState === 1 && Video.find) {
      try {
        const docs = await Video.find({ is_active: { $ne: false } }).sort({ createdAt: -1, _id: -1 });
        if (docs && docs.length > 0) {
          videos = docs.map(d => (d.toObject ? d.toObject({ virtuals: true }) : d));
        }
      } catch (err) {
        console.warn('[Video.find] Query failed, falling back to Video.findAll():', err.message);
      }
    }

    if (!videos || videos.length === 0) {
      videos = await Video.findAll();
    }

    // Ensure sorted by createdAt descending (newest first)
    videos.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Normalize attributes for EJS template and frontend JSON consumers
    const formattedVideos = videos.map(v => {
      const createdAtDate = v.createdAt ? new Date(v.createdAt) : new Date();
      const formattedDate = !isNaN(createdAtDate.getTime())
        ? createdAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recently Added';

      const thumb = v.thumbnailUrl || v.thumbnail_url || (v.mp4Url ? v.mp4Url.replace(/\.mp4$/, '.jpg') : '');
      const hls = v.hlsPlaylistUrl || v.stream_url || v.mp4Url;
      const mp4 = v.mp4Url || v.stream_url;

      return {
        ...v,
        video_id: v.video_id || v._id,
        title: v.title || 'Untitled Stream',
        description: v.description || '',
        thumbnailUrl: thumb,
        thumbnail_url: thumb,
        hlsPlaylistUrl: hls,
        stream_url: hls,
        mp4Url: mp4,
        duration: v.duration || v.duration_sec || 60,
        duration_sec: v.duration || v.duration_sec || 60,
        createdAt: createdAtDate,
        formattedDate
      };
    });

    // If client accepts HTML (browser navigation to /videos or /benchmark), render EJS view!
    const isBrowserNavigation = req.accepts('html') && !req.xhr && !req.headers.accept?.includes('application/json');
    if (isBrowserNavigation) {
      return res.render('benchmark', {
        videos: formattedVideos,
        pageTitle: 'StreamSmart – Benchmark Video Showcase'
      });
    }

    // Otherwise return clean JSON array for fetch() / API calls
    return res.json({
      success: true,
      videosCount: formattedVideos.length,
      videos: formattedVideos
    });
  } catch (error) {
    console.error('[Fetch Videos Error]:', error.message);
    if (req.accepts('html') && !req.xhr) {
      return res.render('benchmark', {
        videos: [],
        error: error.message,
        pageTitle: 'StreamSmart – Benchmark Video Showcase'
      });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.get('/', fetchAllVideosHandler);
router.get('/benchmark', fetchAllVideosHandler);

// ── 4. Get Video Details ────────────────────────────────────────────────────
// GET /api/video/:id
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findByIdOrLegacy(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 5. Delete / Deactivate Video ────────────────────────────────────────────
// DELETE /api/video/:id
router.delete('/:id', async (req, res) => {
  try {
    const video = await Video.findByIdOrLegacy(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    if (video.cloudinaryPublicId && !video.cloudinaryPublicId.startsWith('vid_')) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: 'video' });
      } catch (cErr) {
        console.warn(`[Cloudinary destroy error]:`, cErr.message);
      }
    }

    const VideoSample = require('../models/VideoSample');
    await VideoSample.delete(req.params.id);

    res.json({ success: true, message: 'Video deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
