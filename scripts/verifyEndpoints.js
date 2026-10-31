/**
 * scripts/verifyEndpoints.js
 *
 * Verifies all route prefixes, SPA fallback serving, and JSON API endpoints:
 * 1. GET / (Accept: text/html) -> React SPA (200 OK HTML)
 * 2. GET /dashboard (Accept: text/html) -> React SPA (200 OK HTML)
 * 3. GET /workbench (Accept: text/html) -> React SPA (200 OK HTML)
 * 4. GET /analytics (Accept: text/html) -> React SPA (200 OK HTML)
 * 5. GET /history (Accept: text/html) -> React SPA (200 OK HTML)
 * 6. GET /report/demo (Accept: text/html) -> React SPA (200 OK HTML)
 * 7. GET /admin (Accept: text/html) -> React SPA (200 OK HTML)
 * 8. GET /api -> API discovery index (200 OK JSON)
 * 9. GET /api/health -> Health endpoint (200 OK JSON)
 * 10. GET /api/workbench/videos -> Video samples (200 OK JSON)
 * 11. GET /api/workbench/profiles -> Network profiles (200 OK JSON)
 * 12. GET /api/simulator/quality-ladder -> Rendition tiers (200 OK JSON)
 * 13. GET /api/analytics/summary -> Platform summary metrics (200 OK JSON)
 * 14. GET /api/analytics/history -> Session history records (200 OK JSON)
 * 15. GET /api/admin/profiles -> Admin profiles (200 OK JSON)
 * 16. GET /api/auth/users -> User directory (200 OK JSON)
 */

const http = require('http');
const db = require('../config/db');
const { app } = require('../server');

function testEndpoint(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = {
      'x-user-id': '1',
      'content-type': 'application/json',
      ...headers
    };

    const res = new http.ServerResponse(req);
    let responseBody = '';

    const origWrite = res.write;
    res.write = function (chunk, encoding, callback) {
      if (chunk) {
        responseBody += chunk.toString();
      }
      return true;
    };

    res.end = function (chunk, encoding, callback) {
      if (chunk) {
        responseBody += chunk.toString();
      }
      resolve({
        statusCode: res.statusCode,
        headers: res.getHeaders(),
        body: responseBody
      });
    };

    if (body) {
      req.body = body;
    }

    try {
      app.handle(req, res, (err) => {
        if (err) reject(err);
        else {
          resolve({
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: responseBody
          });
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function run() {
  console.log('🔍 Starting StreamSmart Full-Stack & Route Verification...\n');

  try {
    await db.initializeAndConnect();
    console.log('✅ Database connected.\n');
  } catch (err) {
    console.warn('⚠️ Running with In-Memory Fallback Store:', err.message, '\n');
  }

  const endpoints = [
    { method: 'GET', path: '/', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Root SPA HTML' },
    { method: 'GET', path: '/dashboard', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Dashboard SPA Route' },
    { method: 'GET', path: '/workbench', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Workbench SPA Route' },
    { method: 'GET', path: '/analytics', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Analytics SPA Route' },
    { method: 'GET', path: '/history', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'History SPA Route' },
    { method: 'GET', path: '/report/demo', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Reports SPA Route' },
    { method: 'GET', path: '/admin', headers: { 'accept': 'text/html' }, expectHtml: true, name: 'Admin Settings SPA Route' },
    { method: 'GET', path: '/api', expectJson: true, name: 'API Index' },
    { method: 'GET', path: '/api/health', expectJson: true, name: 'Health Endpoint' },
    { method: 'GET', path: '/api/workbench/videos', expectJson: true, name: 'Workbench Videos' },
    { method: 'GET', path: '/api/workbench/profiles', expectJson: true, name: 'Workbench Profiles' },
    { method: 'GET', path: '/api/simulator/quality-ladder', expectJson: true, name: 'Simulator Ladder' },
    { method: 'GET', path: '/api/analytics/summary', expectJson: true, name: 'Analytics Summary' },
    { method: 'GET', path: '/api/analytics/history', expectJson: true, name: 'Session History' },
    { method: 'GET', path: '/api/admin/profiles', expectJson: true, name: 'Admin Profiles' },
    { method: 'GET', path: '/api/auth/users', expectJson: true, name: 'Auth Users' }
  ];

  let passed = 0;

  for (const ep of endpoints) {
    try {
      const res = await testEndpoint(ep.method, ep.path, ep.headers || {});
      const is200 = res.statusCode === 200;

      if (ep.expectHtml) {
        const text = typeof res.body === 'string' ? res.body : '';
        const hasHtml = text.includes('<!DOCTYPE html>') || text.includes('StreamSmart') || text.includes('root');
        if (is200 && hasHtml) {
          passed++;
          console.log(`✅ [200 OK HTML SPA] ${ep.method} ${ep.path.padEnd(25)} -> Serves React App index.html (${ep.name})`);
        } else {
          console.error(`❌ HTML route ${ep.path} failed: status ${res.statusCode}`);
        }
      } else {
        let json = null;
        try { json = JSON.parse(res.body); } catch (_) {}
        if (is200 && json) {
          passed++;
          console.log(`✅ [200 OK JSON API] ${ep.method} ${ep.path.padEnd(30)} (${ep.name})`);
        } else {
          console.error(`❌ [${res.statusCode}] ${ep.method} ${ep.path}:`, res.body);
        }
      }
    } catch (err) {
      console.error(`❌ Error calling ${ep.path}:`, err.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`Verification: ${passed}/${endpoints.length} endpoints passed.`);
  console.log(`========================================\n`);

  if (passed === endpoints.length) {
    console.log('🎉 ALL FULL-STACK & FRONTEND ROUTES OPERATIONAL AND VERIFIED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
