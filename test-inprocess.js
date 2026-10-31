const { recommendQuality, QUALITY_LADDER, BUFFER_LOW_THRESHOLD, BUFFER_HIGH_THRESHOLD } = require('./utils/abrEngine');
const { evaluateCache, estimateLatencySaved, resetSession, getSessionStats } = require('./utils/cacheSimulator');
const { calculateSegmentDelay, simulatePacketLoss, estimateStallRisk } = require('./utils/networkThrottler');
const VideoSample = require('./models/VideoSample');
const NetworkProfile = require('./models/NetworkProfile');
const TestSession = require('./models/TestSession');
const PlayerMetric = require('./models/PlayerMetric');
const PlaybackEvent = require('./models/PlaybackEvent');

async function testAll() {
  console.log('🧪 Starting StreamSmart In-Process Verification Suite...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. ABR Engine Tests
  console.log('1. Custom ABR Decision Engine (abrEngine.js):');
  
  // Rule 1: Emergency downshift when buffer < 3.5s
  const downshift = recommendQuality({ currentLevel: 3, bufferSec: 2.1, bandwidthKbps: 5000 });
  assert(downshift.nextLevel === 2 && downshift.reason === 'BUFFER_RISK_DOWNSHIFT',
    'Buffer < 3.5s triggers emergency downshift (3 -> 2)');

  // Rule 1 boundary: Cannot downshift below level 0
  const minBoundary = recommendQuality({ currentLevel: 0, bufferSec: 1.0, bandwidthKbps: 1000 });
  assert(minBoundary.nextLevel === 0,
    'Level 0 does not downshift below 0 on low buffer');

  // Rule 2: Conservative upshift when buffer > 10.0s and next level fits 75% safe bandwidth
  // Level 1 (800k) to Level 2 (1400k). If BW = 2500k, 75% = 1875k >= 1400k -> upshift!
  const upshift = recommendQuality({ currentLevel: 1, bufferSec: 12.5, bandwidthKbps: 2500 });
  assert(upshift.nextLevel === 2 && upshift.reason === 'STABLE_BANDWIDTH_UPSHIFT',
    'Buffer > 10.0s and next level <= safe bandwidth triggers upshift (1 -> 2)');

  // Upshift prevented if safe bandwidth is too low
  // Level 1 to 2 needs 1400k. If BW = 1500k, 75% = 1125k < 1400k -> hold!
  const upshiftBlocked = recommendQuality({ currentLevel: 1, bufferSec: 12.5, bandwidthKbps: 1500 });
  assert(upshiftBlocked.nextLevel === 1 && upshiftBlocked.reason === 'STEADY_STATE_HOLD',
    'Upshift blocked when next level bitrate exceeds 75% safe bandwidth threshold');

  // Rule 2: BANDWIDTH_LIMIT immediate downshift when bandwidth plummets
  // Level 3 = 2800 Kbps. Bandwidth = 850 Kbps, safe = 637.5 Kbps.
  // Buffer is 7.5s (healthy!). Standard buffer rules would hold, but BANDWIDTH_LIMIT downshifts to level 0 (400k <= 637.5k).
  const bwDrop = recommendQuality({ currentLevel: 3, bufferSec: 7.5, bandwidthKbps: 850 });
  assert(bwDrop.nextLevel < 3 && bwDrop.reason === 'BANDWIDTH_LIMIT',
    `Bandwidth plunge (850k) triggers immediate BANDWIDTH_LIMIT downshift (3 -> ${bwDrop.nextLevel}) even with 7.5s buffer`);

  // Custom ladder & single level boundary test
  const singleLevelLadder = [{ level: 0, bitrate: 1200000, name: '720p' }];
  const singleLevelRes = recommendQuality({ currentLevel: 0, bufferSec: 1.0, bandwidthKbps: 500, qualityLadder: singleLevelLadder });
  assert(singleLevelRes.nextLevel === 0,
    'Single level stream remains safe at level 0 without index out-of-bounds');


  // 2. Cache Simulator Tests
  console.log('\n2. LRU Edge Cache Simulator (cacheSimulator.js):');
  resetSession('test_sess');
  const miss = evaluateCache('seg_1.ts', 0.0, 'test_sess');
  assert(miss.isCacheHit === false && miss.cacheDelayMs === 260,
    'Probability 0.0 results in cache miss with 260ms origin fetch delay');

  // Second fetch of same segment from LRU cache
  const hit = evaluateCache('seg_1.ts', 0.0, 'test_sess');
  assert(hit.isCacheHit === true && hit.cacheDelayMs === 12,
    'Subsequent fetch of cached segment results in cache hit with 12ms edge delay');

  const stats = getSessionStats('test_sess');
  assert(stats.hits === 1 && stats.misses === 1,
    'Session stats record exactly 1 hit and 1 miss');

  const saved = estimateLatencySaved(10, 5);
  // (15 * 260) - (10 * 12 + 5 * 260) = 3900 - (120 + 1300) = 2480 ms
  assert(saved === 2480, `Latency savings calculation correct (${saved} ms saved)`);

  // 3. Network Throttler Tests
  console.log('\n3. Network Throttler & Segment Delay (networkThrottler.js):');
  // 5000 Kbps segment at 850 Kbps bandwidth, 4s duration:
  // chunkBits = 5000 * 1000 * 4 = 20,000,000 bits
  // transferTimeMs = (20,000,000 / 850,000) * 1000 = ~23,529 ms
  const delay = calculateSegmentDelay({
    bitrateKbps: 5000,
    bandwidthKbps: 850,
    latencyMs: 220,
    cacheDelayMs: 260
  });
  assert(delay.transferTimeMs >= 23500 && delay.transferTimeMs <= 23600,
    `Segment transfer time matches formula: ${delay.transferTimeMs} ms`);
  assert(delay.totalSimulatedDelayMs >= delay.transferTimeMs + 220 + 260,
    `Total delay includes transfer + latency + cache + jitter: ${delay.totalSimulatedDelayMs} ms`);

  const stallRisk = estimateStallRisk(3.0, delay.totalSimulatedDelayMs);
  assert(stallRisk.willStall === true && stallRisk.margin < 0,
    'Correctly predicts buffer starvation when transfer delay exceeds buffer occupancy');

  // 4. Data Models and Storage Tests
  console.log('\n4. Database Models & Schema Verification:');
  const videos = await VideoSample.findAll();
  assert(videos.length >= 2, `VideoSample.findAll returned ${videos.length} videos`);
  assert(videos[0].title.includes('Big Buck Bunny'), 'Video catalog contains Big Buck Bunny');

  const profiles = await NetworkProfile.findAll();
  assert(profiles.length >= 4, `NetworkProfile.findAll returned ${profiles.length} profiles`);
  assert(profiles.some(p => p.profile_name.includes('Rural 3G')), 'Profiles include Rural 3G preset');
  assert(profiles.some(p => p.profile_name.includes('Fiber')), 'Profiles include High-Speed Fiber preset');

  // Create test session
  const newSession = await TestSession.create({
    userId: 1,
    videoId: 1,
    profileId: 1,
    simBandwidthKbps: 850,
    simLatencyMs: 220,
    simCacheHitProb: 0.20,
    measurementMode: 'SIMULATED',
    testDurationSec: 30
  });
  assert(newSession.sessionId > 0, `TestSession.create created session ID ${newSession.sessionId}`);

  // Upsert player metrics
  await PlayerMetric.upsert(newSession.sessionId, 'BASELINE', {
    startupDelayMs: 3400,
    stallCount: 5,
    totalStallDurationSec: 14.2,
    avgBitrateKbps: 5000,
    qualitySwitches: 0,
    cacheHits: 2,
    cacheMisses: 10
  });
  await PlayerMetric.upsert(newSession.sessionId, 'OPTIMIZED', {
    startupDelayMs: 950,
    stallCount: 0,
    totalStallDurationSec: 0.0,
    avgBitrateKbps: 1200,
    qualitySwitches: 4,
    cacheHits: 8,
    cacheMisses: 4
  });

  const metrics = await PlayerMetric.findBySession(newSession.sessionId);
  assert(metrics.length === 2, `Retrieved metrics for both BASELINE and OPTIMIZED (${metrics.length} records)`);

  const sessionDetail = await TestSession.findById(newSession.sessionId);
  assert(sessionDetail !== null, `Retrieved session detail for ID ${newSession.sessionId}`);

  // Test history pagination & search
  const sessionsList = await TestSession.findAll({ limit: 10, offset: 0 });
  const totalCount = await TestSession.count();
  assert(sessionsList.length > 0 && totalCount > 0,
    `TestSession.findAll returned ${sessionsList.length} sessions (total count: ${totalCount})`);


  // Test playback event logging
  await PlaybackEvent.create({
    sessionId: newSession.sessionId,
    playerType: 'OPTIMIZED',
    eventType: 'QUALITY_SWITCH',
    playbackTimeSec: 4.5,
    eventData: { from: 1, to: 2, reason: 'STABLE_BANDWIDTH_UPSHIFT' }
  });
  const events = await PlaybackEvent.findBySession(newSession.sessionId);
  assert(events.length >= 1 && events[0].event_type === 'QUALITY_SWITCH',
    'PlaybackEvent recorded and retrieved successfully');


  console.log(`\n========================================`);
  console.log(`Total tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL ARCHITECTURAL SPECIFICATIONS AND ALGORITHMS FULLY VERIFIED!');
  }
}

testAll().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

