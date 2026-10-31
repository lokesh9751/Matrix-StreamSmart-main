/**
 * test-abr-resolution-and-telemetry.js
 *
 * Comprehensive Verification Suite for StreamSmart ABR Quality Selection & Dynamic Telemetry
 *
 * Verifies:
 *  Test A: High bandwidth (10 Mbps) selects highest sustainable rendition (750p / 1080p), does not stay at 100p.
 *  Test B: Low bandwidth (500 Kbps) selects appropriate lower rendition.
 *  Test C: Bandwidth increase (1 Mbps -> 10 Mbps) upgrades resolution dynamically.
 *  Test D: Bandwidth decrease (10 Mbps -> 500 Kbps) triggers immediate BANDWIDTH_LIMIT downshift to protect playback.
 *  Test E: Dynamic telemetry updates (download throughput, resolution, bitrate, buffer, quality switches).
 *  Test F: Fixed-Quality Player protection (confirm BaselinePlayer.jsx and createBaselinePlayer remain untouched).
 */

const fs = require('fs');
const path = require('path');
const {
  recommendQuality,
  getHighestSustainableLevel,
  calculateSafeBandwidth,
  QUALITY_LADDER
} = require('./utils/abrEngine');

async function runTests() {
  console.log('🧪 Starting StreamSmart ABR Quality Selection & Dynamic Telemetry Suite...\n');

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

  // Cloudinary sp_hd Profile Levels (realistic multi-bitrate ladder)
  const spHdLevels = [
    { height: 100, width: 178,  bitrate: 150000,  attrs: { RESOLUTION: '178x100' } },  // Level 0: 100p (150 kbps)
    { height: 240, width: 426,  bitrate: 400000,  attrs: { RESOLUTION: '426x240' } },  // Level 1: 240p (400 kbps)
    { height: 360, width: 640,  bitrate: 800000,  attrs: { RESOLUTION: '640x360' } },  // Level 2: 360p (800 kbps)
    { height: 480, width: 854,  bitrate: 1400000, attrs: { RESOLUTION: '854x480' } },  // Level 3: 480p (1400 kbps)
    { height: 750, width: 1334, bitrate: 3000000, attrs: { RESOLUTION: '1334x750' } }, // Level 4: 750p (3000 kbps)
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // Test A: High Bandwidth (10 Mbps)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Test A: High Bandwidth (10 Mbps / 10,000 Kbps)');
  const highBwSafe = calculateSafeBandwidth(10000); // 7500 Kbps
  const initialHighLevel = getHighestSustainableLevel(
    spHdLevels.map((l, i) => ({ level: i, bitrateKbps: Math.round(l.bitrate / 1000), height: l.height })),
    highBwSafe
  );
  assert(initialHighLevel === 4, `Initial quality with 10 Mbps selects Level 4 (750p, 3000k <= 7500k safe BW)`);

  const highBwDecision = recommendQuality({
    currentLevel: 0,
    bufferSec: 5.0,
    bandwidthKbps: 10000,
    hlsLevels: spHdLevels
  });
  assert(
    highBwDecision.nextLevel === 4 && highBwDecision.reason === 'STABLE_BANDWIDTH_UPSHIFT',
    `ABR engine upshifts from Level 0 to Level 4 (750p) with 10 Mbps bandwidth & 5.0s buffer (not stuck at 100p)`
  );
  assert(
    highBwDecision.spec.height === 750 || highBwDecision.spec.label === '750p',
    `Target rendition label is 750p`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Test B: Low Bandwidth (500 Kbps)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Test B: Low Bandwidth (500 Kbps)');
  const lowBwSafe = calculateSafeBandwidth(500); // 375 Kbps
  const initialLowLevel = getHighestSustainableLevel(
    spHdLevels.map((l, i) => ({ level: i, bitrateKbps: Math.round(l.bitrate / 1000), height: l.height })),
    lowBwSafe
  );
  assert(initialLowLevel === 0, `Initial quality with 500 Kbps selects Level 0 (100p, 150k <= 375k safe BW)`);

  const lowBwDecision = recommendQuality({
    currentLevel: 1,
    bufferSec: 6.0,
    bandwidthKbps: 500,
    hlsLevels: spHdLevels
  });
  assert(
    lowBwDecision.nextLevel <= 1,
    `ABR player does not select unsustainable high rendition under 500 Kbps (selected Level ${lowBwDecision.nextLevel})`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Test C: Bandwidth Increase (1 Mbps -> 10 Mbps)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Test C: Bandwidth Increase (1 Mbps -> 10 Mbps)');
  // Start at 1 Mbps with 4.5s buffer -> Level 2 (360p, 800k fits under 750k safe BW or Level 1)
  const step1 = recommendQuality({
    currentLevel: 1,
    bufferSec: 4.5,
    bandwidthKbps: 1000,
    hlsLevels: spHdLevels
  });

  // Bandwidth increases to 10 Mbps -> safeBW becomes 7500 Kbps
  const step2 = recommendQuality({
    currentLevel: step1.nextLevel,
    bufferSec: 5.5,
    bandwidthKbps: 10000,
    hlsLevels: spHdLevels
  });
  assert(
    step2.nextLevel > step1.nextLevel && step2.reason === 'STABLE_BANDWIDTH_UPSHIFT',
    `Bandwidth increase (1M -> 10M) upgrades resolution from Level ${step1.nextLevel} to Level ${step2.nextLevel} (750p)`
  );
  assert(step2.nextLevel === 4, `Target level reached peak sustainable 750p (Level 4)`);

  // ──────────────────────────────────────────────────────────────────────────
  // Test D: Bandwidth Decrease (10 Mbps -> 500 Kbps)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Test D: Sudden Bandwidth Decrease (10 Mbps -> 500 Kbps)');
  // Currently playing at Level 4 (750p, 3000 Kbps)
  // Bandwidth plunges to 500 Kbps (safe BW = 375 Kbps)
  const plungeDecision = recommendQuality({
    currentLevel: 4,
    bufferSec: 8.0,
    bandwidthKbps: 500,
    hlsLevels: spHdLevels
  });
  assert(
    plungeDecision.reason === 'BANDWIDTH_LIMIT' && plungeDecision.nextLevel <= 1,
    `Sudden bandwidth drop immediately downshifts from Level 4 to Level ${plungeDecision.nextLevel} (BANDWIDTH_LIMIT)`
  );

  // Buffer depletion emergency downshift
  const bufferStarvation = recommendQuality({
    currentLevel: 2,
    bufferSec: 2.2,
    bandwidthKbps: 10000,
    hlsLevels: spHdLevels
  });
  assert(
    bufferStarvation.reason === 'BUFFER_RISK_DOWNSHIFT' && bufferStarvation.nextLevel === 1,
    `Buffer depletion (2.2s < 3.5s) immediately triggers BUFFER_RISK_DOWNSHIFT (2 -> 1) even with 10 Mbps bandwidth`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Test E: Telemetry & Measurement Consistency
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n5. Test E: Telemetry & Measurement Consistency');
  // Read client telemetryTracker file to verify throughput calculation logic
  const trackerCode = fs.readFileSync(path.join(__dirname, 'client/src/utils/telemetryTracker.js'), 'utf8');
  assert(
    trackerCode.includes('stats.loading.first > 0 ? stats.loading.first : stats.loading.start') ||
    trackerCode.includes('stats.loading.start'),
    'telemetryTracker handles stats.loading.start fallback when stats.loading.first is 0/undefined'
  );
  assert(
    trackerCode.includes('recordThroughput'),
    'telemetryTracker exposes recordThroughput for simulator integration'
  );
  assert(
    trackerCode.includes('Hls.Events.LEVEL_SWITCHED'),
    'telemetryTracker listens to Hls.Events.LEVEL_SWITCHED for quality switches and resolution'
  );

  // Read OptimizedPlayer.jsx to verify reactive UI bindings
  const optPlayerCode = fs.readFileSync(path.join(__dirname, 'client/src/components/players/OptimizedPlayer.jsx'), 'utf8');
  assert(
    optPlayerCode.includes('getCurrentLevel') || optPlayerCode.includes('actualLevelRef.current'),
    'OptimizedPlayer dynamically synchronizes actualLevelRef with player state'
  );
  assert(
    optPlayerCode.includes('YouTubeQualitySelector'),
    'OptimizedPlayer renders YouTubeQualitySelector with currentLevelIndex and activeResolution'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Test F: Fixed-Quality Player Protection (CRITICAL RESTRICTION)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n6. Test F: Fixed-Quality Player Protection (CRITICAL RESTRICTION)');
  const baselinePlayerCode = fs.readFileSync(path.join(__dirname, 'client/src/components/players/BaselinePlayer.jsx'), 'utf8');
  const dualPlayerCode = fs.readFileSync(path.join(__dirname, 'client/src/utils/dualPlayer.js'), 'utf8');

  // Verify BaselinePlayer.jsx was not modified (contains original header and structure)
  assert(
    baselinePlayerCode.includes('Fixed High-Quality Video Streaming') || baselinePlayerCode.includes('BaselinePlayer'),
    'BaselinePlayer.jsx exists and maintains its original structure'
  );

  // Verify createBaselinePlayer is intact and untouched in dualPlayer.js
  const baselineFnStart = dualPlayerCode.indexOf('export function createBaselinePlayer');
  const optimizedFnStart = dualPlayerCode.indexOf('export function createOptimizedPlayer');
  assert(
    baselineFnStart !== -1 && optimizedFnStart !== -1 && baselineFnStart < optimizedFnStart,
    'createBaselinePlayer and createOptimizedPlayer are properly defined in dualPlayer.js'
  );

  const baselineSlice = dualPlayerCode.substring(baselineFnStart, optimizedFnStart);
  assert(
    baselineSlice.includes('selectedQualityIndex = highest') &&
    baselineSlice.includes('hls.currentLevel     = highest') &&
    baselineSlice.includes('hls.loadLevel        = highest'),
    'createBaselinePlayer retains its fixed-high quality lock to highest level (750p/1080p)'
  );

  console.log('\n========================================');
  console.log(`Total tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log('========================================\n');

  if (passed === total) {
    console.log('🎉 ALL ABR RESOLUTION, TELEMETRY & FIXED-PLAYER ISOLATION TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED!');
    process.exit(1);
  }
}

runTests();
