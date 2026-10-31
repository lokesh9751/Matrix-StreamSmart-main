const { app } = require('./server');
const { EventEmitter } = require('events');

function testEndpoint(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {
      'x-user-id': '1',
      'content-type': 'application/json'
    };
    if (body) {
      req.body = body;
    }

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      getHeader(k) { return this.headers[k]; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ statusCode: this.statusCode, body: data }); },
      send(data) { resolve({ statusCode: this.statusCode, body: data }); },
      end() { resolve({ statusCode: this.statusCode }); }
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, body: res.body });
    });
  });
}

async function runRouteTests() {
  console.log('📡 Starting StreamSmart API Route Verification Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  // 1. Health Endpoint
  const healthRes = await testEndpoint('GET', '/api/health');
  assert(healthRes.statusCode === 200 && (healthRes.body.status === 'ok' || healthRes.body.status === 'degraded'),
    `GET /api/health returns 200 (status: ${healthRes.body?.status})`);

  // 2. Videos Catalog
  const videosRes = await testEndpoint('GET', '/api/workbench/videos');
  assert(videosRes.statusCode === 200 && Array.isArray(videosRes.body.videos) && videosRes.body.videos.length >= 2,
    `GET /api/workbench/videos returns ${videosRes.body?.videos?.length} stream targets`);

  // 3. Network Profiles
  const profilesRes = await testEndpoint('GET', '/api/workbench/profiles');
  assert(profilesRes.statusCode === 200 && Array.isArray(profilesRes.body.profiles) && profilesRes.body.profiles.length >= 4,
    `GET /api/workbench/profiles returns ${profilesRes.body?.profiles?.length} network profiles`);

  // 4. Analytics Summary
  const summaryRes = await testEndpoint('GET', '/api/analytics/summary');
  assert(summaryRes.statusCode === 200 && summaryRes.body.success === true,
    'GET /api/analytics/summary returns 200 with platform metrics');

  // 5. Analytics History
  const historyRes = await testEndpoint('GET', '/api/analytics/history');
  assert(historyRes.statusCode === 200 && Array.isArray(historyRes.body.sessions),
    `GET /api/analytics/history returns 200 with session list (${historyRes.body?.sessions?.length} records)`);

  // 6. Simulator Quality Ladder
  const ladderRes = await testEndpoint('GET', '/api/simulator/quality-ladder');
  assert(ladderRes.statusCode === 200 && ladderRes.body.qualityLadder?.length >= 5,
    `GET /api/simulator/quality-ladder returns ${ladderRes.body.qualityLadder?.length} standard renditions`);

  // 7. Simulator ABR Recommendation
  const abrRes = await testEndpoint('POST', '/api/simulator/abr', {
    currentLevel: 3,
    bufferSec: 2.0,
    bandwidthKbps: 5000
  });
  assert(abrRes.statusCode === 200 && abrRes.body.recommendation?.nextLevel === 2,
    `POST /api/simulator/abr emergency downshifts to level ${abrRes.body.recommendation?.nextLevel} on buffer < 3.5s`);


  console.log(`\n========================================`);
  console.log(`Route tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`========================================\n`);
}

runRouteTests().catch(err => {
  console.error('Route test error:', err);
  process.exit(1);
});
