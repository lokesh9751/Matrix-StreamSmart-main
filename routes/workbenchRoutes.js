const express = require('express');
const router = express.Router();
const TestSession = require('../models/TestSession');
const PlayerMetric = require('../models/PlayerMetric');
const VideoSample = require('../models/VideoSample');
const NetworkProfile = require('../models/NetworkProfile');
const validateTestConfig = require('../middlewares/testValidator');
const { logPlaybackEventAsync } = require('../utils/eventLogger');
const { resetSession } = require('../utils/cacheSimulator');

// GET /api/workbench – overview of workbench resources
router.get('/', async (req, res) => {
  try {
    const [videos, profiles] = await Promise.all([
      VideoSample.findAll(),
      NetworkProfile.findAll()
    ]);
    res.json({
      success: true,
      service: 'StreamSmart Workbench API',
      videosCount: videos.length,
      profilesCount: profiles.length,
      videos,
      profiles,
      endpoints: {
        videos: 'GET /api/workbench/videos',
        profiles: 'GET /api/workbench/profiles',
        createSession: 'POST /api/workbench/sessions',
        stopSession: 'PATCH /api/workbench/sessions/:id/stop',
        saveMetrics: 'POST /api/workbench/sessions/:id/metrics',
        logEvents: 'POST /api/workbench/sessions/:id/events',
        sessionDetail: 'GET /api/workbench/sessions/:id'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workbench/videos – list available video samples
router.get('/videos', async (req, res) => {
  try {
    const videos = await VideoSample.findAll();
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workbench/profiles – list network profiles
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await NetworkProfile.findAll();
    res.json({ profiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workbench/sessions – create a new benchmark session
router.post('/sessions', validateTestConfig, async (req, res) => {
  try {
    const {
      userId, videoId, profileId,
      bandwidthKbps, latencyMs, cacheHitProb,
      measurementMode = 'SIMULATED',
      testDurationSec = 30,
      streamUrl
    } = req.body;

    const session = await TestSession.create({
      userId: userId || 1,
      videoId: videoId || null,
      profileId: profileId || null,
      simBandwidthKbps: parseInt(bandwidthKbps),
      simLatencyMs: parseInt(latencyMs),
      simCacheHitProb: parseFloat(cacheHitProb),
      measurementMode,
      testDurationSec: parseInt(testDurationSec)
    });

    // Reset cache stats for this session
    resetSession(session.sessionId);

    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      message: 'Benchmark session created'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workbench/sessions/:id/stop – mark session as completed/stopped
router.patch('/sessions/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'completed' } = req.body;
    await TestSession.updateStatus(id, status);
    res.json({ success: true, sessionId: id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workbench/sessions/:id/metrics – save player metrics
router.post('/sessions/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { playerType, metrics } = req.body;
    if (!playerType || !metrics) {
      return res.status(400).json({ error: 'playerType and metrics required' });
    }
    await PlayerMetric.upsert(id, playerType, metrics);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workbench/sessions/:id/events – log a playback event
router.post('/sessions/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = { sessionId: id, ...req.body };
    logPlaybackEventAsync(eventData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workbench/sessions/:id – get session details
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await TestSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
