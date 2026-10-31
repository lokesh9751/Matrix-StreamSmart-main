const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { evaluateCache, getSessionStats, estimateLatencySaved } = require('../utils/cacheSimulator');
const { calculateSegmentDelay, simulatePacketLoss } = require('../utils/networkThrottler');
const { recommendQuality, QUALITY_LADDER } = require('../utils/abrEngine');
const { logPlaybackEventAsync } = require('../utils/eventLogger');

// GET /api/simulator – overview of simulator tools & quality ladder
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'StreamSmart Network & Edge-Cache Simulator',
    qualityLadder: QUALITY_LADDER,
    cacheDelaySpec: {
      hitMs: 12,
      missMs: 260,
      lruCapacity: 200
    },
    safetyMargin: '75% of available bandwidth',
    decisionIntervalMs: 1500,
    endpoints: {
      abr: 'POST /api/simulator/abr',
      segment: 'POST /api/simulator/segment',
      cacheStats: 'GET /api/simulator/cache-stats/:sessionId',
      qualityLadder: 'GET /api/simulator/quality-ladder',
      proxy: 'GET /api/simulator/proxy?url=...'
    }
  });
});

// POST /api/simulator/abr – get ABR quality recommendation
router.post('/abr', (req, res) => {
  try {
    const { currentLevel, bufferSec, bandwidthKbps, hlsLevels } = req.body;
    const result = recommendQuality({
      currentLevel: parseInt(currentLevel) || 0,
      bufferSec: parseFloat(bufferSec) || 0,
      bandwidthKbps: parseFloat(bandwidthKbps) || 1000,
      hlsLevels
    });
    res.json({ success: true, recommendation: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulator/segment – simulate segment fetch delay and cache lookup
router.post('/segment', (req, res) => {
  try {
    const {
      segmentUrl,
      bitrateKbps = 1400,
      bandwidthKbps = 4500,
      latencyMs = 65,
      cacheHitProb = 0.75,
      packetLossPct = 0,
      sessionId
    } = req.body;

    const segmentKey = segmentUrl || `seg_${Date.now()}`;

    // Packet loss check
    const dropped = simulatePacketLoss(packetLossPct);

    // Cache evaluation
    const { isCacheHit, cacheDelayMs } = evaluateCache(segmentKey, cacheHitProb, sessionId);

    // Transfer delay calculation
    const { transferTimeMs, jitterMs, totalSimulatedDelayMs } = calculateSegmentDelay({
      bitrateKbps: parseFloat(bitrateKbps),
      bandwidthKbps: parseFloat(bandwidthKbps),
      latencyMs: parseInt(latencyMs),
      cacheDelayMs
    });

    const result = {
      segmentKey,
      isCacheHit,
      cacheDelayMs,
      transferTimeMs,
      jitterMs,
      totalSimulatedDelayMs,
      dropped,
      note: 'SIMULATED – these are calculated delays, not measured network values'
    };

    // Async telemetry log if sessionId provided
    if (sessionId) {
      logPlaybackEventAsync({
        sessionId,
        playerType: req.body.playerType || 'BASELINE',
        eventType: 'SEGMENT_FETCH',
        elapsedSec: req.body.elapsedSec || 0,
        resolution: req.body.resolution || 'unknown',
        bufferSec: req.body.bufferSec || 0,
        delayMs: totalSimulatedDelayMs,
        isCacheHit
      });
    }

    res.json({ success: true, simulation: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulator/cache-stats/:sessionId – get cache stats for a session
router.get('/cache-stats/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = getSessionStats(sessionId);
    const latencySavedMs = estimateLatencySaved(stats.hits, stats.misses);
    res.json({
      sessionId,
      ...stats,
      latencySavedMs,
      note: 'SIMULATED cache statistics'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulator/quality-ladder – return the reference quality ladder
router.get('/quality-ladder', (req, res) => {
  res.json({ qualityLadder: QUALITY_LADDER });
});

// GET /api/simulator/proxy – media proxy endpoint
// Routes HLS segment requests through simulation layer
router.get('/proxy', async (req, res) => {
  try {
    const {
      url,
      bandwidthKbps = 4500,
      latencyMs = 65,
      cacheHitProb = 0.75,
      bitrateKbps = 1400,
      packetLossPct = 0,
      sessionId
    } = req.query;

    if (!url) return res.status(400).json({ error: 'url parameter required' });

    const segmentKey = url;
    const { isCacheHit, cacheDelayMs } = evaluateCache(segmentKey, cacheHitProb, sessionId);
    const { totalSimulatedDelayMs } = calculateSegmentDelay({
      bitrateKbps: parseFloat(bitrateKbps),
      bandwidthKbps: parseFloat(bandwidthKbps),
      latencyMs: parseInt(latencyMs),
      cacheDelayMs
    });

    // Simulate the delay
    await new Promise(resolve => setTimeout(resolve, Math.min(totalSimulatedDelayMs, 8000)));

    // Fetch the actual segment
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).send(`Upstream error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'video/mp2t';
    res.setHeader('content-type', contentType);
    res.setHeader('x-cache-hit', isCacheHit ? '1' : '0');
    res.setHeader('x-simulated-delay-ms', totalSimulatedDelayMs);
    res.setHeader('x-cache-delay-ms', cacheDelayMs);
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-expose-headers', 'x-cache-hit,x-simulated-delay-ms,x-cache-delay-ms');

    response.body.pipe(res);
  } catch (err) {
    console.error('[proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
