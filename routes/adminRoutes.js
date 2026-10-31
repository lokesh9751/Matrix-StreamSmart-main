const express = require('express');
const router = express.Router();
const NetworkProfile = require('../models/NetworkProfile');
const VideoSample = require('../models/VideoSample');

// GET /api/admin – overview of admin configurations
router.get('/', async (req, res) => {
  try {
    const [profiles, videos] = await Promise.all([
      NetworkProfile.findAll(),
      VideoSample.findAll()
    ]);
    res.json({
      success: true,
      service: 'StreamSmart Admin Service',
      profilesCount: profiles.length,
      videosCount: videos.length,
      profiles,
      videos,
      endpoints: {
        profiles: 'GET,POST /api/admin/profiles',
        profileById: 'PUT,DELETE /api/admin/profiles/:id',
        videos: 'GET,POST /api/admin/videos',
        videoById: 'PUT,DELETE /api/admin/videos/:id'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Network Profiles ────────────────────────────────────────────────────────

// GET /api/admin/profiles
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await NetworkProfile.findAll();
    res.json({ profiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/profiles
router.post('/profiles', async (req, res) => {
  try {
    const { profileName, bandwidthKbps, latencyMs, packetLossPct = 0, cacheHitProb = 0.5 } = req.body;
    if (!profileName || !bandwidthKbps || latencyMs === undefined) {
      return res.status(400).json({ error: 'profileName, bandwidthKbps, and latencyMs are required' });
    }
    const profile = await NetworkProfile.create({ profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb });
    res.status(201).json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/profiles/:id
router.put('/profiles/:id', async (req, res) => {
  try {
    const profile = await NetworkProfile.update(req.params.id, req.body);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/profiles/:id
router.delete('/profiles/:id', async (req, res) => {
  try {
    await NetworkProfile.delete(req.params.id);
    res.json({ success: true, message: 'Profile deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Video Samples ───────────────────────────────────────────────────────────

// GET /api/admin/videos
router.get('/videos', async (req, res) => {
  try {
    const videos = await VideoSample.findAll();
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/videos
router.post('/videos', async (req, res) => {
  try {
    const { title, streamUrl, availableTiers, durationSec = 60 } = req.body;
    if (!title || !streamUrl) {
      return res.status(400).json({ error: 'title and streamUrl are required' });
    }
    if (!streamUrl.includes('.m3u8')) {
      return res.status(400).json({ error: 'streamUrl must be an HLS .m3u8 manifest' });
    }
    const video = await VideoSample.create({ title, streamUrl, availableTiers, durationSec });
    res.status(201).json({ success: true, video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/videos/:id
router.put('/videos/:id', async (req, res) => {
  try {
    const video = await VideoSample.update(req.params.id, req.body);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ success: true, video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/videos/:id
router.delete('/videos/:id', async (req, res) => {
  try {
    await VideoSample.delete(req.params.id);
    res.json({ success: true, message: 'Video deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

