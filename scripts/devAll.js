/**
 * scripts/devAll.js
 *
 * Concurrently starts both the StreamSmart Express backend (port 5001)
 * and the React/Vite development server (port 5173).
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const port = process.env.PORT || 5001;

console.log('\n=============================================================');
console.log('🚀 StreamSmart Dual-Process Dev Runner');
console.log(`   Backend API:  http://localhost:${port}`);
console.log('   Frontend Web: http://localhost:5173');
console.log('=============================================================\n');

// 1. Start Backend Server
const backend = spawn('node', ['server.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Frontend Dev Server
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: true
});

function shutdown() {
  console.log('\nShutting down StreamSmart servers...');
  try { backend.kill(); } catch (_) {}
  try { frontend.kill(); } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

