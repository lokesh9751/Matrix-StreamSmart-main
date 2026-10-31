const { app } = require('./server');
const { EventEmitter } = require('events');

function testEndpoint(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {
      'x-user-id': '1',
      'content-type': 'application/json',
      ...headers
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
      json(data) { resolve({ statusCode: this.statusCode, headers: this.headers, body: data }); },
      send(data) { resolve({ statusCode: this.statusCode, headers: this.headers, body: data }); },
      render(view, data) {
        resolve({
          statusCode: this.statusCode || 200,
          headers: this.headers,
          renderedView: view,
          viewData: data,
          body: data
        });
      },
      redirect(codeOrUrl, url) {
        if (typeof codeOrUrl === 'number') {
          this.statusCode = codeOrUrl;
          this.headers['location'] = url;
        } else {
          this.statusCode = 302;
          this.headers['location'] = codeOrUrl;
        }
        resolve({ statusCode: this.statusCode, headers: this.headers });
      },
      writeHead(code, headers) {
        this.statusCode = code;
        Object.assign(this.headers, headers);
        return this;
      },
      end() { resolve({ statusCode: this.statusCode, headers: this.headers }); }
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, headers: res.headers, body: res.body, renderedView: res.renderedView, viewData: res.viewData });
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

  // 8. Video Catalog Endpoint (JSON API)
  const videoListRes = await testEndpoint('GET', '/api/videos');
  assert(videoListRes.statusCode === 200 && Array.isArray(videoListRes.body.videos),
    `GET /api/videos returns 200 with JSON video list (${videoListRes.body?.videos?.length} records)`);

  // 9. Video Stream Route (Fallback / Cloudinary redirect)
  const streamRes = await testEndpoint('GET', '/api/video/stream/1');
  assert(streamRes.statusCode === 302 || streamRes.statusCode === 206 || streamRes.statusCode === 200,
    `GET /api/video/stream/1 returns streaming response (HTTP ${streamRes.statusCode})`);

  // 10. Video Upload Route Validation (missing file returns 400)
  const uploadMissingRes = await testEndpoint('POST', '/api/video/upload');
  assert(uploadMissingRes.statusCode === 400 && uploadMissingRes.body.success === false,
    `POST /api/video/upload validates incoming file and returns 400 when empty`);

  // 11. Benchmark EJS View Route (GET /benchmark)
  const benchmarkViewRes = await testEndpoint('GET', '/benchmark', null, { accept: 'text/html' });
  assert(benchmarkViewRes.renderedView === 'benchmark' && Array.isArray(benchmarkViewRes.viewData?.videos),
    `GET /benchmark renders EJS 'benchmark' view with ${benchmarkViewRes.viewData?.videos?.length} videos`);

  // 12. Direct /videos EJS View Route (GET /videos)
  const videosViewRes = await testEndpoint('GET', '/videos', null, { accept: 'text/html' });
  assert(videosViewRes.renderedView === 'benchmark' && Array.isArray(videosViewRes.viewData?.videos),
    `GET /videos renders EJS 'benchmark' view with ${videosViewRes.viewData?.videos?.length} videos`);

  // 13. Video Catalog Synchronization (GET /api/video/sync)
  const syncRes = await testEndpoint('GET', '/api/video/sync');
  assert(syncRes.statusCode === 200 && syncRes.body.success === true,
    `GET /api/video/sync returns 200 and synchronized video catalog (${syncRes.body?.totalActiveVideos} active)`);

  // 14. Cloudinary Deletion Webhook (POST /api/video/cloudinary-webhook)
  const webhookRes = await testEndpoint('POST', '/api/video/cloudinary-webhook', {
    notification_type: 'delete',
    resources: ['streamsmart_videos/test_delete_asset']
  });
  assert(webhookRes.statusCode === 200 && webhookRes.body.success === true,
    `POST /api/video/cloudinary-webhook processes asset deletion notifications successfully`);

  console.log(`\n========================================`);
  console.log(`Route tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`========================================\n`);
}

runRouteTests().catch(err => {
  console.error('Route test error:', err);
  process.exit(1);
});
