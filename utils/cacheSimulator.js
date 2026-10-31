/**
 * cacheSimulator.js – LRU-style Edge Cache Simulator
 *
 * Simulates edge-CDN cache behaviour for HLS media segments.
 * Cache-hit delay:  12 ms  (served from local edge node)
 * Cache-miss delay: 260 ms (origin server fetch)
 *
 * Uses an LRU Set limited to 200 entries; entries older than the
 * capacity are evicted (Set insertion-order iteration).
 */

const CACHE_HIT_DELAY_MS  = 12;
const CACHE_MISS_DELAY_MS = 260;
const MAX_CACHE_SIZE      = 200;

// Module-level LRU cache (shared across a server process lifetime)
const lruCache = new Set();

// Per-session hit/miss counters (keyed by sessionId)
const sessionStats = new Map();

function _ensureSession(sessionId) {
  if (!sessionStats.has(sessionId)) {
    sessionStats.set(sessionId, { hits: 0, misses: 0 });
  }
}

/**
 * Evaluate whether a segment is a cache hit and return the delay.
 *
 * @param {string} segmentKey   - Unique identifier for the segment (e.g. URL)
 * @param {number} cacheHitProb - Configured probability of a cache hit (0–1)
 * @param {string|number} [sessionId] - Optional session for stats tracking
 * @returns {{ isCacheHit: boolean, cacheDelayMs: number }}
 */
function evaluateCache(segmentKey, cacheHitProb, sessionId) {
  const alreadyCached = lruCache.has(segmentKey);
  const isCacheHit    = alreadyCached || Math.random() < parseFloat(cacheHitProb);

  // Maintain LRU eviction
  if (!alreadyCached) {
    if (lruCache.size >= MAX_CACHE_SIZE) {
      // Remove the oldest entry (first in insertion order)
      const oldest = lruCache.values().next().value;
      lruCache.delete(oldest);
    }
    lruCache.add(segmentKey);
  }

  if (sessionId !== undefined) {
    _ensureSession(sessionId);
    const stats = sessionStats.get(sessionId);
    if (isCacheHit) stats.hits++; else stats.misses++;
  }

  return {
    isCacheHit,
    cacheDelayMs: isCacheHit ? CACHE_HIT_DELAY_MS : CACHE_MISS_DELAY_MS
  };
}

/**
 * Get accumulated hit/miss counts for a session.
 */
function getSessionStats(sessionId) {
  return sessionStats.get(sessionId) || { hits: 0, misses: 0 };
}

/**
 * Reset stats for a session (call when a new benchmark starts).
 */
function resetSession(sessionId) {
  sessionStats.delete(sessionId);
}

/**
 * Estimate total latency saved by cache hits vs all-miss baseline.
 */
function estimateLatencySaved(hits, misses) {
  const totalRequests = hits + misses;
  if (totalRequests === 0) return 0;
  const missOnlyTotalMs   = totalRequests * CACHE_MISS_DELAY_MS;
  const actualTotalMs     = hits * CACHE_HIT_DELAY_MS + misses * CACHE_MISS_DELAY_MS;
  return Math.max(0, missOnlyTotalMs - actualTotalMs);
}

module.exports = {
  CACHE_HIT_DELAY_MS,
  CACHE_MISS_DELAY_MS,
  evaluateCache,
  getSessionStats,
  resetSession,
  estimateLatencySaved
};

