const express = require('express');
const router = express.Router();
const db = require('../config/db');
const TestSession = require('../models/TestSession');
const PlayerMetric = require('../models/PlayerMetric');
const PlaybackEvent = require('../models/PlaybackEvent');
const fallback = require('../utils/inMemoryFallbackStore');
const { estimateLatencySaved } = require('../utils/cacheSimulator');

// Shared aggregate analytics summary handler (used by both GET / and GET /summary)
async function getAnalyticsSummary(req, res) {
  try {
    // 1. Session counts
    const [sessionRows] = await db.query(`
      SELECT 
        COUNT(*) AS totalSessions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedSessions,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS runningSessions
      FROM test_sessions
    `);
    const totalSessions = Number(sessionRows[0]?.totalSessions || 0);
    const completedSessions = Number(sessionRows[0]?.completedSessions || 0);
    const runningSessions = Number(sessionRows[0]?.runningSessions || 0);

    // 2. Aggregate metrics from player_metrics
    const [metricRows] = await db.query(`
      SELECT
        AVG(startup_delay_ms) AS avgStartupDelayMs,
        SUM(stall_count) AS totalStallCount,
        AVG(stall_count) AS avgStallCount,
        SUM(total_stall_duration_sec) AS totalRebufferSec,
        AVG(avg_bitrate_kbps) AS avgBitrateKbps,
        SUM(cache_hits) AS totalCacheHits,
        SUM(cache_misses) AS totalCacheMisses
      FROM player_metrics
    `);

    const m = metricRows[0] || {};
    const totalHits = Number(m.totalCacheHits || 0);
    const totalMisses = Number(m.totalCacheMisses || 0);
    const cacheRequests = totalHits + totalMisses;
    const cacheHitRate = cacheRequests > 0 ? Number(((totalHits / cacheRequests) * 100).toFixed(1)) : 0;

    // 3. Comparison breakdown by player_type (BASELINE vs OPTIMIZED)
    const [comparisonRows] = await db.query(`
      SELECT
        player_type,
        COUNT(*) AS totalRuns,
        ROUND(AVG(startup_delay_ms), 1) AS avgStartupDelayMs,
        SUM(stall_count) AS totalStalls,
        ROUND(AVG(stall_count), 2) AS avgStallsPerRun,
        ROUND(SUM(total_stall_duration_sec), 2) AS totalStallSec,
        ROUND(AVG(avg_bitrate_kbps), 0) AS avgBitrateKbps,
        ROUND(AVG(quality_switches), 1) AS avgQualitySwitches,
        SUM(cache_hits) AS totalCacheHits,
        SUM(cache_misses) AS totalCacheMisses
      FROM player_metrics
      GROUP BY player_type
    `);

    // 4. Recent sessions with video title and network profile
    const recentSessions = await TestSession.findAll({ limit: 6, offset: 0 });

    res.json({
      success: true,
      service: 'StreamSmart Analytics Service',
      storageEngine: 'mysql',
      totalSessions,
      completedSessions,
      runningSessions,
      avgStartupDelayMs: Math.round(Number(m.avgStartupDelayMs || 0)),
      totalStallCount: Number(m.totalStallCount || 0),
      avgStallsPerSession: Number((Number(m.avgStallCount || 0)).toFixed(2)),
      totalRebufferSec: Number((Number(m.totalRebufferSec || 0)).toFixed(1)),
      avgBitrateKbps: Math.round(Number(m.avgBitrateKbps || 0)),
      totalCacheHits: totalHits,
      totalCacheMisses: totalMisses,
      cacheHitRate,
      playerComparison: comparisonRows,
      recentSessions,
      endpoints: {
        summary: 'GET /api/analytics/summary',
        history: 'GET /api/analytics/history',
        sessionReport: 'GET /api/analytics/sessions/:id/report',
        sessionEvents: 'GET /api/analytics/sessions/:id/events'
      }
    });
  } catch (err) {
    console.warn('[AnalyticsSummary] MySQL unavailable, calculating summary from fallback store:', err.code || err.message);
    const sessions = fallback.getSessions();
    const metrics = fallback.getAllMetrics();

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'COMPLETED').length;
    const runningSessions = sessions.filter(s => s.status === 'running').length;

    let totalStalls = 0;
    let totalStartup = 0;
    let totalRebuffer = 0;
    let totalBitrate = 0;
    let totalHits = 0;
    let totalMisses = 0;

    metrics.forEach(m => {
      totalStalls += Number(m.stall_count || 0);
      totalStartup += Number(m.startup_delay_ms || 0);
      totalRebuffer += Number(m.total_stall_duration_sec || 0);
      totalBitrate += Number(m.avg_bitrate_kbps || 0);
      totalHits += Number(m.cache_hits || 0);
      totalMisses += Number(m.cache_misses || 0);
    });

    const mCount = metrics.length || 1;
    const cacheRequests = totalHits + totalMisses;
    const cacheHitRate = cacheRequests > 0 ? Number(((totalHits / cacheRequests) * 100).toFixed(1)) : 0;

    const baselineMetrics = metrics.filter(m => m.player_type === 'BASELINE');
    const optimizedMetrics = metrics.filter(m => m.player_type === 'OPTIMIZED');

    const computeGroup = (playerType, list) => {
      const count = list.length || 1;
      const stalls = list.reduce((a, b) => a + Number(b.stall_count || 0), 0);
      const startup = list.reduce((a, b) => a + Number(b.startup_delay_ms || 0), 0);
      const rebuf = list.reduce((a, b) => a + Number(b.total_stall_duration_sec || 0), 0);
      const br = list.reduce((a, b) => a + Number(b.avg_bitrate_kbps || 0), 0);
      const sw = list.reduce((a, b) => a + Number(b.quality_switches || 0), 0);
      const hits = list.reduce((a, b) => a + Number(b.cache_hits || 0), 0);
      const misses = list.reduce((a, b) => a + Number(b.cache_misses || 0), 0);
      return {
        player_type: playerType,
        totalRuns: list.length,
        avgStartupDelayMs: Math.round(startup / count),
        totalStalls: stalls,
        avgStallsPerRun: parseFloat((stalls / count).toFixed(2)),
        totalStallSec: parseFloat(rebuf.toFixed(2)),
        avgBitrateKbps: Math.round(br / count),
        avgQualitySwitches: parseFloat((sw / count).toFixed(1)),
        totalCacheHits: hits,
        totalCacheMisses: misses
      };
    };

    const comparisonRows = [
      computeGroup('BASELINE', baselineMetrics),
      computeGroup('OPTIMIZED', optimizedMetrics)
    ];

    res.json({
      success: true,
      service: 'StreamSmart Analytics Service',
      storageEngine: 'in-memory-fallback',
      totalSessions,
      completedSessions,
      runningSessions,
      avgStartupDelayMs: Math.round(totalStartup / mCount),
      totalStallCount: totalStalls,
      avgStallsPerSession: parseFloat((totalStalls / (sessions.length || 1)).toFixed(2)),
      totalRebufferSec: parseFloat(totalRebuffer.toFixed(1)),
      avgBitrateKbps: Math.round(totalBitrate / mCount),
      totalCacheHits: totalHits,
      totalCacheMisses: totalMisses,
      cacheHitRate,
      playerComparison: comparisonRows,
      recentSessions: sessions.slice(0, 6),
      endpoints: {
        summary: 'GET /api/analytics/summary',
        history: 'GET /api/analytics/history',
        sessionReport: 'GET /api/analytics/sessions/:id/report',
        sessionEvents: 'GET /api/analytics/sessions/:id/events'
      }
    });
  }
}

