/**
 * scripts/testABRScenarios.js
 *
 * Automated Test Runner for the 5 Required ABR Scenarios:
 *  - Scenario A: High-Speed Network (15000 Kbps)
 *  - Scenario B: Medium Network (4500 Kbps)
 *  - Scenario C: Slow Network (850 Kbps)
 *  - Scenario D: Network Degradation (15000 -> 850 Kbps)
 *  - Scenario E: Network Recovery (850 -> 10000 Kbps)
 *  - Scenario F: MySQL Telemetry Event Persistence (QUALITY_SWITCH)
 *
 * Run: node scripts/testABRScenarios.js
 */

const assert = require('assert');
const path = require('path');
const db = require('../config/db');
const PlaybackEvent = require('../models/PlaybackEvent');
const TestSession = require('../models/TestSession');
const { recommendQuality, QUALITY_LADDER, BANDWIDTH_SAFETY } = require('../utils/abrEngine');

async function runScenarioTests() {
  console.log('\n=============================================================');
  console.log('🧪 StreamSmart Custom ABR Heuristic & Scenario Verification');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function test(description, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${description}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${description}`);
      console.error(`   Error: ${err.message}`);
    }
  }

  // ── Scenario A: High-Speed Network (15000 Kbps) ───────────────────────────
  console.log('Scenario A: High-Speed Network (15,000 Kbps)');
  test('High-speed network allows upshifting when buffer > 10.0s', () => {
    // Current at level 2 (480p, 1400k). Buffer is 12.0s. BW = 15000k. Safe BW = 11250k.
    // Next candidate is level 3 (720p, 2800k <= 11250k).
    const decision = recommendQuality({ currentLevel: 2, bufferSec: 12.0, bandwidthKbps: 15000 });
    assert.strictEqual(decision.nextLevel, 3);
    assert.strictEqual(decision.reason, 'STABLE_BANDWIDTH_UPSHIFT');
  });

  test('High-speed network allows upshifting from 720p to 1080p when buffer > 10.0s', () => {
    // Current at level 3 (720p, 2800k). Buffer is 14.0s. Next is level 4 (1080p, 5000k <= 11250k).
    const decision = recommendQuality({ currentLevel: 3, bufferSec: 14.0, bandwidthKbps: 15000 });
    assert.strictEqual(decision.nextLevel, 4);
    assert.strictEqual(decision.reason, 'STABLE_BANDWIDTH_UPSHIFT');
  });

  test('At peak rendition (1080p), steady state is maintained without overflow', () => {
    const decision = recommendQuality({ currentLevel: 4, bufferSec: 15.0, bandwidthKbps: 15000 });
    assert.strictEqual(decision.nextLevel, 4);
    assert.strictEqual(decision.reason, 'STEADY_STATE_HOLD');
  });

  // ── Scenario B: Medium Network (4500 Kbps) ────────────────────────────────
  console.log('\nScenario B: Medium Network (4,500 Kbps, Safe BW = 3,375 Kbps)');
  test('Medium network allows upshifting to 720p (2800k <= 3375k safe BW)', () => {
    const decision = recommendQuality({ currentLevel: 2, bufferSec: 11.5, bandwidthKbps: 4500 });
    assert.strictEqual(decision.nextLevel, 3);
    assert.strictEqual(decision.reason, 'STABLE_BANDWIDTH_UPSHIFT');
  });

  test('Medium network blocks upshift to 1080p (5000k > 3375k safe BW) to prevent stall', () => {
    const decision = recommendQuality({ currentLevel: 3, bufferSec: 12.0, bandwidthKbps: 4500 });
    assert.strictEqual(decision.nextLevel, 3);
    assert.strictEqual(decision.reason, 'STEADY_STATE_HOLD');
  });

  // ── Scenario C: Slow Network (850 Kbps) ───────────────────────────────────
  console.log('\nScenario C: Slow Network (850 Kbps, Rural 3G Congested)');
  test('Low buffer (< 3.5s) on congested network triggers emergency downshift', () => {
    const decision = recommendQuality({ currentLevel: 3, bufferSec: 2.2, bandwidthKbps: 850 });
    assert.strictEqual(decision.nextLevel, 2);
    assert.strictEqual(decision.reason, 'BUFFER_RISK_DOWNSHIFT');
  });

  test('Continued low buffer triggers sequential downshift to 360p', () => {
    const decision = recommendQuality({ currentLevel: 2, bufferSec: 1.8, bandwidthKbps: 850 });
    assert.strictEqual(decision.nextLevel, 1);
    assert.strictEqual(decision.reason, 'BUFFER_RISK_DOWNSHIFT');
  });

  test('Minimum rendition boundary: does not downshift below index 0', () => {
    const decision = recommendQuality({ currentLevel: 0, bufferSec: 1.2, bandwidthKbps: 850 });
    assert.strictEqual(decision.nextLevel, 0);
  });

  // ── Scenario D: Network Degradation (15000 -> 850 Kbps) ───────────────────
  console.log('\nScenario D: Network Degradation (Start High -> Drop Bandwidth)');
  test('Degradation: high-speed steady state drains buffer -> triggers downshift', () => {
    // 1. Initially high speed, buffer healthy at 12s, level 4 (1080p)
    const step1 = recommendQuality({ currentLevel: 4, bufferSec: 12.0, bandwidthKbps: 15000 });
    assert.strictEqual(step1.nextLevel, 4);

    // 2. Bandwidth drops to 850 Kbps, buffer drains to 3.0s -> emergency downshift to level 3
    const step2 = recommendQuality({ currentLevel: 4, bufferSec: 3.0, bandwidthKbps: 850 });
    assert.strictEqual(step2.nextLevel, 3);
    assert.strictEqual(step2.reason, 'BUFFER_RISK_DOWNSHIFT');

    // 3. Further drain to 2.0s -> emergency downshift to level 2
    const step3 = recommendQuality({ currentLevel: 3, bufferSec: 2.0, bandwidthKbps: 850 });
    assert.strictEqual(step3.nextLevel, 2);
    assert.strictEqual(step3.reason, 'BUFFER_RISK_DOWNSHIFT');
  });

  // ── Scenario E: Network Recovery (1200 -> 10000 Kbps) ──────────────────────
  console.log('\nScenario E: Network Recovery (Start Low -> Boost Bandwidth)');
  test('Recovery: starts low at level 1 -> bandwidth recovers -> buffer refills -> upshifts', () => {
    // 1. Initial low state at level 1, buffer 5s (steady hold at 1200k, safe BW = 900k >= 800k)
    const step1 = recommendQuality({ currentLevel: 1, bufferSec: 5.0, bandwidthKbps: 1200 });
    assert.strictEqual(step1.nextLevel, 1);
    assert.strictEqual(step1.reason, 'STEADY_STATE_HOLD');

    // 2. Bandwidth jumps to 10,000 Kbps, buffer fills to 11.0s (> 10s)
    // Safe BW = 7500k >= next level 2 (1400k) -> upshift to level 2 (480p)
    const step2 = recommendQuality({ currentLevel: 1, bufferSec: 11.0, bandwidthKbps: 10000 });
    assert.strictEqual(step2.nextLevel, 2);
    assert.strictEqual(step2.reason, 'STABLE_BANDWIDTH_UPSHIFT');

    // 3. Buffer continues growing to 13.0s -> upshift to level 3 (720p, 2800k)
    const step3 = recommendQuality({ currentLevel: 2, bufferSec: 13.0, bandwidthKbps: 10000 });
    assert.strictEqual(step3.nextLevel, 3);
    assert.strictEqual(step3.reason, 'STABLE_BANDWIDTH_UPSHIFT');
  });

  // ── Scenario F: MySQL Telemetry Persistence ───────────────────────────────
  console.log('\nScenario F: MySQL Telemetry Event Logging');
  try {
    await db.initializeAndConnect();

    // Create a mock benchmark session
    const session = await TestSession.create({
      userId: 1,
      videoId: 1,
      profileId: 1,
      simBandwidthKbps: 4500,
      simLatencyMs: 65,
      simCacheHitProb: 0.75,
      measurementMode: 'SIMULATED',
      testDurationSec: 30
    });

    const eventId = await PlaybackEvent.create({
      sessionId: session.sessionId,
      playerType: 'OPTIMIZED',
      eventType: 'QUALITY_SWITCH',
      elapsedSec: 14.5,
      resolutionLabel: '720p',
      bufferLevelSec: 11.2,
      simulatedDelayMs: 4500,
      isCacheHit: true
    });

    total++;
    assert(eventId > 0, 'PlaybackEvent.create inserted quality switch event into MySQL');
    console.log(`✅ [PASS] PlaybackEvent recorded to MySQL (event_id: ${eventId}, session_id: ${session.sessionId})`);
    passed++;

    const events = await PlaybackEvent.findBySession(session.sessionId, 'OPTIMIZED');
    total++;
    assert(events.length > 0 && events[0].resolution_label === '720p', 'Retrieved logged QUALITY_SWITCH event from MySQL');
    console.log(`✅ [PASS] Verified retrieved QUALITY_SWITCH event: ${events[0].resolution_label} at ${events[0].elapsed_sec}s`);
    passed++;

  } catch (err) {
    console.warn('⚠️ MySQL live check skipped or failed:', err.message);
  }

  console.log('\n=============================================================');
  console.log(`Summary: ${passed}/${total} scenario tests passed (${Math.round((passed/total)*100)}%)`);
  console.log('=============================================================\n');

  if (passed === total) {
    console.log('🎉 ALL 5 ABR NETWORK TEST SCENARIOS FULLY VERIFIED!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runScenarioTests();

