require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const db               = require('./config/db');
const authRoutes       = require('./routes/authRoutes');
const workbenchRoutes  = require('./routes/workbenchRoutes');
const simulatorRoutes  = require('./routes/simulatorRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');
const adminRoutes      = require('./routes/adminRoutes');

const fs = require('fs');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const clientDistPath = path.join(__dirname, 'client/dist');
const hasClientDist = fs.existsSync(clientDistPath);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve compiled frontend assets when available
if (hasClientDist) {
  app.use(express.static(clientDistPath));
}

// Request logger for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ── Service Discovery / Root Endpoints ───────────────────────────────────────

// Root: Serve React Web App in browser, or API discovery JSON for API clients
app.get('/', (req, res) => {
  if (hasClientDist && req.accepts('html')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }

  res.json({
    success: true,
    service: 'StreamSmart – Smart Video Streaming Optimization & Benchmarking Platform',
    version: '1.0.0',
    status: 'operational',
    apiBase: '/api',
    documentation: 'See README for architecture and API contracts',
    routes: {
      health:    '/api/health',
      workbench: '/api/workbench',
      simulator: '/api/simulator',
      analytics: '/api/analytics',
      admin:     '/api/admin',
      auth:      '/api/auth'
    }
  });
});

// API index
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    service: 'StreamSmart REST API',
    version: '1.0.0',
    endpoints: {
      health:                'GET  /api/health',
      videos:                'GET  /api/workbench/videos',
      profiles:              'GET  /api/workbench/profiles',
      createSession:         'POST /api/workbench/sessions',
      stopSession:           'PATCH /api/workbench/sessions/:id/stop',
      saveMetrics:           'POST /api/workbench/sessions/:id/metrics',
      logEvents:             'POST /api/workbench/sessions/:id/events',
      abrRecommendation:     'POST /api/simulator/abr',
      segmentSimulation:     'POST /api/simulator/segment',
      cacheStats:            'GET  /api/simulator/cache-stats/:sessionId',
      qualityLadder:         'GET  /api/simulator/quality-ladder',
      mediaProxy:            'GET  /api/simulator/proxy',
      sessionHistory:        'GET  /api/analytics/history',
      comparisonReport:      'GET  /api/analytics/sessions/:id/report',
      sessionEvents:         'GET  /api/analytics/sessions/:id/events',
      analyticsSummary:      'GET  /api/analytics/summary',
      adminProfiles:         'GET,POST /api/admin/profiles',
      adminProfileDetail:    'PUT,DELETE /api/admin/profiles/:id',
      adminVideos:           'GET,POST /api/admin/videos',
      adminVideoDetail:      'PUT,DELETE /api/admin/videos/:id',
      authUsers:             'GET  /api/auth/users',
      authLogin:             'POST /api/auth/login',
      authMe:                'GET  /api/auth/me'
    }
  });
});

// Convenience health aliases
app.get('/health', (_req, res) => res.redirect('/api/health'));

// Health check endpoint (verifies MySQL database connectivity & tables)
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let tables = [];

  try {
    const [rows] = await db.query('SHOW TABLES');
    dbStatus = 'connected';
    tables = rows.map(r => Object.values(r)[0]);
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  const isHealthy = dbStatus === 'connected';

  res.status(200).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'StreamSmart API',
    database: {
      status: dbStatus,
      name: db.DB_CONFIG.database,
      host: db.DB_CONFIG.host,
      port: db.DB_CONFIG.port,
      tablesCount: tables.length,
      tables
    },
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ── Friendly Path Aliases (prevent common shortcut 404s) ──────────────────────
app.get('/api/videos',   (req, res, next) => { req.url = '/videos';   workbenchRoutes(req, res, next); });
app.get('/api/profiles', (req, res, next) => { req.url = '/profiles'; workbenchRoutes(req, res, next); });
app.get('/api/history',  (req, res, next) => { req.url = '/history';  analyticsRoutes(req, res, next); });
app.get('/api/summary',  (req, res, next) => { req.url = '/summary';  analyticsRoutes(req, res, next); });
app.get('/api/report/:id', (req, res, next) => { req.url = `/sessions/${req.params.id}/report`; analyticsRoutes(req, res, next); });

// ── Core API Route Groups ───────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/workbench',  workbenchRoutes);
app.use('/api/simulator',  simulatorRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/admin',      adminRoutes);

// SPA client-side fallback: serve index.html for all non-API GET requests
if (hasClientDist) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ── Global Error Handling Middleware ─────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[StreamSmart Error] ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  const statusCode = err.status || err.statusCode || (
    err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' ? 503 : 500
  );

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR',
    path: req.originalUrl,
    method: req.method
  });
});

// ── 404 Not Found Handler (Executed ONLY after all routes are evaluated) ────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    method: req.method,
    path: req.originalUrl,
    message: `Cannot ${req.method} ${req.originalUrl}. See /api for list of available endpoints.`
  });
});

// ── Asynchronous Server Startup with Database Initialization & Port Fallback ──
function listenWithFallback(portToTry, isFallback = false) {
  const server = app.listen(portToTry, '0.0.0.0', () => {
    console.log(`\n🚀 StreamSmart API running on http://localhost:${portToTry}${isFallback ? ' (In-Memory Fallback Mode)' : ''}`);
    console.log(`   Health Check: http://localhost:${portToTry}/api/health`);
    console.log(`   API Index:    http://localhost:${portToTry}/api`);
    if (!isFallback) {
      console.log(`   MySQL Database: connected to '${db.DB_CONFIG?.database || 'streamsmart_db'}'\n`);
    } else {
      console.log('');
    }
  });

  server.on('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && portToTry !== 5002) {
      console.warn(`⚠️ Port ${portToTry} is unavailable (${err.code}). Retrying on alternative port 5002...`);
      listenWithFallback(5002, isFallback);
    } else {
      console.error(`❌ Server listen error:`, err.message);
    }
  });
  return server;
}

async function startServer() {
  try {
    console.log('🔄 Initializing database and verifying MySQL connection...');
    await db.initializeAndConnect();
    listenWithFallback(PORT, false);
  } catch (err) {
    console.warn('\n⚠️ Warning: MySQL database unavailable during server startup.');
    console.warn(`   Error: ${err.message}`);
    console.warn('   Running with transparent In-Memory Fallback Storage.\n');
    listenWithFallback(PORT, true);
  }
}

// Start server when executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
