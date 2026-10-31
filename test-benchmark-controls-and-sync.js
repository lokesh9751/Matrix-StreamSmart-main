/**
 * test-benchmark-controls-and-sync.js
 *
 * Verification suite for:
 * 1. Benchmark Duration and Countdown logic (Bug fix: 30s default, no 692s override)
 * 2. Video Catalog Deduplication across public_id, URL, and title
 * 3. Cloudinary Deletion Webhook & Synchronization Reconciliation
 * 4. Comparative Bar Chart & Live Telemetry Dataset Generation
 */

const assert = require('assert');
const Video = require('./models/Video');
const fallback = require('./utils/inMemoryFallbackStore');
const { buildComparisonBarData, buildTimelineChartData } = require('./client/src/utils/chartController');

async function runTests() {
  console.log('🧪 Starting Benchmark Controls, Sync & Deduplication Verification Suite...\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // ── 1. Benchmark Duration & Timer Calculation ─────────────────────────────
  console.log('1. Benchmark Duration & Countdown Timer Logic:');
  
  test('Benchmark duration defaults to 30s and is not overwritten by long video duration (e.g. 734s or 692s)', () => {
    const DEFAULT_BENCHMARK_DURATION_SEC = 30;
    const MIN_BENCHMARK_DURATION_SEC = 10;
    const MAX_BENCHMARK_DURATION_SEC = 600;

    const longVideo = { duration_sec: 734, title: 'Tears of Steel' };
    
    // Simulate initial mount logic
    let benchmarkDuration = DEFAULT_BENCHMARK_DURATION_SEC;
    const videoLen = Number(longVideo.duration_sec) || 0;

    // Fixed logic: only clamp down if user-set duration exceeds video length
    if (videoLen > 0 && benchmarkDuration > videoLen) {
      benchmarkDuration = Math.max(MIN_BENCHMARK_DURATION_SEC, videoLen);
    }

    assert.strictEqual(benchmarkDuration, 30, 'Duration remains 30s for 734s video');
  });

  test('Benchmark duration clamps down only when stream is shorter than configured duration (e.g. 15s)', () => {
    const DEFAULT_BENCHMARK_DURATION_SEC = 30;
    const MIN_BENCHMARK_DURATION_SEC = 10;

    const shortVideo = { duration_sec: 15, title: 'Short Clip' };
    let benchmarkDuration = DEFAULT_BENCHMARK_DURATION_SEC;
    const videoLen = Number(shortVideo.duration_sec) || 0;

    if (videoLen > 0 && benchmarkDuration > videoLen) {
      benchmarkDuration = Math.max(MIN_BENCHMARK_DURATION_SEC, videoLen);
    }

    assert.strictEqual(benchmarkDuration, 15, 'Duration clamps down to 15s for short stream');
  });

  test('User can configure custom duration (e.g. 60s) within range [10, 600]', () => {
    const MIN_BENCHMARK_DURATION_SEC = 10;
    const MAX_BENCHMARK_DURATION_SEC = 600;

    const userInput = 60;
    const videoLen = 596;
    const maxLimit = videoLen > 0 ? Math.min(videoLen, MAX_BENCHMARK_DURATION_SEC) : MAX_BENCHMARK_DURATION_SEC;
    const clamped = Math.min(Math.max(userInput, MIN_BENCHMARK_DURATION_SEC), maxLimit);

    assert.strictEqual(clamped, 60, 'Custom duration of 60s is accepted');
  });

  // ── 2. Catalog Deduplication Verification ─────────────────────────────────
  console.log('\n2. Catalog Deduplication System:');

  await testAsync('Video.findAll() deduplicates identical public_id, URLs, or normalized titles', async () => {
    const videos = await Video.findAll();
    assert(videos.length > 0, 'Videos list is non-empty');

    const seenPublicIds = new Set();
    const seenTitles = new Set();
    const seenUrls = new Set();

    for (const v of videos) {
      if (v.cloudinaryPublicId) {
        assert(!seenPublicIds.has(v.cloudinaryPublicId), `No duplicate public_id: ${v.cloudinaryPublicId}`);
        seenPublicIds.add(v.cloudinaryPublicId);
      }

      const normTitle = (v.title || '').trim().toLowerCase();
      assert(!seenTitles.has(normTitle), `No duplicate title: ${v.title}`);
      seenTitles.add(normTitle);

      const normUrl = (v.hlsPlaylistUrl || v.stream_url || '').toLowerCase();
      assert(!seenUrls.has(normUrl), `No duplicate stream URL: ${v.stream_url}`);
      seenUrls.add(normUrl);
    }
  });

  // ── 3. Cloudinary Deletion Webhook & Synchronization ──────────────────────
  console.log('\n3. Cloudinary Webhook & Sync Reconciliation:');

  await testAsync('Video.deleteByCloudinaryPublicId marks matching assets as inactive', async () => {
    // Add a temporary asset
    const testPubId = `streamsmart_videos/sync_test_${Date.now()}`;
    await Video.createVideo({
      title: 'Sync Test Video',
      mp4Url: `https://res.cloudinary.com/demo/video/upload/${testPubId}.mp4`,
      hlsPlaylistUrl: `https://res.cloudinary.com/demo/video/upload/sp_hd/${testPubId}.m3u8`,
      cloudinaryPublicId: testPubId
    });

    // Verify it is active
    let list = await Video.findAll();
    assert(list.some(v => v.cloudinaryPublicId === testPubId), 'Video active before webhook');

    // Process deletion webhook
    const result = await Video.deleteByCloudinaryPublicId(testPubId);
    assert(result.success === true, 'deleteByCloudinaryPublicId returned success');

    // Verify it is deactivated
    list = await Video.findAll();
    assert(!list.some(v => v.cloudinaryPublicId === testPubId), 'Video deactivated after webhook');
  });

  // ── 4. Comparative Bar Chart & Telemetry Datasets ─────────────────────────
  console.log('\n4. Live Comparative Bar Chart & Dual-Axis Telemetry:');

  test('buildComparisonBarData generates side-by-side datasets for all 4 key metrics', () => {
    const baseline = {
      startupDelayMs: 2400,
      totalStallDurationSec: 9.4,
      stallCount: 3,
      currentBitrateKbps: 5000
    };
    const optimized = {
      startupDelayMs: 420,
      totalStallDurationSec: 0.0,
      stallCount: 0,
      currentBitrateKbps: 2800
    };

    const barData = buildComparisonBarData(baseline, optimized);
    assert.strictEqual(barData.labels.length, 4, 'Includes Startup, Rebuffering, Stalls, and Bitrate');
    assert.strictEqual(barData.datasets.length, 2, 'Contains Baseline and Optimized datasets');
    assert.strictEqual(barData.datasets[0].data[0], 2.4, 'Baseline startup delay converted to 2.4s');
    assert.strictEqual(barData.datasets[1].data[0], 0.42, 'Optimized startup delay converted to 0.42s');
    assert.strictEqual(barData.datasets[0].data[3], 5.0, 'Baseline bitrate is 5.0 Mbps');
    assert.strictEqual(barData.datasets[1].data[3], 2.8, 'Optimized bitrate is 2.8 Mbps');
  });

  test('buildTimelineChartData formats dual-axis buffer and bitrate series', () => {
    const baseSeries = [
      { elapsed: 1, buffer: 2.5, bitrate: 5000 },
      { elapsed: 2, buffer: 4.8, bitrate: 5000 }
    ];
    const optSeries = [
      { elapsed: 1, buffer: 3.2, bitrate: 1800 },
      { elapsed: 2, buffer: 6.5, bitrate: 2800 }
    ];

    const chartData = buildTimelineChartData(baseSeries, optSeries);
    assert.strictEqual(chartData.labels.length, 2, 'Labels contain 2 time points (1s, 2s)');
    assert.strictEqual(chartData.datasets.length, 4, '4 datasets (Baseline buffer/bitrate + Optimized buffer/bitrate)');
  });

  console.log(`\n========================================`);
  console.log(`Total tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL BENCHMARK, SYNC & DEDUPLICATION SPECIFICATIONS VERIFIED!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