// GET /api/analytics – analytics index & platform summary
router.get('/', getAnalyticsSummary);

// GET /api/analytics/summary – aggregate stats across all sessions
router.get('/summary', getAnalyticsSummary);

// GET /api/analytics/history – paginated session history
router.get('/history', async (req, res) => {
  try {
    const { limit = 20, offset = 0, profileId, search } = req.query;
    let sessions = await TestSession.findAll({ limit: parseInt(limit, 10), offset: parseInt(offset, 10), profileId });

    if (search) {
      const q = search.toLowerCase();
      sessions = sessions.filter(s =>
        (s.video_title && s.video_title.toLowerCase().includes(q)) ||
        (s.profile_name && s.profile_name.toLowerCase().includes(q)) ||
        String(s.session_id).includes(q)
      );
    }

    const total = await TestSession.count(profileId);
    res.json({ sessions, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/sessions/:id/report – full comparison report for a session
router.get('/sessions/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    let session = await TestSession.findById(id);

    // Fallback search in memory
    if (!session) {
      session = fallback.getSessionById(id);
    }

    if (!session) {
      return res.status(404).json({ error: `Session #${id} not found in database or memory archive` });
    }

    const metrics = await PlayerMetric.findBySession(id);
    const events  = await PlaybackEvent.getTimeSeriesForChart(id);

    // Separate metrics by player type
    const baseline  = metrics.find(m => m.player_type === 'BASELINE')  || {};
    const optimized = metrics.find(m => m.player_type === 'OPTIMIZED') || {};

    // Separate events by player type
    const baselineEvents  = events.filter(e => e.player_type === 'BASELINE');
    const optimizedEvents = events.filter(e => e.player_type === 'OPTIMIZED');

    // Build time-series data for charts
    const buildTimeSeries = (evts, defaultBitrate = 0) =>
      evts.map(e => ({
        elapsed: parseFloat(e.elapsed_sec || 0),
        buffer: parseFloat(e.buffer_level_sec || 0),
        delay: parseInt(e.simulated_delay_ms || 0, 10),
        resolution: e.resolution_label || 'unknown',
        bitrate: defaultBitrate
      }));

    // Cache statistics
    const totalCacheHits   = (baseline.cache_hits   || 0) + (optimized.cache_hits   || 0);
    const totalCacheMisses = (baseline.cache_misses  || 0) + (optimized.cache_misses || 0);
    const latencySavedMs   = estimateLatencySaved(totalCacheHits, totalCacheMisses);

    res.json({
      session,
      baseline,
      optimized,
      timeSeries: {
        baseline:  buildTimeSeries(baselineEvents, baseline.avg_bitrate_kbps || 5000),
        optimized: buildTimeSeries(optimizedEvents, optimized.avg_bitrate_kbps || 1200)
      },
      cacheStats: {
        totalHits:     totalCacheHits,
        totalMisses:   totalCacheMisses,
        latencySavedMs,
        note: 'SIMULATED cache statistics – not measured from a real CDN'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/sessions/:id/events – raw event log for a session
router.get('/sessions/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { playerType } = req.query;
    const events = await PlaybackEvent.findBySession(id, playerType);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
